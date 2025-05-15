# Historic Performance Dashboard

Tools to browse logs, track and visualize agent performance over time.

### Views

#### 1. Historic Performance Table View

This view aggregates metrics over time with flexible grouping:

- **Columns**: Averages of metrics over the selected time period
- **Rows**: Initially a single row showing overall averages
- **Slicing**: Dynamically slice the data by any metadata attribute
  - By model (compare performance across different models)
  - By date (weekly/monthly aggregation)
  - By any other metadata field

#### 2. Chronological Log Entries View

This view displays individual log entries in chronological order:

- Detailed metadata for each run
- Quick access to metrics and log files
- Filtering by date ranges and metadata

### Functions

#### 1. Custom View

- Launch on any data as long as it is in canonical metrics format.
- Custom metrics table.
- Stream of log files.

#### 2. Performance Dasboard

- Time granulation: 1 minute, 1 hour, 1 day, 1 week.
- Metrics table with filtering, slicing, performance columns, and custom columns.
- Stream of log files.

#### 3. Cost/Accuracy/Latency Tracking

- Metrics table with filtering, slicing, cost/accuracy/latency columns, and custom columns.

#### 4. Error Analysis

- Metrics table with filtering, slicing, error columns, and custom columns.
- Stream of log files for error runs.

#### 5. User Feedback Analysis

- Metrics table with filtering, slicing, feedback columns, and custom columns.
- Stream of log files with user feedback.
