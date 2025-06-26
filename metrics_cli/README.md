# Metrics CLI

Command-line interface for processing metrics logs.

## Overview

This package provides a command-line interface for various metrics operations:

- **Rename**: Heuristic renaming of fields for better sorting and dashboard alignment
- **Round**: Round numeric values to specified precision
- **Convert Units**: Convert milliseconds to seconds
- **Tune**: Apply common metrics tuning operations
- **Aggregate**: Aggregate metrics by grouping and averaging values
- **Filter**: Filter metrics based on conditions
- **Table Creation**: Create evaluation and aggregation tables in CSV format

## Installation

```bash
pip install -e .
```

## Usage

```bash
# Show help
metrics-cli --help

# Rename fields heuristically
metrics-cli -v rename /path/to/logs /path/to/clean_logs

# Convert milliseconds to seconds
metrics-cli -v ms_to_s /path/to/logs /path/to/converted_logs

# Round numeric values
metrics-cli round /path/to/logs /path/to/rounded_logs

# Apply multiple tuning operations
metrics-cli tune /path/to/logs /path/to/tuned_logs --rename --ms-to-s --round

# Create aggregation table
metrics-cli aggregation-table /path/to/logs /path/to/table.csv --filters "runner:not_in:local"

# Create evaluation table
metrics-cli evaluation-table /path/to/table.csv
```

## Dependencies

This package depends on:
- `metrics_core` for core utilities and data structures
- `evaluation` for evaluation-specific functionality
- `click` for command-line interface
- `rich` for enhanced terminal output