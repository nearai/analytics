import re
from typing import Any, Dict, List

from metrics_core.conversions.base import BaseConversion, substitute_with_boundary
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry


class RenameConversion(BaseConversion):
    """Heuristic renaming of fields for better sorting and dashboards alignment."""

    def __init__(self, verbose: bool = False):  # noqa: D107
        super().__init__()
        self.description = "Rename fields"
        self.verbose = verbose

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        for entry in data:
            entry = self._rename_metadata_times(entry)
            entry = self._rename_percentages(entry)
            entry = self._rename_avg_max_min(entry)
            entry = self._rename_all_fail_success(entry)
            # Intentionally do it 2 times.
            entry = self._rename_all_fail_success(entry)
            entry.metadata = dict(sorted(entry.metadata.items()))
            entry.metrics = dict(sorted(entry.metrics.items()))
        return data

    def _rename_metadata_times(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        """Rename time fields in metadata."""
        metadata = entry.metadata

        new_name = "time_begin_utc"
        if not metadata.get(new_name):
            candidate = self._find_key(metadata, ["time", "begin", "utc"])
            if not candidate:
                candidate = self._find_key(metadata, ["time", "start", "utc"])
            if not candidate:
                candidate = self._find_key(metadata, ["time", "begin"])
            if not candidate:
                candidate = self._find_key(metadata, ["time", "start"])
            if candidate:
                if self.verbose:
                    print(f"Renaming {candidate} -> {new_name}")
                metadata[new_name] = metadata.pop(candidate)

        new_name = "time_begin_local"
        if not metadata.get(new_name):
            candidate = self._find_key(metadata, ["time", "begin", "local"])
            if not candidate:
                candidate = self._find_key(metadata, ["time", "start", "local"])
            if candidate:
                if self.verbose:
                    print(f"Renaming {candidate} -> {new_name}")
                metadata[new_name] = metadata.pop(candidate)

        new_name = "time_end_utc"
        if not metadata.get(new_name):
            candidate = self._find_key(metadata, ["time", "end", "utc"])
            if not candidate:
                candidate = self._find_key(metadata, ["time", "stop", "utc"])
            if not candidate:
                candidate = self._find_key(metadata, ["time", "end"])
            if not candidate:
                candidate = self._find_key(metadata, ["time", "stop"])
            if candidate:
                if self.verbose:
                    print(f"Renaming {candidate} -> {new_name}")
                metadata[new_name] = metadata.pop(candidate)

        new_name = "time_end_local"
        if not metadata.get(new_name):
            candidate = self._find_key(metadata, ["time", "end", "local"])
            if not candidate:
                candidate = self._find_key(metadata, ["time", "end", "local"])
            if candidate:
                if self.verbose:
                    print(f"Renaming {candidate} -> {new_name}")
                metadata[new_name] = metadata.pop(candidate)

        entry.metadata = metadata
        return entry

    def _find_key(self, data: Dict[str, Any], words: List[str]) -> str:
        """Return key if there is exactly one key containing all `words`. Otherwise, return ""."""
        candidate = ""
        for k, _v in data.items():
            contains_all = True
            for w in words:
                if w not in k:
                    contains_all = False
                    break
            if contains_all:
                if candidate:
                    return ""
                candidate = k
        return candidate

    def _rename_percentages(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        """Rename percentages."""
        metrics = entry.metrics
        new_metrics = {}
        for key, value in metrics.items():
            if key.startswith("performance") and "percent" in key:
                if not key.startswith("performance/percentage"):
                    new_key = key.replace("percentage", "percent")
                    new_key = new_key.replace("performance/", "performance/percentages/")
                    if self.verbose:
                        print(f"Renaming {key} -> {new_key}")
                    key = new_key
            new_metrics[key] = value
        entry.metrics = new_metrics
        return entry

    def _rename_avg_max_min(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        """Rename and reorder 'avg', 'min', 'max'.

        'average' -> 'avg'
        'minimum' -> 'min'
        'maximum' -> 'max'
        'avg_latency' -> 'latency_avg'
        'avg_latency_ms' -> 'latency_ms_avg'
        """
        metrics = entry.metrics
        new_metrics = {}
        for key, value in metrics.items():
            new_key = key

            # First, normalize long forms to short forms
            replacements = [
                ("average", "avg"),
                ("minimum", "min"),
                ("maximum", "max"),
            ]

            for old_word, new_word in replacements:
                new_key = substitute_with_boundary(new_key, old_word, new_word)

            # Split on forward slashes to process each segment
            segments = new_key.split("/")
            processed_segments = []

            for segment in segments:
                # Reorder: move avg/min/max from beginning to end within each segment
                # Pattern: (avg|min|max)_(.+) -> $2_$1
                reorder_pattern = r"^(avg|min|max)_(.+)$"
                match = re.match(reorder_pattern, segment)
                if match:
                    stat_type = match.group(1)  # avg, min, or max
                    rest = match.group(2)  # everything after the underscore
                    segment = f"{rest}_{stat_type}"

                processed_segments.append(segment)

            new_key = "/".join(processed_segments)

            if new_key != key and self.verbose:
                print(f"Renaming {key} -> {new_key}")

            new_metrics[new_key] = value
        entry.metrics = new_metrics
        return entry

    def _rename_all_fail_success(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        """Rename and reorder 'all', 'fail', 'success'.

        'total' -> 'all'
        'failed' -> 'fail'
        'failure[s]' -> 'fail'
        'successful' -> 'success'
        'all_count' -> 'count_all'
        'fail_count' -> 'count_fail'
        """
        metrics = entry.metrics
        new_metrics = {}
        for key, value in metrics.items():
            new_key = key

            # First, normalize long forms to short forms
            replacements = [
                ("total", "all"),
                ("failed", "fail"),
                ("failure", "fail"),
                ("failures", "fail"),
                ("successful", "success"),
            ]

            for old_word, new_word in replacements:
                new_key = substitute_with_boundary(new_key, old_word, new_word)

            # Split on forward slashes to process each segment
            segments = new_key.split("/")
            processed_segments = []

            for segment in segments:
                # Reorder: move all/fail/success from beginning to end within each segment
                # Pattern: (all|fail|success)_(.+) -> $2_$1
                reorder_pattern = r"^(all|fail|success)_(.+)$"
                match = re.match(reorder_pattern, segment)
                if match:
                    status_type = match.group(1)  # all, fail, or success
                    rest = match.group(2)  # everything after the underscore
                    segment = f"{rest}_{status_type}"

                processed_segments.append(segment)

            new_key = "/".join(processed_segments)

            if new_key != key and self.verbose:
                print(f"Renaming {key} -> {new_key}")

            new_metrics[new_key] = value
        entry.metrics = new_metrics
        return entry
