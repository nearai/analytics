import re
from datetime import datetime
from typing import Any, Dict, List

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.models.canonical_metrics_entry import CanonicalMetricsEntry, MetadataFieldCategory, fetch_value


class CategorizeMetadataConversion(BaseConversion):  # noqa: F821
    """Determine metadata field categories."""

    def __init__(self):  # noqa: D107
        super().__init__()
        self.description = "Categorize Metadata Fields"

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        if not data:
            return data

        # Collect all metadata fields (except 'files') and their values across all entries
        field_values: Dict[str, List[Any]] = {}

        for entry in data:
            for field_name, _field_data in entry.metadata.items():
                if field_name == "files":  # Skip 'files' field
                    continue

                if field_name not in field_values:
                    field_values[field_name] = []

                value = fetch_value(entry.metadata, field_name)
                field_values[field_name].append(value)

        # Determine categories for each field
        field_categories: Dict[str, MetadataFieldCategory] = self._determine_field_categories(field_values)

        # Add category information to each entry's metadata
        for entry in data:
            for field_name, field_data in entry.metadata.items():
                if field_name == "files":  # Skip 'files' field
                    continue

                category = field_categories.get(field_name)
                assert category

                # Add category to the field data
                if isinstance(field_data, dict):
                    field_data["category"] = category.value
                else:
                    # If field_data is not a dict, convert it to one
                    entry.metadata[field_name] = {"value": field_data, "category": category.value}

        return data

    def _determine_field_categories(self, field_values: Dict[str, List[Any]]) -> Dict[str, MetadataFieldCategory]:
        """Determine the category for each metadata field based on its values."""
        field_categories = {}

        for field_name, values in field_values.items():
            category = self._categorize_field(field_name, values)
            field_categories[field_name] = category

        return field_categories

    def _categorize_field(self, field_name: str, values: List[Any]) -> MetadataFieldCategory:
        """Categorize a single field based on its name and values."""
        # Remove None values for analysis
        non_none_values = [v for v in values if v is not None]

        if not non_none_values:
            return MetadataFieldCategory.SAME

        # Get unique values
        unique_values = {str(v) for v in non_none_values}  # Convert to string for comparison
        unique_count = len(unique_values)

        # Determine category based on uniqueness
        assert unique_count >= 1
        if unique_count == 1 and len(values) == len(non_none_values):
            # All values are the same
            return MetadataFieldCategory.SAME
        if unique_count == 1 and len(values) > len(non_none_values):
            # Value present / value not present
            return MetadataFieldCategory.GROUP

        assert unique_count >= 2
        if unique_count == len(non_none_values):
            if self._is_timestamp_like(non_none_values[0]):
                return MetadataFieldCategory.TIMESTAMP
            return MetadataFieldCategory.UNIQUE

        assert unique_count >= 2 and unique_count < len(non_none_values)
        return MetadataFieldCategory.GROUP

    def _is_timestamp_like(self, value: Any) -> bool:
        """Check if a value looks like a timestamp."""
        if not isinstance(value, str):
            return False

        # ISO 8601 timestamp patterns
        iso_patterns = [
            # Full ISO format with timezone: 2025-05-23T11:48:26.341261+00:00
            r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+[+-]\d{2}:\d{2}$",
            # ISO format without timezone: 2025-05-23T11:48:26.341267
            r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+$",
            # ISO format with seconds: 2025-05-23T11:48:26
            r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$",
            # ISO format without seconds: 2025-05-23T11:48
            r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$",
            # ISO format with Z timezone: 2025-05-23T11:48:26.341261Z
            r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$",
            # Date only: 2025-05-23
            r"^\d{4}-\d{2}-\d{2}$",
            # Unix timestamp (as string): 1716464906
            r"^\d{10}$",
            # Unix timestamp with milliseconds: 1716464906341
            r"^\d{13}$",
        ]

        # Check against regex patterns
        for pattern in iso_patterns:
            if re.match(pattern, value):
                return True

        # Try to parse as datetime (fallback for other formats)
        try:
            # Common datetime formats
            datetime_formats = [
                "%Y-%m-%dT%H:%M:%S.%f",  # 2025-05-23T11:48:26.341267
                "%Y-%m-%dT%H:%M:%S.%f%z",  # 2025-05-23T11:48:26.341261+00:00
                "%Y-%m-%dT%H:%M:%S%z",  # 2025-05-23T11:48:26+00:00
                "%Y-%m-%dT%H:%M:%S",  # 2025-05-23T11:48:26
                "%Y-%m-%d %H:%M:%S",  # 2025-05-23 11:48:26
                "%Y-%m-%d",  # 2025-05-23
                "%m/%d/%Y %H:%M:%S",  # 05/23/2025 11:48:26
                "%m/%d/%Y",  # 05/23/2025
            ]

            for fmt in datetime_formats:
                try:
                    datetime.strptime(value, fmt)
                    return True
                except ValueError:
                    continue

        except Exception:
            pass

        # Additional heuristics for timestamp-like strings
        # Must contain date-like pattern (YYYY-MM-DD or similar)
        if re.search(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}", value):
            # And optionally time-like pattern
            if "T" in value or re.search(r"\d{1,2}:\d{2}", value):
                return True

        return False
