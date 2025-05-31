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
metrics-cli table /Users/me/.nearai/tuned_logs /Users/me/.nearai/table --filters "runner:not_in:local" --absent-metrics-strategy=nullify
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

## API Endpoints

### 1. Create Table - POST /api/v1/table/create

This endpoint creates a table from your metrics data based on the provided parameters.

#### Basic Example

```bash
curl -X POST "http://localhost:8000/api/v1/table/create" \
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
curl -X POST "http://localhost:8000/api/v1/table/create" \
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

#### Full Example with All Parameters

```bash
curl -X POST "http://localhost:8000/api/v1/table/create" \
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

### 2. Get Schema Information - GET /api/v1/table/schema

Get information about available options and example values:

```bash
curl "http://localhost:8000/api/v1/table/schema"
```

Response:

```json
{
  "prune_modes": ["none", "all", "column"],
  "absent_metrics_strategies": ["all_or_nothing", "nullify", "accept_subset"],
  "slices_recommendation_strategies": ["none", "first_alphabetical", "concise"],
  "sort_orders": ["asc", "desc"],
  "filter_operators": ["in", "not_in", "range"],
  "example_filters": [
    "agent_name:in:agent1,agent2,agent3",
    "runner:not_in:local",
    "value:range:10:100",
    "value:range:10:",
    "value:range::100",
    "performance/latency/total_ms:range:1000:"
  ],
  "example_column_selections": [
    "/metadata/agent_name",
    "/metadata/model",
    "/metrics/performance/latency/total_ms",
    "/metrics/accuracy/answer_correctness"
  ],
  "example_slices": [
    "agent_name",
    "runner:in:local",
    "performance/latency/total_ms:range:1000:"
  ]
}
```

### 3. API Documentation

Once the service is running, visit:
- Interactive API docs: http://localhost:8000/api/v1/docs
- Alternative docs: http://localhost:8000/api/v1/redoc

## Python Client Example

```python
import requests

# Define the request
request_data = {
    "filters": ["runner:not_in:local"],
    "slices": ["agent_name"],
    "column_selections": [
        "/metadata/agent_name",
        "/metadata/model",
        "/metrics/performance/latency/"
    ],
    "sort_by_column": "performance/latency/total_ms",
    "sort_order": "desc",
    "prune_mode": "column",
    "absent_metrics_strategy": "nullify"
}

# Make the request
response = requests.post(
    "http://localhost:8000/api/v1/table/create",
    json=request_data
)

# Handle the response
if response.status_code == 200:
    table_data = response.json()
    
    # Access table components
    rows = table_data["rows"]
    columns = table_data["columns"]
    slice_recommendations = table_data["slice_recommendations"]
    
    # Process the data
    print(f"Table has {len(rows)-1} data rows and {len(columns)} columns")
    print(f"Recommended slices: {', '.join(slice_recommendations)}")
    
    # Access specific values
    for row in rows[1:]:  # Skip header row
        row_name = row[0]["details"]  # First cell contains row metadata
        for i, cell in enumerate(row[1:], 1):  # Skip row name cell
            column_name = columns[i-1]["name"]
            value = cell["values"].get("value")
            print(f"{row_name.get('agent_name', 'N/A')} - {column_name}: {value}")
else:
    print(f"Error: {response.status_code} - {response.text}")
```

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

### Slice Format
Slices support:

- Simple column names: `agent_name`
- Conditional slices: `runner:in:local`, `value:range:10:`

### Column Selection Format
Column selections use hierarchical paths:
- `/metadata/` - Select all metadata fields
- `/metrics/` - Select all metrics
- `/metrics/performance/` - Select all performance metrics
- `/metadata/agent_name` - Select specific field

### Prune Modes
- `none` - No pruning
- `column` - Global pruning (prune if marked in all entries)

### Absent Metrics Strategies
- `all_or_nothing` - Include metric only if present in all slice entries (safest)
- `nullify` - Replace missing metrics with 0 (use for metrics where absence means 0)
- `accept_subset` - Include even if only in some entries (use for new/optional metrics)

### Slices Recommendation Strategies
- `none` - No recommendations
- `first_alphabetical` - Recommend first alphabetical candidates
- `concise` - Recommend the most concise candidates

## Understanding the Response

### Row Structure
- First row contains column headers
- Each subsequent row represents an aggregated entry
- First cell in each row contains metadata about the aggregation

### Cell Structure
Each cell contains:
- `values`: The actual data values
  - `value`: Primary value
  - `min_value`: Minimum value in aggregation
  - `max_value`: Maximum value in aggregation
- `details`: Additional metadata
  - `n_samples`: Number of samples aggregated
  - `description`: Metric description
  - Other metadata fields

### Column Tree
The `column_tree` shows all available columns in a hierarchical structure:
- `selection_state`: "all", "partial", or "none"
- `children`: Nested columns
- Use this to discover available metrics and fields
