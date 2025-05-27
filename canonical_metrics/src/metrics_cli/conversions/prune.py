from typing import List, Set

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.models.canonical_metrics_entry import CanonicalMetricsEntry


class PruneConversion(BaseConversion):  # noqa: F821
    """Prune metrics marked for pruning."""

    def __init__(self, verbose: bool = False, prune_all_entries: bool = True):  # noqa: D107
        """Initialize the PruneConversion.

        Args:
        ----
            verbose: If True, print messages when pruning metrics.
            prune_all_entries: Controls pruning behavior.
                - True: Individual pruning - remove metrics marked for pruning in each entry independently
                - False: Global pruning - only remove metrics that are marked for pruning in ALL entries

        """
        super().__init__()
        self.description = "Prune"
        self.verbose = verbose
        self.prune_all_entries = prune_all_entries

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        if self.prune_all_entries:
            # Prune each entry individually
            for entry in data:
                entry = self._prune(entry)
        else:
            # Prune metric columns only if ALL entries have that metric marked for pruning
            metrics_to_prune = self._find_metrics_to_prune_globally(data)
            for entry in data:
                entry = self._prune_globally(entry, metrics_to_prune)
        return data

    def _prune(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        """Remove metrics marked for pruning in this entry."""
        metrics = entry.metrics
        new_metrics = {}
        for key, value in metrics.items():
            if value.get("prune", False):
                if self.verbose:
                    print(f"Pruning {key} from entry")
                continue
            new_metrics[key] = value
        entry.metrics = new_metrics
        return entry

    def _find_metrics_to_prune_globally(self, data: List[CanonicalMetricsEntry]) -> Set[str]:
        """Find metrics that should be pruned globally (marked for pruning in all)."""
        if not data:
            return set()

        # Get all metric keys that exist across all entries
        metric_keys: Set[str] = set()
        for entry in data:
            entry_keys = set(entry.metrics.keys())
            metric_keys = metric_keys.union(entry_keys)

        # Check which metrics are marked for pruning in ALL entries
        for entry in data:
            keys_to_remove = set()
            for metric_key in metric_keys:
                metric_value = entry.metrics.get(metric_key, {})
                if not metric_value.get("prune", False):
                    keys_to_remove.add(metric_key)
            metric_keys = metric_keys - keys_to_remove

        return metric_keys

    def _prune_globally(self, entry: CanonicalMetricsEntry, metrics_to_prune: Set[str]) -> CanonicalMetricsEntry:
        """Prune metrics that are marked for global pruning."""
        metrics = entry.metrics
        new_metrics = {}

        for key, value in metrics.items():
            if key in metrics_to_prune:
                if self.verbose:
                    print(f"Globally pruning {key}")
                continue
            new_metrics[key] = value

        entry.metrics = new_metrics
        return entry
