"""Base processor class for metrics transformations."""

import re
from abc import ABC, abstractmethod
from typing import List

from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry


def substitute_with_boundary(text: str, old_word: str, new_word: str) -> str:
    """Replace old_word with new_word, preserving boundary characters."""
    pattern = rf"(^|[_/])({re.escape(old_word)})(?=[_/]|$)"
    return re.sub(pattern, rf"\1{new_word}", text)


class BaseConversion(ABC):
    """Abstract base class to convert collections of metrics."""

    def __init__(self):  # noqa: D107
        self.description = self.__class__.__name__

    @abstractmethod
    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:  # noqa: D102
        pass


class ChainConversion(BaseConversion):
    """Conversion that chains multiple conversions together."""

    def __init__(self, processors: list[BaseConversion]):  # noqa: D107
        super().__init__()
        self.processors = processors
        self.description = "Chain: " + " → ".join(p.description for p in processors)

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:
        """Apply all processors in sequence."""
        result = data
        for processor in self.processors:
            result = processor.convert(result)
        return result
