"""API endpoints for table operations."""

import logging
from typing import List

from fastapi import APIRouter, HTTPException
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.transform_utils import (
    GroupsRecommendationStrategy,
    ListLogsCreationParams,
    PruneMode,
    create_logs_list,
)
from pydantic import BaseModel, Field

from metrics_service.utils.cache import metrics_cache
from metrics_service.utils.config import settings

router = APIRouter(prefix="/logs", tags=["logs"])

logger = logging.getLogger(__name__)


class ListLogsRequest(BaseModel):
    """Request model for listing logs."""

    filters: List[str] = Field(default_factory=list)
    groups: List[str] = Field(default_factory=list)
    prune_mode: str = "all"  # "none", or "column", or "all"
    groups_recommendation_strategy: str = "concise"  # "none", "first_alphabetical", or "concise"

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "filters": ["runner:not_in:local"],
                "groups": ["agent_name"],
                "prune_mode": "all",
                "groups_recommendation_strategy": "concise",
            }
        }


@router.post("/list", response_model=dict)
async def list_logs(request: ListLogsRequest):
    """List logs out of metrics data and files.

    This endpoint processes metrics & log entries according to the provided parameters
    and returns formatted grouped logs in chronological order.

    Args:
    ----
        request: List logs parameters including filters, and groups

    Returns:
    -------
        {"groups": {"aggr_entry": {..}, "entries": [..]}, "group_recommendations": [..]}

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

        prune_mode = PruneMode(request.prune_mode)
        groups_rec_strategy = GroupsRecommendationStrategy(request.groups_recommendation_strategy)

        # Create ListLogsCreationParams
        params = ListLogsCreationParams(
            filters=request.filters,
            groups=request.groups,
            prune_mode=prune_mode,
            groups_recommendation_strategy=groups_rec_strategy,
        )

        return create_logs_list(entries, params).to_dict()

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
        raise HTTPException(status_code=500, detail=f"Error creating a logs list: {str(e)}")  # noqa: B904


@router.get("/schema")
async def get_schema():
    """Get the schema information for logs list parameters."""
    return {
        "prune_modes": [mode.value for mode in PruneMode],
        "groups_recommendation_strategies": [strategy.value for strategy in GroupsRecommendationStrategy],
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
        "example_groups": [
            "agent_name",
            "debug_mode",
            "user",
            "runner:in:local",
            "performance/latency/total_ms:range:1000:",
        ],
        "filter_tips": [
            "Filters are applied before grouping",
            "Use comma-separated values for in/not_in operators",
            "Range operator supports open-ended ranges with : separator",
            "Time filters support ISO format: time_end_utc:range:(2025-05-23T04:00:00):",
        ],
        "group_tips": [
            "Simple groups use just the field name (e.g., 'agent_name')",
            "Conditional groups use the same format as filters",
            "Groups determine how entries are organized and aggregated",
        ],
    }
