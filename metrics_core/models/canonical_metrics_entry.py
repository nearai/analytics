from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List


class MetadataFieldCategory(Enum):
    """Metadata field categories."""

    TIMESTAMP = "timestamp"
    UNIQUE = "unique"
    GROUP = "group"
    SAME = "same"


@dataclass
class CanonicalMetricsEntry:
    """The canonical metrics entry containing metrics and logs."""

    name: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, Any] = field(default_factory=dict)
    # Log files. By default, these are not loaded, and should only be loaded by metrics service when actually needed.
    log_files: List[Dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """{"metadata": {..}, "metrics": {..}, "log_files": [{"filename": "..", "content": "..", ..}, ...]}."""
        return {"metadata": self.metadata, "metrics": self.metrics, "log_files": self.log_files}

    def fetch_value(self, field_name: str) -> Any:
        """Fetch value for `field_name`."""
        v = fetch_value(self.metadata, field_name)
        if v is None:
            v = fetch_value(self.metrics, field_name)
        return v

    def flatten_values(self) -> None:
        """Flatten values of fields.

        If a field value only contains "value" field,
        flatten field value to the value of "value" field.
        """
        self.metadata = flatten_values(self.metadata)
        self.metrics = flatten_values(self.metrics)

    def remove_subfields(self, subfields_to_remove: List[str]) -> None:
        """Remove `subfields_to_remove` from `self.metadata` and `self.metrics`."""
        remove_subfields(self.metadata, subfields_to_remove)
        remove_subfields(self.metrics, subfields_to_remove)


def fetch_value(data: Dict[str, Any], field_name: str) -> Any:
    """Fetch value for `field_name` from `data`."""
    v = data.get(field_name)
    if v is None:
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


def flatten_values(fields: Dict[str, Any]) -> Dict[str, Any]:
    """If a field value only contains "value" field, flatten field value to the value of "value" field."""
    contracted_fields = {}

    for field_name, field_data in fields.items():
        if isinstance(field_data, dict):
            # Check if this dict only contains a "value" key
            if len(field_data) == 1 and "value" in field_data:
                # Contract: replace the dict with just the value
                contracted_fields[field_name] = field_data["value"]
            else:
                # Keep the original structure
                contracted_fields[field_name] = field_data
        else:
            # Not a dict, keep as-is
            contracted_fields[field_name] = field_data

    return contracted_fields


def remove_subfields(fields: Dict[str, Any], subfields_to_remove: List[str]) -> None:
    """Remove `subfields_to_remove` from `fields`."""
    for field_data in fields.values():
        if isinstance(field_data, dict):
            for subfield in subfields_to_remove:
                field_data.pop(subfield, None)
