# Metrics Core

Core utilities and shared code for NEAR AI analytics metrics.

## Overview

This package contains the fundamental components used across all metrics-related tools:

- **Models**: Core data structures like `CanonicalMetricsEntry`, `Table`, etc.
- **Conversions**: Data transformation utilities (rename, round, filter, etc.)
- **File I/O**: Local file system operations for metrics data
- **Transform Utils**: High-level transformation orchestration

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