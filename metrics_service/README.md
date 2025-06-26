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

## API Documentation

Once the service is running, visit:
- Interactive API docs: http://localhost:8000/api/v1/docs
- Alternative docs: http://localhost:8000/api/v1/redoc

### Get Schema Information

Get information about available options and example values:

```bash
curl "http://localhost:8000/api/v1/table/schema"
curl "http://localhost:8000/api/v1/logs/schema"
curl "http://localhost:8000/api/v1/metrics/schema"
curl "http://localhost:8000/api/v1/graphs/schema"
```

## API Endpoints

### 1. Create Aggregation Table - POST /api/v1/table/aggregation

This endpoint creates an aggregation table from your metrics data based on the provided parameters.

There is also an endpoint for getting the visible data of the table in csv format: `POST /api/v1/table/aggregation_csv`

#### Basic Example

```bash
curl -X POST "http://localhost:8000/api/v1/table/aggregation" \
  -H "Content-Type: application/json" \
  -d '{
    "column_selections": [
      "/metadata/time_end_utc/max_value",
      "/metrics/"
    ]
  }'
```

#### Example with Filters and Strategy

```bash
curl -X POST "http://localhost:8000/api/v1/table/aggregation" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["runner:not_in:local"],
    "column_selections": [
      "/metadata/time_end_utc/max_value",
      "/metrics/performance/"
    ],
    "absent_metrics_strategy": "nullify"
  }'
```

#### Full Example with All Parameters

```bash
curl -X POST "http://localhost:8000/api/v1/table/aggregation" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["runner:not_in:local"],
    "slices": ["agent_name", "debug_mode"],
    "column_selections": [
      "/metadata/time_end_utc/max_value",
      "/metrics/"
    ],
    "column_selections_to_add": ["/metadata/time_end_utc"],
    "column_selections_to_remove": ["/metrics/api_calls/"],
    "sort_by_column": "performance/latency/env_run_s_all",
    "sort_order": "desc",
    "prune_mode": "column",
    "absent_metrics_strategy": "nullify",
    "slices_recommendation_strategy": "concise"
  }'
```

#### Response Structure

The response contains:
- `rows`: Table data with headers and values
- `column_tree`: Hierarchical structure of all available columns
- `columns`: List of selected columns with metadata
- `filters`: Applied filter conditions
- `slices`: Applied slice conditions
- `slice_recommendations`: Suggested additional slices
- `sorted_by`: Current sort column and order (if any)

Example response (truncated for clarity):

```json
{
  "rows": [
    [
      {"values": {}, "details": {}},
      {"values": {"value": "performance/api_time_percentage"}, "details": {"name": "performance/api_time_percentage", "description": "total_api_latency/total_env_run_time"}},
      {"values": {"value": "performance/completion_api_time_percentage"}, "details": {"name": "performance/completion_api_time_percentage", "description": "total_completion_api_latency/total_env_run_time"}}
    ],
    [
      {"values": {}, "details": {"framework": "nearai", "model_provider": "fireworks"}},
      {"values": {"value": 89.0025, "min_value": 27.0, "max_value": 99.95}, "details": {"value": 89.0025, "description": "total_api_latency/total_env_run_time", "min_value": 27.0, "max_value": 99.95, "n_samples": 32}},
      {"values": {"value": 25.809, "min_value": 0.0, "max_value": 72.53}, "details": {"value": 25.809, "description": "total_completion_api_latency/total_env_run_time", "min_value": 0.0, "max_value": 72.53, "n_samples": 32}}
    ]
  ],
  "column_tree": {
    "column_node_id": "/",
    "name": "/",
    "selection_state": "partial",
    "children": [...]
  },
  "columns": [
    {
      "column_id": "/metrics/performance/api_time_percentage",
      "name": "performance/api_time_percentage",
      "description": "total_api_latency/total_env_run_time",
      "unit": "numerical"
    }
  ],
  "filters": ["runner:not_in:local"],
  "slices": [],
  "slice_recommendations": ["runner", "debug_mode", "author", "user", "agent_name"],
  "sorted_by": null
}
```

**Understanding the Response**

*Row Structure*
- First row contains column headers
- Each subsequent row represents an aggregated entry
- First cell in each row contains metadata about the aggregation

*Cell Structure*

Each cell contains:
- `values`: The actual data values
  - `value`: Primary value
  - `min_value`: Minimum value in aggregation
  - `max_value`: Maximum value in aggregation
- `details`: Additional metadata
  - `n_samples`: Number of samples aggregated
  - `description`: Metric description
  - Other metadata fields

*Column Tree*

The `column_tree` shows all available columns in a hierarchical structure:
- `selection_state`: "all", "partial", or "none"
- `children`: Nested columns
- Use this to discover available metrics and fields

### 2. Create Evaluation Table - POST /api/v1/table/evaluation

This endpoint returns an evaluation table from available evaluation data, showing individual entries rather than aggregated data.

There is also an endpoint for getting the visible data of the table in csv format: `POST /api/v1/table/evaluation_csv`

#### Basic Example

```bash
curl -X POST "http://localhost:8000/api/v1/table/evaluation" \
  -H "Content-Type: application/json" \
  -d '{
    "column_selections": [
      "/metrics/livebench/"
    ]
  }'
```

#### Example with Filters and Sorting

```bash
curl -X POST "http://localhost:8000/api/v1/table/evaluation" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["organization:not_in:OpenAI"],
    "column_selections": [
      "/metrics/livebench/"
    ],
    "sort_by_column": "livebench/average",
    "sort_order": "desc"
  }'
```

### 3. List Logs - POST /api/v1/logs/list

The Logs API provides access to individual log entries with grouping and filtering capabilities. Unlike the Table API which focuses on aggregated metrics, the Logs API lets you examine individual runs and their associated log files. This endpoint processes metrics & log entries according to the provided parameters and returns formatted grouped logs in chronological order.


#### Basic Example

```bash
curl -X POST "http://localhost:8000/api/v1/logs/list" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["user:in:alomonos.near"]
  }'
```

#### Full Example with All Parameters

```bash
curl -X POST "http://localhost:8000/api/v1/logs/list" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["user:in:alomonos.near", "runner:not_in:local"],
    "groups": ["agent_name", "debug_mode"],
    "prune_mode": "all",
    "groups_recommendation_strategy": "concise"
  }'
```

#### Response Structure

The response contains:
- `groups`: Array of grouped entries, each containing:
  - `aggr_entry`: Aggregated metadata and metrics for the group
  - `entries`: Individual log entries in chronological order
- `group_recommendations`: Suggested additional grouping fields

Example response structure:

```json
{
  "groups": [
    {
      "aggr_entry": {
        "name": "aggregated",
        "metadata": {
          "agent_name": "example-logging-agent",
          "user": "alomonos.near",
          "time_begin_utc": {
            "min_value": "2025-05-23T03:29:06.323656+00:00",
            "max_value": "2025-05-23T04:24:14.806316+00:00",
            "n_samples": 7
          }
        },
        "metrics": {
          "performance/latency/env_run_s_all": {
            "value": 7.512857142857143,
            "description": "Total agent run time in seconds",
            "min_value": 3.25,
            "max_value": 13.38,
            "n_samples": 7
          }
        }
      },
      "entries": [
        {
          "name": "logs_alomonos.near_example-logging-agent_0.0.1_20250523_042414",
          "metadata": {
            "agent_name": "example-logging-agent",
            "user": "alomonos.near",
            "time_end_utc": "2025-05-23T04:24:24.341524+00:00",
            "debug_mode": false
          },
          "metrics": {
            "performance/latency/env_run_s_all": {
              "value": 9.54,
              "description": "Total agent run time in seconds"
            }
          },
          "log_files": []
        }
      ]
    }
  ],
  "group_recommendations": ["runner", "debug_mode"]
}
```

#### Log Files Example in Response

```json
"log_files": [
  {
    "filename": "system_log.txt",
    "description": "System output log",
    "content": ".."
  },
  {
    "filename": "chat_history_log.txt", 
    "description": "Chat history log",
    "content": ".."
  },
  {
    "filename": "agent_log.txt",
    "description": "Agent output log", 
    "content": ".."
  }
]
```

### 4. Get Important Metrics - POST /api/v1/metrics/important

This endpoint returns important metrics that are available in the dataset after applying filters. It helps identify which key performance metrics have data available for analysis.

#### Basic Example

```bash
curl -X POST "http://localhost:8000/api/v1/metrics/important" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": []
  }'
```

#### Example with Filters

```bash
curl -X POST "http://localhost:8000/api/v1/metrics/important" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["user:in:alomonos.near", "runner:not_in:local"]
  }'
```

#### Response Structure

The response returns a mapping of metric display names to tuples of `(additional_filters, field_name)` for metrics that are present in the data:

```json
{
  "Agent Invocations": [[], "time_end_utc/n_samples"],
  "Successful Invocations": [["errors/summary/error_count_all:range::0"], "time_end_utc/n_samples"],
  "Failed Invocations": [["errors/summary/error_count_all:range:1:"], "time_end_utc/n_samples"],
  "Avg Agent Latency": [[], "performance/latency/init_and_env_run_s_all"],
  "Max Agent Latency": [[], "performance/latency/init_and_env_run_s_all/max_value"],
  "Avg Runner Start Latency": [["runner:not_in:local"], "performance/latency/runner_latency_s"],
  "Max Runner Start Latency": [["runner:not_in:local"], "performance/latency/runner_latency_s/max_value"],
  "Avg Completion Latency": [[], "api_calls/inference_client_completions/latency_s_avg"],
  "Max Completion Latency": [[], "api_calls/inference_client_completions/latency_s_max/max_value"]
}
```

**Understanding the Response**

Each entry in the response contains:
- **Display Name**: Human-readable name for the metric (e.g., "Agent Invocations")
- **Additional Filters**: Array of additional filters applied when calculating this metric
- **Field Name**: The actual field path in the metrics data structure

**Predefined Important Metrics**

The endpoint checks for these predefined important metrics:
- **Agent Invocations** - Total number of agent invocations
- **Successful/Failed Invocations** - Successful and failed counts of agent invocations
- **Avg/Max Agent Latency** - Agent execution time statistics
- **Avg/Max Runner Start Latency** - Runner startup time statistics
- **Avg/Max Completion Latency** - Latency of model inference calls

Only metrics that have actual data present in the filtered dataset are returned.

### 5. Create Time Series Graph - POST /api/v1/graphs/time-series

This endpoint creates time series data for graphing from your metrics data based on moving aggregation parameters. It processes metrics entries to generate time-based aggregated values suitable for visualization.

#### Basic Example

```bash
curl -X POST "http://localhost:8000/api/v1/graphs/time-series" \
  -H "Content-Type: application/json" \
  -d '{
    "time_granulation": 86400000,
    "moving_aggregation_field_name": "performance/latency/env_run_s_all"
  }'
```

#### Example with Filters and Slicing

```bash
curl -X POST "http://localhost:8000/api/v1/graphs/time-series" \
  -H "Content-Type: application/json" \
  -d '{
    "time_granulation": 86400000,
    "moving_aggregation_field_name": "performance/latency/env_run_s_all",
    "global_filters": ["runner:not_in:local"],
    "moving_aggregation_filters": ["errors/summary/error_count_all:range::0"],
    "slice_field": "agent_name"
  }'
```

#### Response Structure

The response returns time series data with aggregated values:

```json
{
  "time_begin": 1672531200000,
  "time_end": 1672617600000,
  "time_granulation": 86400000,
  "field_name": "performance/latency/env_run_s_all",
  "slice_field": "agent_name",
  "slice_values": ["agent1", "agent2"],
  "values": [[1.2, 1.5, 1.8], [0.9, 1.1, 1.3]],
  "min_value": 0.9,
  "max_value": 1.8,
  "filters": ["errors/summary/error_count_all:range::0"]
}
```

**Understanding the Response**

- **time_begin/time_end**: Time range covered by the data in milliseconds
- **time_granulation**: Time interval between data points in milliseconds
- **field_name**: The metric field that was aggregated
- **slice_field**: Field used for data grouping (optional)
- **slice_values**: Values of the slice field (one array per slice)
- **values**: Nested arrays of aggregated values (one array per slice value)
- **min_value/max_value**: Overall minimum and maximum values in the dataset
- **filters**: Applied filter conditions

**Parameters**

- **time_granulation** (required): Time interval in milliseconds (e.g., 86400000 for 1 day)
- **moving_aggregation_field_name** (required): Field path to aggregate (supports subfields)
- **global_filters** (optional): Filters applied before aggregation
- **moving_aggregation_filters** (optional): Filters applied during aggregation
- **slice_field** (optional): Field for data grouping/slicing

## Parameters Reference

### Filter Format
Filters use the format: `field_name:operator:value`

Supported operators:
- `in`, `not_in` - Match against comma-separated values
  - Example: `agent_name:in:agent1,agent2,agent3`
  - Example: `runner:not_in:local`
- `range` - Numeric range filtering
  - Example: `value:range:10:100` (between 10 and 100)
  - Example: `value:range:10:` (minimum 10)
  - Example: `value:range::100` (maximum 100)
  - Example: `time_end_utc:range:(2025-05-23T11:48:26):` (time cutoff)

### Slice/Group Format
Slices aka groups support:

- Simple column names: `agent_name`
- Conditional slices: `runner:in:local`, `value:range:10:`

### Column Selection Format
Column selections use hierarchical paths:
- `/metadata/` - Select all metadata fields
- `/metrics/` - Select all metrics
- `/metrics/performance/` - Select all performance metrics
- `/metadata/agent_name` - Select specific field

### Prune Modes
Pruning heuristically determines which columns do not contain any useful information and removes them.
- `none` - No pruning
- `column` - Global pruning (prune if marked in all entries), use in table or logs api
- `all` - Individual pruning (prune metrics marked in each entry), use in logs api

### Absent Metrics Strategies
- `all_or_nothing` - Include metric only if present in all slice entries (safest)
- `nullify` - Replace missing metrics with 0 (use for metrics where absence means 0)
- `accept_subset` - Include even if only in some entries (use for new/optional metrics)

### Slices/Groups Recommendation Strategies
- `none` - No recommendations
- `first_alphabetical` - Recommend first alphabetical candidates
- `concise` - Recommend the most concise candidates
