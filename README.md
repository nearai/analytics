# AI Agent Analytics

A collection of tools for benchmarking, evaluating, and analyzing agent performance metrics.

## Repository Structure

- [`/benchmarks`](./benchmarks/): Tools for running benchmarks on AI models and agents
- [`/canonical_metrics`](./canonical_metrics/): Standard formats and tools for metrics collection, including:
  - Metrics CLI for processing and transforming metrics
  - Metrics Service API for querying and visualizing metrics data
- [`/dashboard`](./dashboard/): Analytics Dashboard
- [`/evaluation`](./evaluation/): Tools for evaluating agent or model performance

## Primary Use Cases

### 1. Collect Metrics from Agent Runs

[How to collect logs from NEAR AI Hub](./integrations/nearai_registry/download_logs/)

### 2. [Process Metrics](./canonical_metrics/README.md#run-metrics-cli)

Transform, tune, aggregate, create csv table.

```bash
# Installation
cd canonical_metrics
python3.11 -m venv .venv
source .venv/bin/activate
pip install poetry
poetry install

# Transform and aggregate metrics
metrics-cli tune /path/to/logs /path/to/tuned_logs --rename --ms-to-s
metrics-cli aggregate /path/to/tuned_logs /path/to/aggr_logs --filters "runner:not_in:local" --slices "agent_name"
metrics-cli aggregation-table /Users/me/.nearai/tuned_logs /Users/me/.nearai/table --filters "runner:not_in:local" --absent-metrics-strategy=nullify
```

### 3. [Query Metrics via API](./canonical_metrics/README.md#api-endpoints)

Run the metrics service to query and analyze metrics data:

```bash
# Start the metrics service
metrics-service --metrics-path /path/to/tuned_logs

# Query metrics via API
curl -X POST "http://localhost:8000/api/v1/table/aggregation" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["runner:not_in:local"],
    "column_selections": ["/metrics/performance/"]
  }'
```

### 3a. 🐳 [Run with Docker](./DOCKER.md)

The easiest way to run the metrics service with automated LiveBench data:

```bash
# Quick start with Docker Compose
docker compose up -d

# Access the service
open http://localhost:8000/api/v1/docs
```

This provides:
- ✅ Automated LiveBench leaderboard scraping on startup and daily
- ✅ Persistent data storage
- ✅ Health monitoring and auto-restart

### 4. [Run Dashboard](./dashboard/)

Run a web application for querying and visualizing analytics metrics data. Features comprehensive views for time series analysis, data tables, and chronological logs.

```bash
cd dashboard
npm install
npm start
```
Will open a dashboard at `http://localhost:3000`

The dashboard can also be used as a web component in other applications:

```bash
npm install @nearai/analytics-dashboard
```

```jsx
import { Dashboard } from '@nearai/analytics-dashboard';

// Use with configuration
<Dashboard config={{
  views: ['timeseries', 'table', 'model_comparison', 'error_logs'],
  globalFilters: ['runner:not_in:local'], // Applied to all requests
  viewConfigs: {
    timeseries: {
      view_type: 'timeseries',
      view_name: 'Time Series',
      metricSelection: 'PERFORMANCE',
      defaultParameters: {
        time_filter: '1 month',
        time_granulation: '1 day'
      },
      timeFilterRecommendations: ['last hour', 'last day', 'last week', 'last month', 'last year'],
      refreshRate: 30 // Refresh every 30 seconds
    },
    table: {
      view_type: 'table',
      view_name: 'Table',
      metricSelection: 'CUSTOM',
      showParameters: ['prune_mode'], // Show only specific parameters
      refreshRate: 30 // Refresh every 30 seconds
    },
    model_comparison: {
      view_type: 'table',
      view_name: 'Compare Models',
      metricSelection: 'COMPARE_MODELS',
      refreshRate: undefined // No refreshing
    },
    logs_errors: {
      view_type: 'logs',
      view_name: 'Error Logs',
      metricSelection: 'ERROR',
      timeFilterRecommendations: []  // Default: disable
    }
  }
}} />
```

### 5. Run Benchmarks and Evaluations

Execute popular and user-owned benchmarks to generate performance metrics. Run audit evaluations on agents.

### 6. [Run Evaluation Dashboard](https://github.com/nearai/analytics/tree/main/dashboard#6-compare-models)

Visualize, analyze, and compare agent & model performances using the collected metrics.

## Key Features

- **🐳 Docker Support**: One-command deployment with automated LiveBench data scraping
- **Canonical Metrics Format**: Standardized format for consistent metrics across all agents
- **Flexible Aggregation**: Group and aggregate metrics by various dimensions
- **Powerful Filtering**: Filter metrics by runner, model, time ranges, and custom criteria
- **RESTful API**: Easy integration with dashboards and other tools
- **Performance Tracking**: Monitor latency, API usage, error rates, and custom metrics

## Contributing

We welcome contributions! See individual component READMEs for specific development guidelines.
