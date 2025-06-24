"""Entry point for the metrics service.

This module allows the service to be run as a module:
    python -m metrics_service --metrics-path /path/to/metrics

Or through the poetry script:
    poetry run metrics-service --metrics-path /path/to/metrics
"""

import os
import sys
from pathlib import Path

# Add the src directory to Python path so we can import metrics_cli
src_path = Path(__file__).parent.parent
sys.path.insert(0, str(src_path))


def start_service():
    """Start the metrics service with uvicorn."""
    import uvicorn

    # Get configuration from environment variables
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "info").lower()

    # Get metrics path and validate
    metrics_path = os.getenv("METRICS_BASE_PATH")

    print("Starting Metrics Service...")
    print(f"Host: {host}:{port}")
    if metrics_path:
        print(f"Performance metrics path: {metrics_path}")
    else:
        print("Performance metrics path: Not configured (will be fetched from service URL when available)")
    print("Evaluation metrics: Stored locally in ~/.analytics/")
    print(f"Reload: {reload}")
    print(f"Log level: {log_level}")
    print(f"\nAPI documentation available at: http://{host}:{port}/api/v1/docs")

    # Check if metrics path exists but don't fail
    if metrics_path:
        if not Path(metrics_path).exists():
            print(f"\nWARNING: Performance metrics path does not exist: {metrics_path}")
            print("Performance metrics endpoints will return errors until path is available.")
            print("Service will continue to run with evaluation metrics only.")
        else:
            # List some stats about the metrics directory
            metrics_files = list(Path(metrics_path).rglob("*.json"))
            print(f"\nFound {len(metrics_files)} JSON files in performance metrics directory")
    else:
        print("\nNote: Performance metrics path not configured.")
        print("Performance metrics will be fetched from service URL when configured.")
        print("Evaluation metrics endpoints will still work normally.")

    # Run the service
    uvicorn.run(
        "metrics_service.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level=log_level,
    )


def main():
    """Main entry point."""
    # Don't call start_service() if we're just parsing arguments
    if len(sys.argv) > 1 and sys.argv[1] in ["--help", "-h"]:
        # Just show help without checking environment
        parser = create_parser()
        parser.print_help()
        sys.exit(0)

    # Parse arguments and start service
    args = parse_arguments()

    # Validate metrics path exists if provided (but don't fail)
    metrics_path = None
    if args.metrics_path:
        metrics_path = Path(args.metrics_path).resolve()
        if not metrics_path.exists():
            print(f"WARNING: Performance metrics path does not exist: {metrics_path}")
            print("Service will start but performance metrics endpoints will return errors.")
        elif not metrics_path.is_dir():
            print(f"WARNING: Performance metrics path is not a directory: {metrics_path}")
            print("Service will start but performance metrics endpoints will return errors.")

    # Set environment variables from arguments
    os.environ["HOST"] = args.host
    os.environ["PORT"] = str(args.port)
    if metrics_path:
        os.environ["METRICS_BASE_PATH"] = str(metrics_path)
    os.environ["RELOAD"] = "true" if args.reload else "false"
    os.environ["LOG_LEVEL"] = args.log_level

    # Start the service
    start_service()


def create_parser():
    """Create argument parser."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Analytics Metrics Service",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run service for development with local performance metrics
  poetry run metrics-service --metrics-path /Users/me/.nearai/logs

  # Run for production (performance metrics from service URL, evaluation metrics from local storage)
  poetry run metrics-service

  # Run with auto-reload for development
  poetry run metrics-service --metrics-path ./data --reload

  # Run on a different port
  poetry run metrics-service --port 8080

  # Run with debug logging
  poetry run metrics-service --log-level debug
        """,
    )

    # Optional argument
    parser.add_argument(
        "--metrics-path",
        required=False,
        default=os.getenv("METRICS_BASE_PATH"),
        help="Path to performance metrics data directory (optional, used for development only, or METRICS_BASE_PATH env var)",  # noqa: E501
        type=str,
    )

    # Optional arguments with environment variable defaults
    parser.add_argument(
        "--host",
        default=os.getenv("HOST", "127.0.0.1"),
        help="Host to bind to (default: 127.0.0.1 for localhost only, or HOST env var)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("PORT", "8000")),
        help="Port to bind to (default: 8000, or PORT env var)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        default=os.getenv("RELOAD", "false").lower() == "true",
        help="Enable auto-reload for development (watches for code changes, or RELOAD env var)",
    )
    parser.add_argument(
        "--log-level",
        choices=["critical", "error", "warning", "info", "debug"],
        default=os.getenv("LOG_LEVEL", "info"),
        help="Logging level (default: info, or LOG_LEVEL env var)",
    )

    return parser


def parse_arguments():
    """Parse command line arguments."""
    parser = create_parser()
    return parser.parse_args()


if __name__ == "__main__":
    main()
