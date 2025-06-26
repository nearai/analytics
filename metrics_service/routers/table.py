"""API endpoints for table operations."""

import csv
import io
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from evaluation.data import load_evaluation_entries
from evaluation.table import EvaluationTableCreationParams, create_evaluation_table
from metrics_core.conversions.aggregate import AggregateAbsentMetricsStrategy
from metrics_core.local_files import format_cell_values, format_row_name
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.models.table import SortOrder, Table
from metrics_core.transform_utils import (
    GroupsRecommendationStrategy,
    PruneMode,
    TableCreationParams,
    create_table,
)
from metrics_service.utils.cache import metrics_cache
from metrics_service.utils.config import settings

router = APIRouter(prefix="/table", tags=["table"])

logger = logging.getLogger(__name__)


def table_to_csv_string(table: Table) -> str:
    """Convert table to CSV string using the same formatting as CLI."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Process each row
    for row in table.rows:
        csv_row = []

        for cell_idx, cell in enumerate(row):
            if cell_idx == 0:
                # Row name (first column)
                csv_row.append(format_row_name(cell))
            else:
                # Data cells
                csv_row.append(format_cell_values(cell))

        writer.writerow(csv_row)

    return output.getvalue()


class TableCreationRequest(BaseModel):
    """Request model for table creation."""

    # TableCreationParams fields
    filters: List[str] = Field(default_factory=list)
    slices: List[str] = Field(default_factory=list)
    column_selections: List[str] = Field(default_factory=list)
    sort_by_column: Optional[str] = None
    sort_order: Optional[str] = "desc"  # "asc" or "desc"
    prune_mode: str = "column"  # "none" or "column"
    absent_metrics_strategy: str = "all_or_nothing"  # "all_or_nothing", "nullify", or "accept_subset"
    slices_recommendation_strategy: str = "concise"  # "none", "first_alphabetical", or "concise"

    # Additional parameters
    column_selections_to_add: Optional[List[str]] = None
    column_selections_to_remove: Optional[List[str]] = None

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "filters": ["runner:not_in:local", "user:in:alomonos.near"],
                "slices": ["agent_name", "debug_mode"],
                "column_selections": ["/metadata/time_end_utc/max_value", "/metrics/"],
                "sort_by_column": "performance/latency/env_run_s_all",
                "sort_order": "desc",
                "prune_mode": "column",
                "absent_metrics_strategy": "all_or_nothing",
                "slices_recommendation_strategy": "concise",
                "column_selections_to_add": ["/metrics/accuracy/answer_correctness"],
                "column_selections_to_remove": ["/metadata/debug_mode"],
            }
        }


class EvaluationTableCreationRequest(BaseModel):
    """Request model for evaluation table creation."""

    # EvaluationTableCreationParams fields
    filters: List[str] = Field(default_factory=list)
    column_selections: List[str] = Field(default_factory=list)
    sort_by_column: Optional[str] = None
    sort_order: Optional[str] = "desc"  # "asc" or "desc"

    # Additional parameters
    column_selections_to_add: Optional[List[str]] = None
    column_selections_to_remove: Optional[List[str]] = None

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "filters": ["organization:not_in:OpenAI"],
                "column_selections": ["/metrics/livebench/"],
                "sort_by_column": "livebench/average",
                "sort_order": "desc",
                "column_selections_to_add": ["/metrics/livebench/categories/coding"],
                "column_selections_to_remove": ["/metadata/organization"],
            }
        }


@router.post("/aggregation", response_model=dict)
async def create_metrics_table(request: TableCreationRequest):
    """Create a table from metrics data.

    This endpoint processes metrics entries according to the provided parameters
    and returns a formatted table with aggregated data.

    Args:
    ----
        request: Table creation parameters including filters, slices, and column selections

    Returns:
    -------
        A dictionary representation of the created Table

    """
    try:
        logger.info(f"Request received: {request}")
        # Check if metrics path is configured
        if not settings.has_metrics_path():
            raise HTTPException(
                status_code=503,
                detail="Metrics path not configured. This endpoint requires METRICS_BASE_PATH to be set.",
            )

        # Get metrics path from settings
        metrics_path = settings.get_metrics_path()

        # Load entries from cache (or disk if not cached)
        entries: List[CanonicalMetricsEntry] = metrics_cache.load_entries(metrics_path)

        if not entries:
            raise HTTPException(status_code=404, detail="No metrics entries found")

        # Convert strings to enums
        absent_strategy = AggregateAbsentMetricsStrategy(request.absent_metrics_strategy)
        prune_mode = PruneMode(request.prune_mode)
        slices_rec_strategy = GroupsRecommendationStrategy(request.slices_recommendation_strategy)

        # Handle sort_by parameter
        sort_by = None
        if request.sort_by_column:
            sort_order = SortOrder(request.sort_order)
            sort_by = (request.sort_by_column, sort_order)

        # Create TableCreationParams
        params = TableCreationParams(
            filters=request.filters,
            slices=request.slices,
            column_selections=request.column_selections,
            sort_by=sort_by,
            prune_mode=prune_mode,
            absent_metrics_strategy=absent_strategy,
            slices_recommendation_strategy=slices_rec_strategy,
        )

        # Create table
        table: Table = create_table(
            entries=entries,
            params=params,
            column_selections_to_add=request.column_selections_to_add,
            column_selections_to_remove=request.column_selections_to_remove,
        )

        return table.to_dict()

    except HTTPException:
        raise  # Re-raise HTTPException without wrapping
    except ValueError as e:
        if "METRICS_BASE_PATH is not set" in str(e):
            raise HTTPException(
                status_code=503,
                detail="Metrics path not configured. This endpoint requires METRICS_BASE_PATH to be set.",
            ) from None
        raise HTTPException(status_code=400, detail=str(e))  # noqa: B904
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"Metrics path not found: {str(e)}")  # noqa: B904
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating table: {str(e)}")  # noqa: B904


@router.post("/evaluation", response_model=dict)
async def create_evaluation_table_endpoint(request: EvaluationTableCreationRequest):
    """Create an evaluation table from metrics data.

    This endpoint processes evaluation entries according to the provided parameters
    and returns a formatted table with evaluation data. Unlike the aggregation
    endpoint, this creates a table where each row represents an individual entry
    rather than aggregated data.

    Args:
    ----
        request: Evaluation table creation parameters including filters and column selections

    Returns:
    -------
        A dictionary representation of the created Table

    """
    try:
        logger.info(f"Evaluation table request received: {request}")

        # Handle sort_by parameter
        sort_by = None
        if request.sort_by_column:
            sort_order = SortOrder(request.sort_order)
            sort_by = (request.sort_by_column, sort_order)

        # Create EvaluationTableCreationParams
        params = EvaluationTableCreationParams(
            filters=request.filters,
            column_selections=request.column_selections,
            sort_by=sort_by,
        )

        # Create evaluation table
        table: Table = create_evaluation_table(
            entries=load_evaluation_entries(),
            params=params,
            column_selections_to_add=request.column_selections_to_add,
            column_selections_to_remove=request.column_selections_to_remove,
        )

        return table.to_dict()

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"Metrics path not found: {str(e)}")  # noqa: B904
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating evaluation table: {str(e)}")  # noqa: B904


@router.post("/aggregation_csv")
async def create_metrics_table_csv(request: TableCreationRequest):
    """Create a CSV table from metrics data.

    This endpoint processes metrics entries according to the provided parameters
    and returns a CSV formatted table with aggregated data.

    Args:
    ----
        request: Table creation parameters including filters, slices, and column selections

    Returns:
    -------
        CSV content as text/csv response

    """
    try:
        logger.info(f"CSV aggregation request received: {request}")
        # Check if metrics path is configured
        if not settings.has_metrics_path():
            raise HTTPException(
                status_code=503,
                detail="Metrics path not configured. This endpoint requires METRICS_BASE_PATH to be set.",
            )

        # Get metrics path from settings
        metrics_path = settings.get_metrics_path()

        # Load entries from cache (or disk if not cached)
        entries: List[CanonicalMetricsEntry] = metrics_cache.load_entries(metrics_path)

        if not entries:
            raise HTTPException(status_code=404, detail="No metrics entries found")

        # Convert strings to enums
        absent_strategy = AggregateAbsentMetricsStrategy(request.absent_metrics_strategy)
        prune_mode = PruneMode(request.prune_mode)
        slices_rec_strategy = GroupsRecommendationStrategy(request.slices_recommendation_strategy)

        # Handle sort_by parameter
        sort_by = None
        if request.sort_by_column:
            sort_order = SortOrder(request.sort_order)
            sort_by = (request.sort_by_column, sort_order)

        # Create TableCreationParams
        params = TableCreationParams(
            filters=request.filters,
            slices=request.slices,
            column_selections=request.column_selections,
            sort_by=sort_by,
            prune_mode=prune_mode,
            absent_metrics_strategy=absent_strategy,
            slices_recommendation_strategy=slices_rec_strategy,
        )

        # Create table
        table: Table = create_table(
            entries=entries,
            params=params,
            column_selections_to_add=request.column_selections_to_add,
            column_selections_to_remove=request.column_selections_to_remove,
        )

        # Convert table to CSV string
        csv_content = table_to_csv_string(table)

        # Return CSV response with proper content type
        return Response(content=csv_content, media_type="text/csv")

    except HTTPException:
        raise  # Re-raise HTTPException without wrapping
    except ValueError as e:
        if "METRICS_BASE_PATH is not set" in str(e):
            raise HTTPException(
                status_code=503,
                detail="Metrics path not configured. This endpoint requires METRICS_BASE_PATH to be set.",
            ) from None
        raise HTTPException(status_code=400, detail=str(e))  # noqa: B904
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"Metrics path not found: {str(e)}")  # noqa: B904
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating table: {str(e)}")  # noqa: B904


@router.post("/evaluation_csv")
async def create_evaluation_table_csv(request: EvaluationTableCreationRequest):
    """Create a CSV evaluation table from metrics data.

    This endpoint processes evaluation entries according to the provided parameters
    and returns a CSV formatted table with evaluation data. Unlike the aggregation
    endpoint, this creates a table where each row represents an individual entry
    rather than aggregated data.

    Args:
    ----
        request: Evaluation table creation parameters including filters and column selections

    Returns:
    -------
        CSV content as text/csv response

    """
    try:
        logger.info(f"CSV evaluation table request received: {request}")

        # Handle sort_by parameter
        sort_by = None
        if request.sort_by_column:
            sort_order = SortOrder(request.sort_order)
            sort_by = (request.sort_by_column, sort_order)

        # Create EvaluationTableCreationParams
        params = EvaluationTableCreationParams(
            filters=request.filters,
            column_selections=request.column_selections,
            sort_by=sort_by,
        )

        # Create evaluation table
        table: Table = create_evaluation_table(
            entries=load_evaluation_entries(),
            params=params,
            column_selections_to_add=request.column_selections_to_add,
            column_selections_to_remove=request.column_selections_to_remove,
        )

        # Convert table to CSV string
        csv_content = table_to_csv_string(table)

        # Return CSV response with proper content type
        return Response(content=csv_content, media_type="text/csv")

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"Metrics path not found: {str(e)}")  # noqa: B904
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating evaluation table: {str(e)}")  # noqa: B904


@router.get("/schema")
async def get_schema():
    """Get the schema information for table creation parameters."""
    return {
        "prune_modes": [mode.value for mode in PruneMode],
        "absent_metrics_strategies": [strategy.value for strategy in AggregateAbsentMetricsStrategy],
        "slices_recommendation_strategies": [strategy.value for strategy in GroupsRecommendationStrategy],
        "sort_orders": [order.value for order in SortOrder],
        "filter_operators": [
            "in",
            "not_in",
            "range",
        ],
        "example_filters": [
            "agent_name:in:agent1,agent2,agent3",
            "runner:not_in:local",
            "user:in:alomonos.near",
            "debug_mode:in:true",
            "value:range:10:100",
            "value:range:10:",
            "value:range::100",
            "performance/latency/total_ms:range:1000:",
            "time_end_utc:range:(2025-05-23T04:00:00):",
        ],
        "example_column_selections": [
            "/metadata/",
            "/metrics/",
            "/metadata/agent_name",
            "/metadata/model",
            "/metadata/time_end_utc/max_value",
            "/metrics/performance/",
            "/metrics/performance/latency/",
            "/metrics/performance/latency/total_ms",
            "/metrics/accuracy/answer_correctness",
        ],
        "example_slices": [
            "agent_name",
            "debug_mode",
            "runner:in:local",
            "performance/latency/total_ms:range:1000:",
        ],
        "column_selection_tips": [
            "Use paths ending with / to select all children (e.g., /metrics/performance/)",
            "Use specific paths for individual metrics (e.g., /metrics/performance/latency/total_ms)",
            "Metadata aggregations can include subfields (e.g., /metadata/time_end_utc/max_value)",
        ],
        "filter_tips": [
            "Filters are applied before aggregation",
            "Use comma-separated values for in/not_in operators",
            "Range operator supports open-ended ranges with : separator",
        ],
        "time_filtering_tips": [
            "Time filters support ISO format with parentheses: time_end_utc:range:(2025-05-23T04:00:00):",
            "Use time ranges to analyze performance trends over specific periods",
            "Combine time filters with other conditions for targeted analysis",
        ],
        "slice_tips": [
            "Simple slices use just the field name (e.g., 'agent_name')",
            "Conditional slices use the same format as filters",
            "Slices determine how data is grouped for aggregation",
        ],
    }
