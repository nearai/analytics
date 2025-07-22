"""In-memory cache for metrics entries."""

import logging
import time
from pathlib import Path
from threading import Lock
from typing import List, Optional

from metrics_core.agent_hosting_analytics import (
    fetch_agent_hosting_analytics_data,
    process_agent_hosting_analytics_data,
)
from metrics_core.local_files import load_logs_list_from_disk
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.service_models.agent_hosting_models import AgentHostingAnalytics

logger = logging.getLogger(__name__)


class MetricsCache:
    """In-memory cache for metrics entries to avoid repeated disk reads."""

    # Cache refresh threshold for agent hosting data (15 seconds)
    AGENT_HOSTING_CACHE_REFRESH_SECONDS = 15

    def __init__(self):
        """Initialize the metrics cache."""
        self._entries: Optional[List[CanonicalMetricsEntry]] = None
        self._agent_hosting_analytics: Optional[AgentHostingAnalytics] = None
        self._lock = Lock()
        self._metrics_path: Optional[Path] = None
        self._agent_hosting_config: Optional[tuple[str, str]] = None
        self._agent_hosting_last_loaded: Optional[float] = None

    def load_entries_from_disk(
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
                self._agent_hosting_analytics = None  # Clear agent hosting analytics when loading from disk
                self._metrics_path = metrics_path
                self._agent_hosting_config = None  # Clear agent hosting config when loading from disk
                self._agent_hosting_last_loaded = None  # Clear agent hosting timestamp when loading from disk
                logger.info(f"Loaded {len(self._entries)} entries into cache")
            else:
                logger.debug(f"Using cached entries: {len(self._entries)} entries")

            return self._entries.copy()  # Return a copy to prevent external modifications

    def _is_agent_hosting_cache_stale(self) -> bool:
        """Check if the agent hosting cache is stale (older than 15 seconds).

        Returns
        -------
            True if cache is stale or doesn't exist, False otherwise

        """
        if self._agent_hosting_last_loaded is None:
            return True
        return time.time() - self._agent_hosting_last_loaded > self.AGENT_HOSTING_CACHE_REFRESH_SECONDS

    def load_entries_from_agent_hosting(
        self,
        agent_hosting_url: str,
        agent_hosting_api_key: str,
        force_reload: bool = False,
        verbose: bool = False,
    ) -> List[CanonicalMetricsEntry]:
        """Load entries from agent hosting service.

        Args:
        ----
            agent_hosting_url: URL of the agent hosting service
            agent_hosting_api_key: API key for the agent hosting service
            force_reload: Force reload from service even if cache exists
            verbose: Enable verbose logging

        Returns:
        -------
            List of canonical metrics entries

        """
        with self._lock:
            current_config = (agent_hosting_url, agent_hosting_api_key)

            # Check if we need to load from agent hosting service
            if self._entries is None or force_reload or self._agent_hosting_config != current_config:
                logger.info(f"Loading metrics entries from agent hosting service: {agent_hosting_url}")

                # Fetch data from agent hosting service
                raw_data = fetch_agent_hosting_analytics_data(agent_hosting_url, agent_hosting_api_key, verbose)

                # Process the data to get analytics entries
                agent_hosting_analytics = process_agent_hosting_analytics_data(raw_data, verbose)

                self._entries = agent_hosting_analytics.entries
                self._agent_hosting_analytics = agent_hosting_analytics
                self._agent_hosting_config = current_config
                self._metrics_path = None  # Clear metrics path when loading from agent hosting
                self._agent_hosting_last_loaded = time.time()  # Record when data was loaded
                logger.info(f"Loaded {len(self._entries)} entries from agent hosting service into cache")
            else:
                logger.debug(f"Using cached agent hosting entries: {len(self._entries)} entries")

            return self._entries.copy()  # Return a copy to prevent external modifications

    def clear_cache(self):
        """Clear the cache, forcing next load to read from disk."""
        with self._lock:
            self._entries = None
            self._agent_hosting_analytics = None
            self._metrics_path = None
            self._agent_hosting_config = None
            self._agent_hosting_last_loaded = None
            logger.info("Cache cleared")

    def is_cached(self, metrics_path: Path) -> bool:
        """Check if entries for the given path are cached."""
        with self._lock:
            return self._entries is not None and self._metrics_path == metrics_path

    def is_agent_hosting_cached(self, agent_hosting_url: str, agent_hosting_api_key: str) -> bool:
        """Check if entries for the given agent hosting config are cached."""
        with self._lock:
            return self._entries is not None and self._agent_hosting_config == (
                agent_hosting_url,
                agent_hosting_api_key,
            )

    @property
    def cache_size(self) -> int:
        """Get the number of cached entries."""
        with self._lock:
            return len(self._entries) if self._entries else 0

    def load_entries_from_config(
        self, force_reload: bool = False, verbose: bool = False
    ) -> List[CanonicalMetricsEntry]:
        """Load entries based on current configuration (settings).

        This method automatically determines whether to load from local files or agent hosting
        based on the current settings configuration.

        Args:
        ----
            force_reload: Force reload even if cache exists
            verbose: Enable verbose logging for agent hosting

        Returns:
        -------
            List of canonical metrics entries

        Raises:
        ------
            HTTPException: If no data source is configured

        """
        from fastapi import HTTPException

        from metrics_service.utils.config import settings

        if settings.has_agent_hosting():
            agent_hosting_url, agent_hosting_api_key = settings.get_agent_hosting_config()
            # Check if we need to auto-refresh due to stale cache
            auto_refresh = self._is_agent_hosting_cache_stale()
            effective_force_reload = force_reload or auto_refresh
            return self.load_entries_from_agent_hosting(
                agent_hosting_url, agent_hosting_api_key, effective_force_reload, verbose
            )
        elif settings.has_metrics_path():
            metrics_path = settings.get_metrics_path()
            return self.load_entries_from_disk(metrics_path, force_reload)
        else:
            raise HTTPException(
                status_code=503,
                detail="No data source configured. Set either METRICS_BASE_PATH or both AGENT_HOSTING_URL and AGENT_HOSTING_API_KEY.",  # noqa: E501
            )

    def get_agent_hosting_analytics(
        self, force_reload: bool = False, verbose: bool = False
    ) -> Optional[AgentHostingAnalytics]:
        """Get agent hosting analytics data.

        Args:
        ----
            force_reload: Force reload even if cache exists
            verbose: Enable verbose logging for agent hosting

        Returns:
        -------
            AgentHostingAnalytics object if agent hosting is configured, None otherwise

        """
        from metrics_service.utils.config import settings

        if not settings.has_agent_hosting():
            return None

        # Check if we need to auto-refresh due to stale cache
        auto_refresh = self._is_agent_hosting_cache_stale()
        effective_force_reload = force_reload or auto_refresh

        # Load entries to ensure agent hosting analytics is cached
        self.load_entries_from_config(effective_force_reload, verbose)

        with self._lock:
            return self._agent_hosting_analytics


# Global cache instance
metrics_cache = MetricsCache()
