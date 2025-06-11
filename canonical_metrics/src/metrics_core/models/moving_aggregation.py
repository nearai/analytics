from dataclasses import dataclass, field
from typing import List

from metrics_core.models.condition import Condition


@dataclass
class MovingAggregation:
    """A data class for time series graphs."""

    time_begin: int
    time_end: int
    time_granulation: int
    # A field name (can be subfield) used to calculate moving aggregation values
    field_name: str
    # One row if no slice field, otherwise, one for each slice value
    values: List[List[float]]
    min_value: float
    max_value: float
    # List of filter conditions used to calculate moving aggregation values
    filters: List[Condition] = field(default_factory=list)
    # Optional slice field
    slice_field: str = ""
    slice_values: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert the MovingAggregation instance to a dictionary."""
        return {
            "time_begin": self.time_begin,
            "time_end": self.time_end,
            "time_granulation": self.time_granulation,
            "filters": [str(f) for f in self.filters],
            "field_name": self.field_name,
            "slice_field": self.slice_field,
            "slice_values": self.slice_values,
            "values": self.values,
            "min_value": self.min_value,
            "max_value": self.max_value,
        }
