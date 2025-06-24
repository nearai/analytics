"""API endpoints for metrics operations."""

import logging
from typing import Dict, List, Tuple

from fastapi import APIRouter, HTTPException
from metrics_core.conversions.filter import FilterConversion
from metrics_core.local_files import load_logs_list_from_disk
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.models.condition import Condition, parse_condition_list
from metrics_core.transform_utils import extract_base_field_name
from pydantic import BaseModel, Field

from metrics_service.config import settings

router = APIRouter(prefix="/metrics", tags=["metrics"])

logger = logging.getLogger(__name__)

# Important metrics mapping: display_name -> (additional_filters, field_name)
IMPORTANT_METRICS: Dict[str, Tuple[List[str], str]] = {
    "Agent Invocations": ([], "time_end_utc/n_samples"),
    "Successful Invocations": (["errors/summary/error_count_all:range::0"], "time_end_utc/n_samples"),
    "Failed Invocations": (["errors/summary/error_count_all:range:1:"], "time_end_utc/n_samples"),
    "Avg Agent Latency": ([], "performance/latency/init_and_env_run_s_all"),
    "Max Agent Latency": ([], "performance/latency/init_and_env_run_s_all/max_value"),
    "Avg Runner Start Latency": (["runner:not_in:local"], "performance/latency/runner_latency_s"),
    "Max Runner Start Latency": (["runner:not_in:local"], "performance/latency/runner_latency_s/max_value"),
    "Avg Completion Latency": ([], "api_calls/inference_client_completions/latency_s_avg"),
    "Max Completion Latency": ([], "api_calls/inference_client_completions/latency_s_max/max_value"),
}


class ImportantMetricsRequest(BaseModel):
    """Request model for important metrics."""

    filters: List[str] = Field(default_factory=list)

    class Config:
        """Pydantic config."""

        json_schema_extra = {"example": {"filters": ["user:in:alomonos.near", "runner:not_in:local"]}}


def _check_field_presence(entries: List[CanonicalMetricsEntry], field_name: str, additional_filters: List[str]) -> bool:
    """Check if field is present in at least one entry after applying additional filters.

    Args:
    ----
        entries: List of entries to check
        field_name: Field name to check for (may include subfields)
        additional_filters: Additional filters to apply (not_in filters are ignored as per spec)

    Returns:
    -------
        True if field is present in at least one entry, False otherwise

    """
    # Parse additional filters, ignoring not_in filters as specified
    relevant_filters: List[Condition] = []
    if additional_filters:
        parsed_filters = parse_condition_list(additional_filters)
        for condition in parsed_filters:
            # Ignore not_in filters as per specification
            if hasattr(condition, "operator") and hasattr(condition.operator, "value"):
                if condition.operator.value != "not_in":
                    relevant_filters.append(condition)
            elif str(condition.operator) != "not_in":
                relevant_filters.append(condition)

    field_name = extract_base_field_name(field_name)

    # Check for field presences in entries
    for entry in entries:
        value = entry.fetch_value(field_name)
        if value is None:
            continue
        has_condition_fields = True
        for filter in relevant_filters:
            value = entry.fetch_value(filter.field_name)
            if value is None:
                has_condition_fields = False
                break
        if not has_condition_fields:
            continue
        return True

    return False


@router.post("/important", response_model=dict)
async def get_important_metrics(request: ImportantMetricsRequest):
    """Get important metrics depending on their field presence status.

    This endpoint checks which important metrics are present in the data
    after applying the provided filters.

    Args:
    ----
        request: Request containing filters to apply

    Returns:
    -------
        Dictionary mapping metric display names to tuples of (additional_filters, field_name)
        for metrics that are present in the data

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

        # Load entries from disk
        entries: List[CanonicalMetricsEntry] = load_logs_list_from_disk(metrics_path)

        if not entries:
            raise HTTPException(status_code=404, detail="No metrics entries found")

        # Apply base filters from request
        if request.filters:
            conditions = parse_condition_list(request.filters)
            filter_conversion = FilterConversion(conditions)
            entries = filter_conversion.convert(entries)

        # Check presence of each important metric
        result = {}
        for display_name, (additional_filters, field_name) in IMPORTANT_METRICS.items():
            if _check_field_presence(entries, field_name, additional_filters):
                result[display_name] = (additional_filters, field_name)

        return result

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
        raise HTTPException(status_code=500, detail=f"Error getting important metrics: {str(e)}")  # noqa: B904


@router.get("/schema")
async def get_schema():
    """Get the schema information for metrics endpoints."""
    return {
        "important_metrics": {
            "description": "Get important metrics that are present in the data",
            "filters": {
                "description": "Filters to apply before checking metric presence",
                "format": "field_name:operator:value",
                "operators": ["in", "not_in", "range"],
                "examples": [
                    "user:in:alomonos.near",
                    "runner:not_in:local",
                    "debug_mode:in:true",
                    "time_end_utc:range:(2025-05-23T04:00:00):",
                ],
            },
            "predefined_metrics": list(IMPORTANT_METRICS.keys()),
            "response_format": "display_name -> (additional_filters, field_name)",
        }
    }
