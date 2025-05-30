# NEAR AI Analytics

A collection of tools for benchmarking, evaluating, and analyzing agent performance metrics.

## Repository Structure

- [`/benchmarks`](./benchmarks/): Tools for running benchmarks on AI models and agents
- [`/canonical_metrics`](./canonical_metrics/): Standard formats and tools for metrics collection, including:
  - Metrics CLI for processing and transforming metrics
  - Metrics Service API for querying and visualizing metrics data
- [`/evaluation`](./evaluation/): Dashboard and tools for evaluating agent or model performance
- [`/historic_performance`](./historic_performance/): Dashboard for tracking performance over time

## Primary Use Cases

### 1. Collect Metrics from Agent Runs

[How to collect logs from NEAR AI Hub](./integrations/nearai_registry/download_logs/)

### 2. [Process Metrics](./canonical_metrics/README.md#run-metrics-cli)

Transform, tune, aggregate, create csv table.

```bash
# Transform and aggregate metrics
metrics-cli tune /path/to/logs /path/to/tuned_logs --rename --ms-to-s
metrics-cli aggregate /path/to/tuned_logs /path/to/aggr_logs --filters "runner:not_in:local" --slices "agent_name"
metrics-cli table /Users/me/.nearai/tuned_logs /Users/me/.nearai/table --filters "runner:not_in:local" --absent-metrics-strategy=nullify
```

### 3. [Query Metrics via API](./canonical_metrics/README.md#api-endpoints)

Run the metrics service to query and analyze metrics data:

```bash
# Start the metrics service
metrics-service --metrics-path /path/to/tuned_logs

# Query metrics via API
curl -X POST "http://localhost:8000/api/v1/table/create" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["runner:not_in:local"],
    "column_selections": ["/metrics/performance/"]
  }'
```

### 4. Run Benchmarks and Evaluations

Execute popular and user-owned benchmarks to generate performance metrics. Run audit evaluations on agents.

### 5. Run Evaluation Dashboard

Visualize, analyze, and compare agent & model performances using the collected metrics.

### 6. Run Historic Performance Dashboard

Track agent performance over time to identify trends and regressions.

## Quick Start

1. **Install dependencies**:
   ```bash
   cd canonical_metrics
   python3.11 -m venv .venv
   source .venv/bin/activate
   pip install poetry
   poetry install
   ```

2. **Process metrics**:
   ```bash
   # Clean and transform metrics
   metrics-cli tune /path/to/raw/logs /path/to/processed/logs --rename --ms-to-s
   ```

3. **Start the API service**:
   ```bash
   metrics-service --metrics-path /path/to/processed/logs
   ```

4. **Access the API**:
   - API Documentation: http://localhost:8000/api/v1/docs
   - Query metrics programmatically or via the dashboard

## Key Features

- **Canonical Metrics Format**: Standardized format for consistent metrics across all agents
- **Flexible Aggregation**: Group and aggregate metrics by various dimensions
- **Powerful Filtering**: Filter metrics by runner, model, time ranges, and custom criteria
- **RESTful API**: Easy integration with dashboards and other tools
- **Performance Tracking**: Monitor latency, API usage, error rates, and custom metrics

## Contributing

We welcome contributions! See individual component READMEs for specific development guidelines.
