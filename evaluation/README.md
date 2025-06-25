# Evaluation

Tools for analyzing models, agents, and visualizing metrics.

## Overview

This package provides evaluation-specific functionality:

- **Evaluation Table**: Structured view of agent performance metrics
- **Data Loading**: Loading evaluation-specific data from various sources
- **Analysis Tools**: Tools for comparing and analyzing evaluation results

## Installation

```bash
pip install -e .
```

## Evaluation Table

The Evaluation Dashboard provides a structured view of agent performance metrics, allowing for easy comparison across different agents, models, and configurations.

The main component of the dashboard is the Evaluation Table:

- **Rows**: Different entities (agents, models, etc.)
- **Columns**: A hierarchical tree structure of metrics categories and subcategories
- **Cells**: Metric values
- **Interactive**: Click on metric values to access associated log files and detailed information

### Features

1. **Metric Hierarchy**: Metrics are organized in a tree structure, allowing for collapsible categories
2. **Sorting**: Sort entities by any metric for easy comparison
3. **Log Access**: Direct access to log files by clicking on metric values
4. **Export**: Export evaluation results in various formats (CSV, JSON)

## Usage

```python
from evaluation.data import load_evaluation_entries
from evaluation.table import create_evaluation_table

# Load evaluation data
entries = load_evaluation_entries()

# Create evaluation table
table = create_evaluation_table(entries, params)
```

## Dependencies

This package depends on `metrics_core` for shared utilities and data structures.
