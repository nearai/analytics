import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import agent_hosting, graphs, logs, metrics, table
from .utils.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Metrics Service",
        description="Service for processing and analyzing metrics data",
        version=settings.service_version,
        docs_url=f"{settings.api_prefix}/docs",
        redoc_url=f"{settings.api_prefix}/redoc",
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(table.router, prefix=settings.api_prefix)
    app.include_router(logs.router, prefix=settings.api_prefix)
    app.include_router(metrics.router, prefix=settings.api_prefix)
    app.include_router(graphs.router, prefix=settings.api_prefix)
    app.include_router(agent_hosting.router, prefix=settings.api_prefix)

    @app.on_event("startup")
    async def startup_event():
        """Initialize the service on startup."""
        logger.info(f"Starting {settings.service_name} v{settings.service_version}")

        if settings.has_metrics_path():
            logger.info(f"Performance metrics path: {settings.metrics_base_path}")
            # Verify metrics path exists but don't fail if it doesn't
            if not settings.metrics_base_path.exists():
                logger.warning(f"Performance metrics path does not exist: {settings.metrics_base_path}")
                logger.warning("Performance metrics endpoints will return errors until path is available.")
        elif settings.has_agent_hosting():
            agent_hosting_url, _ = settings.get_agent_hosting_config()
            logger.info(f"Agent hosting URL configured: {agent_hosting_url}")
            logger.info("Performance metrics will be fetched from agent hosting service.")
        else:
            logger.info("No performance metrics path configured.")
            logger.info("Performance metrics will be fetched from service URL when configured.")
            logger.info("Evaluation metrics (LiveBench) will still work from local storage.")

    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "service": settings.service_name,
            "version": settings.service_version,
            "api_docs": f"{settings.api_prefix}/docs",
        }

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "service": settings.service_name}

    return app


app = create_app()
