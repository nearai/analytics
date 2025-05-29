from typing import List

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.models.canonical_metrics_entry import CanonicalMetricsEntry


class SortByTimestampConversion(BaseConversion):  # noqa: F821
    """Sort entries by timestamp."""

    def __init__(self, sort_field_name: str = "time_end_utc"):  # noqa: D107
        super().__init__()
        self.description = f"Sort by {sort_field_name}"
        self.sort_field_name = sort_field_name

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        # Sort. Most recent ones first, oldest last.
        def get_sort_key(entry: CanonicalMetricsEntry):
            timestamp = entry.fetch_value(self.sort_field_name)
            if timestamp:
                return timestamp
            return ""  # Put entries without timestamps at the end (empty string sorts before valid timestamps)

        return sorted(data, key=get_sort_key, reverse=True)
