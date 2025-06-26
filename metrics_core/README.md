# Metrics Core

Core utilities and shared code for AI Agent analytics metrics.

## Overview

This package contains the fundamental components used across all metrics-related tools:

- **Models**: Core data structures like `CanonicalMetricsEntry`, `Table`, etc.
- **Conversions**: Data transformation utilities (rename, round, filter, etc.)
- **File I/O**: Local file system operations for metrics data
- **Transform Utils**: High-level transformation orchestration

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
pip install -e .
```

## Usage

```python
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.local_files import load_logs_list_from_disk
from metrics_core.transform_utils import create_metrics_tuning

# Load metrics data
entries = load_logs_list_from_disk(path)

# Create transformation pipeline
converter = create_metrics_tuning(params)
converted_entries = converter.convert(entries)
```

## Dependencies

This package depends only on standard Python libraries and minimal external dependencies to keep it lightweight and reusable.