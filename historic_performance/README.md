# Historic Performance Dashboard

Tools to browse logs, track and visualize agent performance over time.

### Views

#### 1. Chronological Log Entries View

This view displays individual log entries in chronological order:

- Detailed metadata for each run
- Quick access to metrics and log files
- Filtering by date ranges and metadata

#### 2. Historic Performance Table View

This view aggregates metrics over time with flexible grouping:

- **Columns**: Averages of metrics over the selected time period
- **Rows**: Initially a single row showing overall averages
- **Slicing**: Dynamically slice the data by any metadata attribute
  - By model (compare performance across different models)
  - By date (weekly/monthly aggregation)
  - By any other metadata field
