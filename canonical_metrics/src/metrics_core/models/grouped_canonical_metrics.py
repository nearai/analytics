from dataclasses import dataclass, field
from typing import Any, Dict, List

from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry


@dataclass
class GroupedCanonicalMetrics:
    """Grouped Canonical Metrics."""

    aggr_entry: CanonicalMetricsEntry
    entries: List[CanonicalMetricsEntry]

    def to_dict(self) -> Dict[str, Any]:  # noqa: D102
        return {"aggr_entry": self.aggr_entry, "entries": self.entries}


@dataclass
class GroupedCanonicalMetricsList:
    """Grouped Canonical Metrics List."""

    groups: List[GroupedCanonicalMetrics]
    # List of recommended group field names
    group_recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:  # noqa: D102
        return {"groups": self.groups, "group_recommendations": self.group_recommendations}
