from dataclasses import dataclass, field
from typing import Any, Dict, List

from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry


@dataclass
class AgentHostingAnalytics:
    """Analytics for agent hosting service."""

    entries: List[CanonicalMetricsEntry] = field(default_factory=list)
    agents: List[Dict[str, Any]] = field(default_factory=list)
    instances: List[Dict[str, Any]] = field(default_factory=list)
