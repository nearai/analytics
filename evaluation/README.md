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
