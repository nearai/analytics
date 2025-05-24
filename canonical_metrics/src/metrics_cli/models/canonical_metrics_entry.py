from typing import Any, Dict


class CanonicalMetricsEntry:
    """The canonical metrics entry containing metrics and logs."""

    def __init__(self, name: str, metadata: Dict[str, Any], metrics: Dict[str, Any]):  # noqa: D107
        self.name = name
        self.metadata = metadata
        self.metrics = metrics

    def to_dict(self) -> Dict[str, Any]:
        """{"metadata": {..}, "metrics": {..}}."""
        return {"metadata": self.metadata, "metrics": self.metrics}

    def fetch_value(self, field_name: str) -> Any:
        """Fetch value for `field_name`."""
        v = fetch_value(self.metadata, field_name)
        if not v:
            v = fetch_value(self.metrics, field_name)
        return v


def fetch_value(data: Dict[str, Any], field_name: str) -> Any:
    """Fetch value for `field_name` from `data`."""
    v = data.get(field_name)
    if isinstance(v, dict):
        v = v.get("value")
    return v
