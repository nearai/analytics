import re
from typing import List

from metrics_core.conversions.base import BaseConversion, substitute_with_boundary
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry


class MsToSConversion(BaseConversion):  # noqa: F821
    """Convert millisecond fields to seconds."""

    def __init__(self, verbose: bool = False):  # noqa: D107
        super().__init__()
        self.description = "Millisecond fields to seconds"
        self.verbose = verbose

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        for entry in data:
            entry = self._ms_to_s(entry)
        return data

    def _ms_to_s(self, entry: CanonicalMetricsEntry) -> CanonicalMetricsEntry:
        metrics = entry.metrics
        new_metrics = {}
        for key, value in metrics.items():
            segments = key.split("/")
            segments[-1] = substitute_with_boundary(segments[-1], "ms", "s")
            new_key = "/".join(segments)

            if new_key != key:
                try:
                    value["value"] = value.get("value") / 1000
                    description = value.get("description", "")

                    # Replace time units in descriptions using word boundaries
                    # \b works for spaces, punctuation, etc. but not underscores
                    description = re.sub(r"\bms\b", "s", description)
                    description = re.sub(r"\bmilliseconds\b", "seconds", description)
                    description = re.sub(r"\bMilliseconds\b", "Seconds", description)
                    # In case some metric names are present in description.
                    description = substitute_with_boundary(description, "ms", "s")

                    value["description"] = description
                    if self.verbose:
                        print(f"Converting {key} -> {new_key}")
                    key = new_key
                except Exception:
                    new_key = key

            new_metrics[new_key] = value
        entry.metrics = new_metrics
        return entry
