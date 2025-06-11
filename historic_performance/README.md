# Historic Performance Dashboard

A web application for querying and visualizing analytics metrics data. Tools to browse logs, track and visualize agent performance over time. Can be used as a standalone web app or as a configurable web component in other applications.

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

## Web Component Usage

The dashboard can be used as a configurable web component in other React applications:

```jsx
import { Dashboard } from './components';

// Basic usage (shows both table and logs views)
<Dashboard />

// Configured for single view with custom settings
<Dashboard config={{
  views: ['table'], // Show only table view (hides Views panel)
  globalFilters: ['runner:not_in:local'], // Applied to all requests but not shown in UI
  metricSelection: 'PERFORMANCE', // Metric selection (CUSTOM, PERFORMANCE, CAL, ERROR, FEEDBACK)
  defaultView: 'table',
  viewConfigs: {
    table: {
      showParameters: ['prune_mode', 'absent_metrics_strategy'], // Show specific parameters
      defaultParameters: { prune_mode: 'column' }, // Default parameter values
      timeFilterRecommendations: ['last hour', 'last day'], // Time filter recommendations
      refreshRate: 30 // Refresh every 30 seconds (for web component usage)
    },
    logs: {
      refreshRate: 60 // Refresh every 60 seconds
    }
  }
}} />
```

### Configuration Options

- **views**: Array of views to show ('table', 'logs'). If single view, hides the Views panel.
- **globalFilters**: Filters applied to all requests but not shown in the Filters panel.
- **metricSelection**: CUSTOM, PERFORMANCE, CAL (Cost/Accuracy/Latency), ERROR, FEEDBACK. Currently unused.
- **defaultView**: Initial view to display.
- **viewConfigs**: Per-view configuration:
  - **showParameters**: Which parameters to show in Parameters panel. If empty, hides the panel.
  - **defaultParameters**: Default values for parameters.
  - **timeFilterRecommendations**: Time filters to include in recommendations.
  - **refreshRate**: Refresh interval in seconds (useful for web component usage).

### Usage Scenarios

**Standalone Web App** (useful parameters):
- showParameters and defaultParameters (customize parameter visibility and defaults)
- metricSelection (when implemented)
- timeFilterRecommendations (customize time filter suggestions)

**Web Component** (useful parameters):
- views (control which views are available)
- globalFilters (pre-apply filters without showing them)
- refreshRate (auto-refresh data)
- All standalone parameters

**Not useful in Standalone Web App**:
- globalFilters (filters are already applied by user)
- refreshRate (no auto-refresh needed in standalone usage)

## Building for Production

To create a production build:

```bash
npm run build
```

The build files will be in the `build/` directory.

## Table Features

- **Control Panel**: Configure parameters, filters, and slices
- **Column Tree**: Hierarchical column selection
- **Data Table**: Interactive table with sorting and filtering
  - Initially a single row showing overall averages
  - Dynamically filter and slice the data by any column
- **Time Filters**: Quick filters for last hour/day/week
- **Details View**: Click cells to view detailed JSON data

## Chronological Log Entries Features

This view displays individual log entries in chronological order:

- Detailed metadata for each run
- Quick access to metrics and log files
- Filtering by date ranges and metadata
- Grouping

## Development

The app is built with:
- React 18
- TypeScript
- Tailwind CSS
- Lucide React (for icons)

## TODO: Functions

#### 1. Custom View

**Current implementation**: ✅ Available
- Launch on any data as long as it is in canonical metrics format.
- Custom metrics table with full parameter control.
- Stream of log files with detailed metadata.
- Configurable through Dashboard component with any combination of parameters.

#### 2. Performance Dashboard

**Current implementation**: ✅ Available (almost complete)
- Time granulation: Manual time filters (last hour, day, week, custom ranges).
- Metrics table with filtering, slicing, performance columns, and custom columns.
- Stream of log files with chronological ordering.
- Default parameters optimized for performance tracking.
- Time filter recommendations passed to logs view.

#### 3. Cost/Accuracy/Latency Tracking

**Current implementation**: 🔄 Table view only
- Metrics table with filtering, slicing, cost/accuracy/latency columns, and custom columns.
- No time filters in current implementation.
- **Note**: Metric selection parameter (CAL) added to configuration but not yet implemented.
- **Future**: Will include specialized cost, accuracy, and latency column selections.

#### 4. Error Analysis

**Current implementation**: ❌ Not implemented
- **Planned**: Metrics table with filtering, slicing, error columns, and custom columns.
- **Planned**: Stream of log files specifically for error runs.
- **Future**: Error-specific filters and grouping strategies.
- **Future**: Error pattern detection and analysis.

#### 5. User Feedback Analysis

**Current implementation**: ❌ Not implemented
- **Planned**: Metrics table with filtering, slicing, feedback columns, and custom columns.
- **Planned**: Stream of log files with user feedback data.
- **Future**: Feedback sentiment analysis and categorization.
- **Future**: User feedback correlation with performance metrics.
