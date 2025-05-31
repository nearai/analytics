# Historic Performance Dashboard

A web application for querying and visualizing analytics metrics data. Tools to browse logs, track and visualize agent performance over time.

## Prerequisites

- Node.js 16+ and npm
- The metrics service running at `http://localhost:8000`

## Installation

1. Navigate to the project directory:
```bash
cd analytics/historic_performance
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

1. Ensure the metrics service is running:
```bash
# In the analytics/canonical_metrics directory
poetry run metrics-service --metrics-path /path/to/your/tuned/metrics
```

2. Start the development server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Building for Production

To create a production build:

```bash
npm run build
```

The build files will be in the `build/` directory.

## Features

- **Control Panel**: Configure parameters, filters, and slices
- **Column Tree**: Hierarchical column selection
- **Data Table**: Interactive table with sorting and filtering
  - Initially a single row showing overall averages
  - Dynamically filter and slice the data by any column
- **Time Filters**: Quick filters for last hour/day/week
- **Details View**: Click cells to view detailed JSON data

## Development

The app is built with:
- React 18
- TypeScript
- Tailwind CSS
- Lucide React (for icons)

To modify the dashboard, edit `src/components/MetricsDashboard.tsx`.

#### TODO: Chronological Log Entries View

This view displays individual log entries in chronological order:

- Detailed metadata for each run
- Quick access to metrics and log files
- Filtering by date ranges and metadata
- Grouping

### TODO: Functions

#### 1. Custom View

- Launch on any data as long as it is in canonical metrics format.
- Custom metrics table.
- Stream of log files.

#### 2. Performance Dashboard

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
