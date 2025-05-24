from typing import List

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_cli.models.condition import Condition


class FilterConversion(BaseConversion):  # noqa: F821
    """Filter entries."""

    def __init__(self, conditions: List[Condition]):  # noqa: D107
        super().__init__()
        self.description = "Filter"
        self.conditions = conditions

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        filtered_data = []

        for entry in data:
            # Check if entry passes all conditions
            passes_all_conditions = True

            for condition in self.conditions:
                if not condition.check(entry.fetch_value(condition.field_name)):
                    passes_all_conditions = False
                    break

            # Only include entry if it passes all conditions
            if passes_all_conditions:
                filtered_data.append(entry)

        return filtered_data
