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
    assert metrics_path

    print("Starting Metrics Service...")
    print(f"Host: {host}:{port}")
    print(f"Metrics path: {metrics_path}")
    print(f"Reload: {reload}")
    print(f"Log level: {log_level}")
    print(f"\nAPI documentation available at: http://{host}:{port}/api/v1/docs")

    # Check if metrics path exists
    if not Path(metrics_path).exists():
        print(f"\nERROR: Metrics path does not exist: {metrics_path}")
        print("Please provide a valid path to your metrics data.")
        sys.exit(1)
    else:
        # List some stats about the metrics directory
        metrics_files = list(Path(metrics_path).rglob("*.json"))
        print(f"\nFound {len(metrics_files)} JSON files in metrics directory")

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
    # If no arguments provided, show help
    if len(sys.argv) == 1:
        sys.argv.append("--help")

    # Don't call start_service() if we're just parsing arguments
    if len(sys.argv) > 1 and sys.argv[1] in ["--help", "-h"]:
        # Just show help without checking environment
        parser = create_parser()
        parser.print_help()
        sys.exit(0)

    # Parse arguments and start service
    args = parse_arguments()

    # Validate metrics path exists
    metrics_path = Path(args.metrics_path).resolve()
    if not metrics_path.exists():
        print(f"ERROR: Metrics path does not exist: {metrics_path}")
        sys.exit(1)

    if not metrics_path.is_dir():
        print(f"ERROR: Metrics path is not a directory: {metrics_path}")
        sys.exit(1)

    # Set environment variables from arguments
    os.environ["HOST"] = args.host
    os.environ["PORT"] = str(args.port)
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
  # Run service with metrics from a specific directory
  poetry run metrics-service --metrics-path /Users/me/.nearai/logs

  # Run with auto-reload for development
  poetry run metrics-service --metrics-path ./data --reload

  # Run on a different port
  poetry run metrics-service --metrics-path ./data --port 8080

  # Run with debug logging
  poetry run metrics-service --metrics-path ./data --log-level debug
        """,
    )

    # Required argument
    parser.add_argument(
        "--metrics-path",
        required=True,
        help="Path to metrics data directory (required)",
        type=str,
    )

    # Optional arguments with localhost-friendly defaults
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1 for localhost only)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to (default: 8000)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development (watches for code changes)",
    )
    parser.add_argument(
        "--log-level",
        choices=["critical", "error", "warning", "info", "debug"],
        default="info",
        help="Logging level (default: info)",
    )

    return parser


def parse_arguments():
    """Parse command line arguments."""
    parser = create_parser()
    return parser.parse_args()


if __name__ == "__main__":
    main()
