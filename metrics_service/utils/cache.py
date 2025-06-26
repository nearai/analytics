"""In-memory cache for metrics entries."""

import logging
from pathlib import Path
from threading import Lock
from typing import List, Optional

from metrics_core.local_files import load_logs_list_from_disk
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry

logger = logging.getLogger(__name__)


class MetricsCache:
    """In-memory cache for metrics entries to avoid repeated disk reads."""

    def __init__(self):
        """Initialize the metrics cache."""
        self._entries: Optional[List[CanonicalMetricsEntry]] = None
        self._lock = Lock()
        self._metrics_path: Optional[Path] = None

    def load_entries(
        self,
        metrics_path: Path,
        force_reload: bool = False,
    ) -> List[CanonicalMetricsEntry]:
        """Load entries from cache or disk.

        Args:
        ----
            metrics_path: Path to metrics directory
            force_reload: Force reload from disk even if cache exists

        Returns:
        -------
            List of canonical metrics entries

        """
        with self._lock:
            # Check if we need to load from disk
            if self._entries is None or force_reload or self._metrics_path != metrics_path:
                logger.info(f"Loading metrics entries from disk: {metrics_path}")
                self._entries = load_logs_list_from_disk(metrics_path, include_log_files=True)
                self._metrics_path = metrics_path
                logger.info(f"Loaded {len(self._entries)} entries into cache")
            else:
                logger.debug(f"Using cached entries: {len(self._entries)} entries")

            return self._entries.copy()  # Return a copy to prevent external modifications

    def clear_cache(self):
        """Clear the cache, forcing next load to read from disk."""
        with self._lock:
            self._entries = None
            self._metrics_path = None
            logger.info("Cache cleared")

    def is_cached(self, metrics_path: Path) -> bool:
        """Check if entries for the given path are cached."""
        with self._lock:
            return self._entries is not None and self._metrics_path == metrics_path

    @property
    def cache_size(self) -> int:
        """Get the number of cached entries."""
        with self._lock:
            return len(self._entries) if self._entries else 0


# Global cache instance
metrics_cache = MetricsCache()
