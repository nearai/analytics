from typing import List

from metrics_core.conversions.base import BaseConversion
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.models.condition import Condition


def check_filters_against_entry(entry: CanonicalMetricsEntry, filters: List[Condition]) -> bool:
    for condition in filters:
        if not condition.check(entry.fetch_value(condition.field_name)):
            return False
    return True


class FilterConversion(BaseConversion):  # noqa: F821
    """Filter entries."""

    def __init__(self, conditions: List[Condition]):  # noqa: D107
        super().__init__()
        self.description = "Filter"
        self.conditions = conditions

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        filtered_data = []

        for entry in data:
            if check_filters_against_entry(entry, self.conditions):
                filtered_data.append(entry)

        return filtered_data
