from typing import List

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.models.canonical_metrics_entry import CanonicalMetricsEntry


class RoundConversion(BaseConversion):  # noqa: F821
    """Round numeric values to specified precision."""

    def __init__(self, precision: int):  # noqa: D107
        super().__init__()
        self.description = f"Round numeric values to {precision} digits after dot"
        self.precision = precision

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        for entry in data:
            entry = self._round(entry)
        return data

    def _round(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        metrics = entry.metrics
        new_metrics = {}
        for key, value in metrics.items():
            new_value = value
            if isinstance(value["value"], float):
                new_value["value"] = round(value["value"], self.precision)
            new_metrics[key] = new_value
        entry.metrics = new_metrics
        return entry
