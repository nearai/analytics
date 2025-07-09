"""Data loading utilities for evaluation."""

import json
from pathlib import Path
from typing import Any, Dict, List

from metrics_core.local_files import load_logs_list_from_disk
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry

LIVEBENCH_LEADERBOARD_PATH = "~/.analytics/livebench/leaderboard"


def _load_pricing_data() -> Dict[str, Any]:
    """Load pricing data from models_pricing.json."""
    pricing_file = Path(__file__).parent / "models_pricing.json"
    with open(pricing_file, "r", encoding="utf-8") as f:
        return json.load(f)


def _populate_pricing_fields(entry: CanonicalMetricsEntry, pricing_data: Dict[str, Any]) -> None:
    """Populate pricing fields in entry metadata based on organization and model_api_name."""
    organization = entry.metadata.get("organization")
    model_api_name = entry.metadata.get("model_api_name")

    if not organization or not model_api_name:
        return

    organizations = pricing_data.get("organizations", {})
    org_data = organizations.get(organization, {})

    # Get last_updated from pricing_info
    last_updated = pricing_data.get("pricing_info", {}).get("last_updated")

    # Check if organization is open source
    org_open_source = org_data.get("open_source", False)

    # Get model-specific data
    models = org_data.get("models", {})
    model_data = models.get(model_api_name, {})

    # Check if specific model is open source (overrides organization setting)
    model_open_source = model_data.get("open_source")
    is_open_source = model_open_source if model_open_source is not None else org_open_source

    # Populate open_source field
    if org_open_source or model_open_source is not None:
        entry.metadata["open_source"] = is_open_source

    # Populate price_input_tokens_1m
    input_cost = model_data.get("input_tokens_cost")
    if input_cost is not None or is_open_source:
        entry.metadata["price_input_tokens_1m"] = {
            "description": "LLM model pricing in USD per 1 million input tokens",
            "last_updated": last_updated,
            "value": 0 if is_open_source else input_cost
        }

    # Populate price_input_tokens_1m_with_cache
    input_cost_with_cache = model_data.get("input_tokens_cost_with_cache_enabled")
    if input_cost_with_cache is not None:
        entry.metadata["price_input_tokens_1m_with_cache"] = {
            "description": "LLM model pricing in USD per 1 million input tokens with cache enabled",
            "last_updated": last_updated,
            "value": input_cost_with_cache
        }

    # Populate price_input_tokens_1m_cached
    cached_input_cost = model_data.get("cached_input_tokens_cost")
    if cached_input_cost is not None:
        entry.metadata["price_input_tokens_1m_cached"] = {
            "description": "LLM model pricing in USD per 1 million cached input tokens",
            "last_updated": last_updated,
            "value": cached_input_cost
        }

    # Populate price_output_tokens_1m
    output_cost = model_data.get("output_tokens_cost")
    if output_cost is not None or is_open_source:
        entry.metadata["price_output_tokens_1m"] = {
            "description": "LLM model pricing in USD per 1 million output tokens",
            "last_updated": last_updated,
            "value": 0 if is_open_source else output_cost
        }

    # Populate price_notes
    notes = model_data.get("notes")
    if notes is not None:
        entry.metadata["price_notes"] = notes


def load_evaluation_entries() -> List[CanonicalMetricsEntry]:
    """Load available evaluation entries."""
    entries = load_logs_list_from_disk(Path(LIVEBENCH_LEADERBOARD_PATH).expanduser())
    # Read `evaluation/models_pricing.json` file and populate available pricing fields in `entry.metadata`.
    # Use "organization" and "model_api_name" fields in metadata as keys.

    try:
        pricing_data = _load_pricing_data()
        for entry in entries:
            _populate_pricing_fields(entry, pricing_data)
    except Exception as e:
        print(f"Warning: Could not load pricing data: {e}")

    return entries
