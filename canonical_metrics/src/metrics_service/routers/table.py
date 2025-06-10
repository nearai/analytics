"""API endpoints for table operations."""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from metrics_core.conversions.aggregate import AggregateAbsentMetricsStrategy
from metrics_core.local_files import load_logs_list_from_disk
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.models.table import SortOrder, Table
from metrics_core.transform_utils import GroupsRecommendationStrategy, PruneMode, TableCreationParams, create_table
from pydantic import BaseModel

from metrics_service.config import settings

router = APIRouter(prefix="/table", tags=["table"])

logger = logging.getLogger(__name__)


class TableCreationRequest(BaseModel):
    """Request model for table creation."""

    # TableCreationParams fields
    filters: List[str] = []
    slices: List[str] = []
    column_selections: List[str] = []
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
        # Get metrics path from settings
        metrics_path = settings.get_metrics_path()

        # Load entries from disk
        entries: List[CanonicalMetricsEntry] = load_logs_list_from_disk(metrics_path)

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

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"Metrics path not found: {str(e)}")  # noqa: B904
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating table: {str(e)}")  # noqa: B904


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
