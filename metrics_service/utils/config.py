from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Service configuration
    service_name: str = "metrics-service"
    service_version: str = "0.1.0"

    # API configuration
    api_prefix: str = "/api/v1"

    # Data configuration
    metrics_base_path: Optional[Path] = None  # Will be set via environment variable
    
    # Agent hosting configuration
    agent_hosting_url: Optional[str] = None
    agent_hosting_api_key: Optional[str] = None

    # Server configuration
    host: str = "127.0.0.1"  # Default to localhost
    port: int = 8000

    # CORS settings
    cors_origins: list[str] = ["*"]

    class Config:
        """Pydantic config."""

        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_metrics_path(self) -> Path:
        """Get the metrics path, ensuring it's set."""
        if self.metrics_base_path is None:
            raise ValueError("METRICS_BASE_PATH is not set")
        return Path(self.metrics_base_path)

    def has_metrics_path(self) -> bool:
        """Check if metrics path is configured."""
        return self.metrics_base_path is not None

    def has_agent_hosting(self) -> bool:
        """Check if agent hosting is configured."""
        return self.agent_hosting_url is not None and self.agent_hosting_api_key is not None

    def get_agent_hosting_config(self) -> tuple[str, str]:
        """Get agent hosting URL and API key, ensuring they're set."""
        if not self.has_agent_hosting():
            raise ValueError("Agent hosting URL and API key are not both set")
        return self.agent_hosting_url, self.agent_hosting_api_key


settings = Settings()
