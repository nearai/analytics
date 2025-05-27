from enum import Enum
from typing import Any, Dict


class MetadataFieldCategory(Enum):
    """Metadata field categories."""

    TIMESTAMP = "timestamp"
    UNIQUE = "unique"
    GROUP = "group"
    SAME = "same"


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
    if not v:
        # Split by field_name /, remove last part
        if "/" in field_name:
            splits = field_name.split("/")
            parent_field = "/".join(splits[:-1])
            subfield = splits[-1]
            parent_data = data.get(parent_field)
            if isinstance(parent_data, dict):
                return parent_data.get(subfield)
        return None
    if isinstance(v, dict):
        v = v.get("value")
    return v
