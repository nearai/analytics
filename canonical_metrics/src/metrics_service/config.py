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


settings = Settings()
