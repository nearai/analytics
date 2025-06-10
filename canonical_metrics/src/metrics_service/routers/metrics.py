"""API endpoints for metrics operations."""

import logging
from typing import Dict, List, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from metrics_core.conversions.filter import FilterConversion
from metrics_core.local_files import load_logs_list_from_disk
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.models.condition import parse_condition_list
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

    filters: List[str] = []

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "filters": ["user:in:alomonos.near", "runner:not_in:local"]
            }
        }


def _extract_base_field_name(field_name: str) -> str:
    """Extract base field name by removing subfields like /n_samples, /min_value, /max_value."""
    # Remove subfield suffixes
    subfields = ["/n_samples", "/min_value", "/max_value"]
    base_field = field_name

    for subfield in subfields:
        if base_field.endswith(subfield):
            base_field = base_field[:-len(subfield)]
            break

    return base_field


def _check_field_presence(entries: List[CanonicalMetricsEntry], field_name: str, additional_filters: List[str]) -> bool:
    """Check if field is present in at least one entry after applying additional filters.

    Args:
        entries: List of entries to check
        field_name: Field name to check for (may include subfields)
        additional_filters: Additional filters to apply (not_in filters are ignored as per spec)

    Returns:
        True if field is present in at least one entry, False otherwise

    """
    # Parse additional filters, ignoring not_in filters as specified
    relevant_filters = []
    if additional_filters:
        parsed_filters = parse_condition_list(additional_filters)
        for condition in parsed_filters:
            # Ignore not_in filters as per specification
            if hasattr(condition, 'operator') and hasattr(condition.operator, 'value'):
                if condition.operator.value != "not_in":
                    relevant_filters.append(condition)
            elif str(condition.operator) != "not_in":
                relevant_filters.append(condition)

    # Apply additional filters
    if relevant_filters:
        filter_conversion = FilterConversion(relevant_filters)
        filtered_entries = filter_conversion.convert(entries)
    else:
        filtered_entries = entries

    # Check for field presence in filtered entries
    for entry in filtered_entries:
        # Try to fetch the field value - if it exists and is not None, field is present
        try:
            value = entry.fetch_value(field_name)
            if value is not None:
                return True
        except (KeyError, AttributeError):
            # Field doesn't exist in this entry, continue
            continue

    return False


@router.post("/important", response_model=dict)
async def get_important_metrics(request: ImportantMetricsRequest):
    """Get important metrics and their field presence status.

    This endpoint checks which important metrics are present in the data
    after applying the provided filters.

    Args:
        request: Request containing filters to apply

    Returns:
        Dictionary mapping metric display names to tuples of (additional_filters, field_name)
        for metrics that are present in the data

    """
    try:
        logger.info(f"Request received: {request}")
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
                    "time_end_utc:range:(2025-05-23T04:00:00):"
                ]
            },
            "predefined_metrics": list(IMPORTANT_METRICS.keys()),
            "response_format": "display_name -> (additional_filters, field_name)"
        }
    }
