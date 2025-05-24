from typing import List

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.models.canonical_metrics_entry import CanonicalMetricsEntry


class PruneConversion(BaseConversion):  # noqa: F821
    """Prune metrics marked for pruning."""

    def __init__(self, verbose: bool = False):  # noqa: D107
        super().__init__()
        self.description = "Prune"
        self.verbose = verbose

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        for entry in data:
            entry = self._prune(entry)
        return data

    def _prune(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        metrics = entry.metrics
        new_metrics = {}
        for key, value in metrics.items():
            if value.get("prune", False):
                if self.verbose:
                    print(f"Pruning {key}")
                continue
            new_metrics[key] = value
        entry.metrics = new_metrics
        return entry
