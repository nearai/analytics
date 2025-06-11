# Canonical Metrics

This directory contains tools and specifications for the standard metrics format used across NEAR AI analytics.

## Metrics Format

The canonical metrics format consists of two primary components:
1. `metrics.json` - Contains structured performance metrics and metadata
2. Log files - Raw logs and additional data from agent runs

### metrics.json Structure

The `metrics.json` file has two main sections:

```json
{
  "metadata": {
    // Information about the agent run
  },
  "metrics": {
    // Performance metrics
  }
}
```

#### Metadata Section

The `metadata` section contains all information about the logged entry. There are no required fields, but commonly included fields are:

- **Time Information**
  - `start_time_utc`: Start time in UTC
  - `end_time_utc`: End time in UTC
  - `start_time_local`: Start time in local timezone
  - `end_time_local`: End time in local timezone

- **Model Information**
  - `model`: Name of the model used (e.g., "claude-3-opus-20240229")
  - `model_provider`: Provider of the model (e.g., "anthropic", "openai")
  - `model_temperature`: Temperature setting used for generation
  - Additional model parameters as needed

- **Execution Environment**
  - `runner`: Information about the execution environment
  - `framework`: Framework used (e.g., "langchain", "custom")

- **User Information**
  - `author`: Creator of the agent
  - `user`: User who ran the agent

- **Financial Information**
  - `pricing`: Cost information (must be entered manually as it's not provided by APIs)

- **Files**
  - Array of files associated with this run, each containing:
    - `filename`: Name of the log file
    - `description`: Description of what the file contains

Example:

```json
"metadata": {
  "agent_name": "example_agent",
  "agent_version": "0.0.1",
  "author": "developer@near.ai",
  "debug_mode": true,
  "files": [
    {
      "description": "Raw agent output log",
      "filename": "agent_log.txt"
    },
    {
      "description": "Detailed timing information", 
      "filename": "timing_data.json"
    }
  ],
  "framework": "langchain",
  "model": "claude-3-opus-20240229",
  "model_provider": "anthropic",
  "model_temperature": 0.7,
  "runner": "nearai-hub",
  "time_begin_utc": "2025-05-23T05:04:49.351140+00:00",
  "time_begin_local": "2025-05-23T05:04:49.351145",
  "time_end_utc": "2025-05-23T05:04:59.790817+00:00",
  "time_end_local": "2025-05-23T05:04:59.790822",
  "user": "developer@near.ai"
}
```

#### Metrics Section

The `metrics` section contains the actual performance metrics. Each metric:

- Has a key in the format `category/subcategory/metric_name` (with arbitrary nesting depth)
- Has a value
- Has a description explaining what the metric measures

Example:

```json
"metrics": {
  "performance/latency/first_token_ms": {
    "value": 235,
    "description": "Time to first token in milliseconds"
  },
  "performance/latency/total_ms": {
    "value": 1820,
    "description": "Total response time in milliseconds"
  },
  "accuracy/answer_correctness": {
    "value": 0.87,
    "description": "Fraction of questions answered correctly"
  },
  "resources/tokens/prompt": {
    "value": 1240,
    "description": "Number of prompt tokens used"
  },
  "resources/tokens/completion": {
    "value": 380,
    "description": "Number of completion tokens generated"
  }
}
```

## Installation

```bash
python3.11 -m venv .venv
. .venv/bin/activate
pip install poetry
poetry install
```

## Run metrics-cli

```bash
metrics-cli --help
metrics-cli -v rename /Users/me/.nearai/logs  /Users/me/.nearai/clean_logs
metrics-cli -v ms_to_s /Users/me/.nearai/clean_logs  /Users/me/.nearai/clean_logs
metrics-cli round /Users/me/.nearai/clean_logs  /Users/me/.nearai/clean_logs
metrics-cli tune /Users/me/.nearai/logs  /Users/me/.nearai/tuned_logs --rename --ms-to-s
metrics-cli aggregate /Users/me/.nearai/tuned_logs /Users/me/.nearai/aggr_logs --filters "runner:not_in:local" --slices "agent_name;debug_mode" --absent-metrics-strategy=nullify --prune=all
metrics-cli aggregation-table /Users/me/.nearai/tuned_logs /Users/me/.nearai/table --filters "runner:not_in:local" --absent-metrics-strategy=nullify
```

## Run metrics-service

```bash
metrics-service --help
metrics-service --metrics-path /Users/me/.nearai/tuned_logs
```

# Table API Usage Examples

## Starting the Service

```bash
# Run the service
poetry run metrics-service --metrics-path /Users/me/.nearai/tuned_logs

# Or with additional options
poetry run metrics-service --metrics-path /Users/me/.nearai/tuned_logs --port 8080 --reload
```

### API Documentation

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

### 2. List Logs - POST /api/v1/logs/list

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

### 3. Get Important Metrics - POST /api/v1/metrics/important

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

### 4. Create Time Series Graph - POST /api/v1/graphs/time-series

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
