# Analytics Dashboard

A web application for querying and visualizing analytics metrics data. Features comprehensive views for time series analysis, data tables, and chronological logs. Can be used as a standalone web app or as a configurable web component in other applications.

## Prerequisites

- Node.js 16+ and npm
- The metrics service running at `http://localhost:8000`

## Installation

1. Navigate to the project directory:
```bash
cd analytics/dashboard
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

1. Ensure the metrics service is running:
```bash
metrics-service --metrics-path /path/to/your/tuned/metrics
```

2. Start the development server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Dashboard Views

The dashboard provides three main views accessible via navigation tabs:

### Time Series View (Primary)

**Interactive time series visualization with comprehensive graph management:**

- **Control Panel**: Configure time filters, granulation, and global filters
- **Graph Grid**: 2x3 layout supporting up to 6 graphs initially, with unlimited rows capability
- **Add/Remove Graphs**: Click-to-add placeholders and remove buttons for existing graphs
- **Graph Configuration Modal**: Pop-up interface for configuring multiple lines per graph
- **Metric Tree Selection**: Interactive tree for selecting metrics from `/metrics/` paths using table API
- **Filter Support**: Optional filters with syntax help and recommendations
- **Slice Support**: Optional slicing with automatic slice value detection via API
- **Smart Color Management**: Automatic color assignment based on success/error patterns, with manual override
- **Auto Time Granulation**: Automatically adjusts based on time filter selection:
  - 1 hour over 1 day/week
  - 1 day over 1 month  
  - 1 week over 1 year
- **Real-time Data**: Uses `/graphs/time-series` endpoint for live data fetching

### Table View

- **Control Panel**: Configure parameters, filters, and slices
- **Column Tree**: Hierarchical column selection
- **Data Table**: Interactive table with sorting and filtering
  - Initially a single row showing overall averages
  - Dynamically filter and slice the data by any column
- **Time Filters**: Quick filters for last hour/day/week
- **Details View**: Click cells to view detailed JSON data
- **Model Comparison Mode**: When using 'COMPARE_MODELS' metricSelection:
  - Uses `/table/evaluation` endpoint instead of `/table/aggregation`
  - No parameters, slicing, or time filters available
  - Default column selections: `['/metrics/']`
  - Designed for comparing different model performances

### Chronological Logs View

This view displays individual log entries in chronological order:

- Detailed metadata for each run
- Quick access to metrics and log files
- Filtering by date ranges and metadata
- Grouping

## Web Component Usage

For detailed web component usage instructions, see [WEB_COMPONENT_USAGE.md](./WEB_COMPONENT_USAGE.md).

## Building for Production

To create a production build:

```bash
npm run build
```

The build files will be in the `build/` directory.

## Development

The app is built with:
- React 18
- TypeScript
- Tailwind CSS
- Lucide React (for icons)
- Recharts (for time series visualization)

## Implementation Status

#### 1. Custom View

**Current implementation**: ✅ Available
- Launch on any data as long as it is in canonical metrics format.
- Interactive time series visualization with graph management.
- Custom metrics table with full parameter control.
- Stream of log files with detailed metadata.
- Configurable through Dashboard component with any combination of parameters.

#### 2. Performance Dashboard

**Current implementation**: ✅ Available
- Time granulation: Manual time filters (last hour, day, week, custom ranges).
- Interactive performance time series graphs.
- Metrics table with filtering, slicing, performance columns, and custom columns.
- Stream of log files with chronological ordering.
- Default parameters optimized for performance tracking.
- Time filter recommendations can be passed to logs view.

#### 3. Cost/Accuracy/Latency Tracking

**Current implementation**: ✅ Latency graphs available
- Interactive latency time series graphs.
- **Future**: Will include specialized cost, accuracy, and latency column selections.

#### 4. Error Analysis

**Current implementation**: ✅ Error logs available
- Stream of log files specifically for error runs.
- **Future**: Error-specific filters and grouping strategies.
- **Future**: Error pattern detection and analysis.

#### 5. User Feedback Analysis

**Current implementation**: ❌ Not implemented
- **Planned**: Stream of log files with user feedback data.
- **Future**: Feedback sentiment analysis and categorization.
- **Future**: User feedback correlation with performance metrics.

#### 6. Compare Models

**Current implementation**: ✅ Table available
- Models evaluation table.
- **Future**: Model recommendations based on agent's information and developer's preferences (e.g., budget).
