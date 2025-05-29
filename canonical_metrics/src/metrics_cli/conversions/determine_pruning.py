from typing import List

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.models.canonical_metrics_entry import CanonicalMetricsEntry


class DeterminePruningConversion(BaseConversion):  # noqa: F821
    """Heuristics to determine pruning of metrics."""

    def __init__(self, min_threshold: float = 0.011, min_variation_ratio=0.33):  # noqa: D107
        super().__init__()
        self.description = "Determine pruning"
        self.min_threshold = min_threshold
        self.min_variation_ratio = min_variation_ratio

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        for entry in data:
            entry = self._prune_min_threshold(entry)
            entry = self._prune_all_success(entry)
            entry = self._prune_min_max(entry)
        return data

    def _prune_min_threshold(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        """Prune metrics with value < min_threshold."""
        metrics = entry.metrics
        new_metrics = {}
        for key, value in metrics.items():
            new_value = value
            if isinstance(value["value"], (float, int)):
                if value["value"] < self.min_threshold:
                    new_value = value
                    new_value["prune"] = True
            new_metrics[key] = new_value
        entry.metrics = new_metrics
        return entry

    def _prune_all_success(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        """Prune success metrics that are equal to all count."""
        metrics = entry.metrics

        # Build lookup for finding related metrics
        all_metrics = {}
        success_metrics = {}

        for key, value in metrics.items():
            # Classify metrics into all_metrics and success_metrics
            all_metrics[key] = value
            if key.endswith("_all"):
                # Intentionally put this metric into `all_metrics` two times: once with suffix, once without suffix
                base_key = key[:-4]  # Remove '_all'
                all_metrics[base_key] = value
            elif key.endswith("_success"):
                base_key = key[:-8]  # Remove '_success'
                success_metrics[base_key] = value

        # Check for success metrics that equal their corresponding all metrics
        for base_key in success_metrics:
            if base_key in all_metrics:
                success_value = success_metrics[base_key]["value"]
                all_value = all_metrics[base_key]["value"]

                if isinstance(success_value, (int, float)) and isinstance(all_value, (int, float)):
                    if success_value == all_value:
                        # Mark success metric for pruning
                        success_key = f"{base_key}_success"
                        v = success_metrics[base_key]
                        v["prune"] = True
                        metrics[success_key] = v

        entry.metrics = metrics
        return entry

    def _prune_min_max(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        """Prune min/max that are within min_variation_ratio of avg."""
        metrics = entry.metrics

        # Build lookup for finding related avg/min/max metrics
        avg_metrics = {}
        min_metrics = {}
        max_metrics = {}

        for key, value in metrics.items():
            if key.endswith("_avg"):
                base_key = key[:-4]  # Remove '_avg'
                avg_metrics[base_key] = value
            elif key.endswith("_min"):
                base_key = key[:-4]  # Remove '_min'
                min_metrics[base_key] = value
            elif key.endswith("_max"):
                base_key = key[:-4]  # Remove '_max'
                max_metrics[base_key] = value

        # Check min/max metrics against their corresponding avg
        for base_key in avg_metrics:
            avg_value = avg_metrics[base_key]["value"]

            if not isinstance(avg_value, (int, float)) or (avg_value == 0):
                continue

            # Check min metric
            if base_key in min_metrics:
                min_value = min_metrics[base_key]["value"]
                if isinstance(min_value, (int, float)):
                    variation_ratio = abs(avg_value - min_value) / avg_value
                    if variation_ratio < self.min_variation_ratio:
                        min_key = f"{base_key}_min"
                        v = metrics[min_key]
                        v["prune"] = True
                        metrics[min_key] = v

            # Check max metric
            if base_key in max_metrics:
                max_value = max_metrics[base_key]["value"]
                if isinstance(max_value, (int, float)):
                    variation_ratio = abs(avg_value - max_value) / avg_value
                    if variation_ratio < self.min_variation_ratio:
                        max_key = f"{base_key}_max"
                        v = metrics[max_key]
                        v["prune"] = True
                        metrics[max_key] = v

        entry.metrics = metrics
        return entry
