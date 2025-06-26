"""Data loading utilities for evaluation."""

from pathlib import Path
from typing import List

from metrics_core.local_files import load_logs_list_from_disk
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry

LIVEBENCH_LEADERBOARD_PATH = "~/.analytics/livebench/leaderboard"


def load_evaluation_entries() -> List[CanonicalMetricsEntry]:
    """Load evaluation entries from the standard livebench leaderboard path."""
    return load_logs_list_from_disk(Path(LIVEBENCH_LEADERBOARD_PATH).expanduser())
