"""API endpoints for graph operations."""

import logging
from typing import List

from fastapi import APIRouter, HTTPException
from metrics_core.local_files import load_logs_list_from_disk
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.models.moving_aggregation import MovingAggregation
from metrics_core.transform_utils import MovingAggregationParams, create_moving_aggregation
from pydantic import BaseModel

from metrics_service.config import settings

router = APIRouter(prefix="/graphs", tags=["graphs"])

logger = logging.getLogger(__name__)


class MovingAggregationRequest(BaseModel):
    """Request model for time series graph creation."""

    # Time granulation in ms
    time_granulation: int
    # A field name (can be subfield) used to calculate moving aggregation values
    moving_aggregation_field_name: str
    # Global filters to apply first
    global_filters: List[str] = []
    # List of filter conditions to calculate moving aggregation values
    moving_aggregation_filters: List[str] = []
    # Optional slice field
    slice_field: str = ""

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "time_granulation": 86400000,  # 1 day in milliseconds
                "moving_aggregation_field_name": "performance/latency/env_run_s_all",
                "global_filters": ["runner:not_in:local"],
                "moving_aggregation_filters": ["errors/summary/error_count_all:range::0"],
                "slice_field": "agent_name",
            }
        }


@router.post("/time-series", response_model=dict)
async def create_time_series_graph(request: MovingAggregationRequest):
    """Create a time series graph from metrics data.

    This endpoint processes metrics entries according to the provided parameters
    and returns a time series aggregation for graphing.

    Args:
    ----
        request: Moving aggregation parameters for time series graph creation

    Returns:
    -------
        A dictionary representation of the MovingAggregation result

    """
    try:
        logger.info(f"Request received: {request}")
        # Get metrics path from settings
        metrics_path = settings.get_metrics_path()

        # Load entries from disk
        entries: List[CanonicalMetricsEntry] = load_logs_list_from_disk(metrics_path)

        if not entries:
            raise HTTPException(status_code=404, detail="No metrics entries found")

        # Create MovingAggregationParams from request
        params = MovingAggregationParams(
            time_granulation=request.time_granulation,
            moving_aggregation_field_name=request.moving_aggregation_field_name,
            global_filters=request.global_filters,
            moving_aggregation_filters=request.moving_aggregation_filters,
            slice_field=request.slice_field,
        )

        # Create moving aggregation
        moving_aggregation: MovingAggregation = create_moving_aggregation(
            entries=entries,
            params=params,
        )

        return moving_aggregation.to_dict()

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"Metrics path not found: {str(e)}")  # noqa: B904
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating time series graph: {str(e)}")  # noqa: B904


@router.get("/schema")
async def get_schema():
    """Get the schema information for graphs endpoints."""
    return {
        "time_series": {
            "description": "Create time series graph data from metrics",
            "parameters": {
                "time_granulation": {
                    "description": "Time granulation in milliseconds",
                    "type": "integer",
                    "example": 86400000,
                },
                "moving_aggregation_field_name": {
                    "description": "Field name (can include subfields) used to calculate moving aggregation values",
                    "type": "string",
                    "example": "performance/latency/env_run_s_all",
                },
                "global_filters": {
                    "description": "Global filters to apply first",
                    "type": "array",
                    "items": {"type": "string"},
                    "example": ["runner:not_in:local"],
                },
                "moving_aggregation_filters": {
                    "description": "Filter conditions to calculate moving aggregation values",
                    "type": "array",
                    "items": {"type": "string"},
                    "example": ["errors/summary/error_count_all:range::0"],
                },
                "slice_field": {
                    "description": "Optional slice field for data grouping",
                    "type": "string",
                    "example": "agent_name",
                },
            },
            "response_format": {
                "time_begin": "timestamp in milliseconds",
                "time_end": "timestamp in milliseconds",
                "time_granulation": "time granulation in milliseconds",
                "field_name": "aggregation field name",
                "slice_field": "slice field name (if used)",
                "slice_values": "list of slice values",
                "values": "nested arrays of aggregation values",
                "min_value": "minimum value in the dataset",
                "max_value": "maximum value in the dataset",
                "filters": "list of applied filters",
            },
        }
    }
