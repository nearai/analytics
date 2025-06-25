# Metrics Service

FastAPI-based web service for analytics metrics.

## Overview

This package provides a web service for:

- **Performance Metrics**: Serving performance metrics data via REST API
- **Evaluation Metrics**: Serving evaluation metrics and tables
- **Table API**: Creating and serving aggregation and evaluation tables
- **Graph API**: Providing graph data for visualization
- **Log Access**: Serving log files and detailed metric information

## Installation

```bash
pip install -e .
```

## Usage

```bash
# Run service for development with local performance metrics
metrics-service --metrics-path /Users/me/.nearai/logs

# Run for production (performance metrics from service URL, evaluation metrics from local storage)
metrics-service

# Run with auto-reload for development
metrics-service --metrics-path ./data --reload

# Run on a different port
metrics-service --port 8080

# Run with debug logging
metrics-service --log-level debug
```

## Configuration

The service can be configured via environment variables:

- `METRICS_BASE_PATH`: Path to performance metrics data directory
- `HOST`: Host to bind to (default: 127.0.0.1)
- `PORT`: Port to bind to (default: 8000)
- `RELOAD`: Enable auto-reload for development (default: false)
- `LOG_LEVEL`: Logging level (default: info)

## API Endpoints

- `GET /api/v1/metrics/`: List available metrics
- `GET /api/v1/metrics/{metric_id}`: Get specific metric data
- `POST /api/v1/table/aggregation`: Create aggregation table
- `POST /api/v1/table/evaluation`: Create evaluation table
- `GET /api/v1/graphs/`: Get graph data
- `GET /api/v1/logs/{log_id}`: Get log file content

## Dependencies

This package depends on:
- `metrics_core` for core utilities and data structures
- `evaluation` for evaluation-specific functionality
- `fastapi` for the web framework
- `uvicorn` for ASGI server
- `pydantic` for data validation