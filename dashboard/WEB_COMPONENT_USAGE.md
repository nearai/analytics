# Web Component Usage Guide

The Historic Performance Dashboard can be used as a configurable web component in other React applications, providing flexible integration options while maintaining full functionality.

## Installation

To add the analytics dashboard as a dependency to another repository:

```bash
npm install @nearai/analytics-dashboard
```

This installs the pre-built dashboard component that can be imported directly into your React application:

```jsx
import { Dashboard } from '@nearai/analytics-dashboard';
```

## Basic Import and Usage

```jsx
import { Dashboard } from '@nearai/analytics-dashboard';

// Basic usage with default configuration
function App() {
  return (
    <div>
      <h1>My Application</h1>
      <Dashboard />
    </div>
  );
}
```

## Configuration Options

- **views**: Array of view IDs to show. Each view ID must have a corresponding entry in viewConfigs. If single view, hides the Views panel.
- **globalFilters**: Filters applied to all requests but not shown in the Filters panel.
- **metrics_service_url**: Base URL for the metrics API service (default: 'http://localhost:8000/api/v1/').
- **defaultView**: Initial view ID to display.
- **viewConfigs**: Per-view configuration keyed by view ID:
  - **view_type**: Type of view component ('timeseries', 'table', 'logs').
  - **view_name**: Display name for the view (shown in navigation buttons).
  - **metricSelection**: CUSTOM, PERFORMANCE, CAL (Cost/Accuracy/Latency), ERROR, FEEDBACK.
  - **showParameters**: Which parameters to show in Parameters panel. If empty, hides the panel.
  - **defaultParameters**: Default values for parameters including time_filter support.
  - **timeFilterRecommendations**: Time filters to include in recommendations.
  - **refreshRate**: Refresh interval in seconds (useful for web component usage).

The Dashboard component accepts a `config` prop with the following TypeScript interface:

```typescript
interface DashboardConfig {
  // Which view IDs to show. Each ID must have a corresponding viewConfigs entry
  views?: string[];
  
  // Filters applied to all requests but not shown in UI
  globalFilters?: string[];
  
  // Base URL for metrics API service
  metrics_service_url?: string;
  
  // Per-view configuration keyed by view ID
  viewConfigs?: Record<string, ViewConfig>;
  
  // Initial view ID to display
  defaultView?: string;
}

interface ViewConfig {
  // Type of view component to render
  view_type: 'timeseries' | 'table' | 'logs';
  
  // Display name for the view
  view_name: string;
  
  // Metric selection for this specific view
  metricSelection: 'CUSTOM' | 'PERFORMANCE' | 'CAL' | 'ERROR' | 'FEEDBACK';
  
  // Which parameters to show in Parameters panel (hides panel if empty)
  showParameters?: string[];
  
  // Default values for parameters (supports time_filter for all view types)
  defaultParameters?: Record<string, any>;
  
  // Time filter recommendations
  timeFilterRecommendations?: string[];
  
  // Auto-refresh interval in seconds
  refreshRate?: number;
}
```

## Configuration Examples

### 1. Time Series Dashboard with Performance Tracking

```jsx
<Dashboard config={{
  views: ['timeseries'],
  globalFilters: ['runner:not_in:local'],
  defaultView: 'timeseries',
  viewConfigs: {
    timeseries: {
      view_type: 'timeseries',
      view_name: 'Performance Metrics',
      metricSelection: 'PERFORMANCE',
      defaultParameters: {
        time_filter: '1 month',
        time_granulation: '1 day'
      },
      timeFilterRecommendations: ['last hour', 'last day', 'last week', 'last month', 'last year'],
      refreshRate: 30 // Refresh every 30 seconds
    }
  }
}} />
```

### 2. Table-Only View with Custom Parameters

```jsx
<Dashboard config={{
  views: ['table'],
  globalFilters: ['runner:not_in:local'],
  viewConfigs: {
    table: {
      view_type: 'table',
      view_name: 'Data Table',
      metricSelection: 'PERFORMANCE',
      showParameters: ['prune_mode', 'absent_metrics_strategy'],
      defaultParameters: { 
        prune_mode: 'column',
        absent_metrics_strategy: 'nullify'
      },
      timeFilterRecommendations: ['last hour', 'last day'],
      refreshRate: 30 // Refresh every 30 seconds
    }
  }
}} />
```

### 3. Logs-Only Monitoring View

```jsx
<Dashboard config={{
  views: ['logs'],
  globalFilters: ['runner:not_in:local'],
  defaultView: 'logs',
  viewConfigs: {
    logs: {
      view_type: 'logs',
      view_name: 'Error Logs',
      metricSelection: 'ERROR',
      showParameters: ['groups_recommendation_strategy'],
      defaultParameters: { groups_recommendation_strategy: 'concise' },
      refreshRate: 10 // Refresh every 10 seconds for monitoring
    }
  }
}} />
```

### 4. Full Dashboard with Time Series Primary

```jsx
<Dashboard config={{
  views: ['timeseries', 'table', 'logs'],
  globalFilters: ['runner:not_in:local'],
  defaultView: 'timeseries',
  viewConfigs: {
    timeseries: {
      view_type: 'timeseries',
      view_name: 'Time Series',
      metricSelection: 'PERFORMANCE',
      defaultParameters: {
        time_filter: '1 week',
        time_granulation: '1 hour'
      },
      timeFilterRecommendations: ['last hour', 'last day', 'last week'],
      refreshRate: 60
    },
    table: {
      view_type: 'table',
      view_name: 'Table',
      metricSelection: 'PERFORMANCE',
      showParameters: ['prune_mode'],
      defaultParameters: { 
        prune_mode: 'column',
        time_filter: '1 week'
      },
      timeFilterRecommendations: ['last hour', 'last 6 hours', 'last day'],
      refreshRate: 60
    },
    logs: {
      view_type: 'logs',
      view_name: 'Logs',
      metricSelection: 'PERFORMANCE',
      showParameters: ['groups_recommendation_strategy'],
      defaultParameters: { 
        groups_recommendation_strategy: 'first_alphabetical',
        time_filter: '1 week'
      },
      refreshRate: 120
    }
  }
}} />
```

### 5. Multiple Views of Same Type (New Feature)

```jsx
<Dashboard config={{
  views: ['timeseries_performance', 'table_performance', 'logs_all', 'logs_errors'],
  globalFilters: [],
  metrics_service_url: 'http://localhost:8000/api/v1/',
  defaultView: 'timeseries_performance',
  viewConfigs: {
    timeseries_performance: {
      view_type: 'timeseries',
      view_name: 'Performance',
      metricSelection: 'PERFORMANCE',
      defaultParameters: {
        time_filter: '1 month',
        time_granulation: '1 day'
      }
    },
    table_performance: {
      view_type: 'table',
      view_name: 'Performance Table',
      metricSelection: 'PERFORMANCE',
      defaultParameters: {
        time_filter: '1 month'
      }
    },
    logs_all: {
      view_type: 'logs',
      view_name: 'All Logs',
      metricSelection: 'PERFORMANCE',
      defaultParameters: {
        time_filter: '1 month'
      }
    },
    logs_errors: {
      view_type: 'logs',
      view_name: 'Error Logs',
      metricSelection: 'ERROR',
      timeFilterRecommendations: []  // Disable time filter recommendations
    }
  }
}} />
```

### 5. Minimal Configuration (Hidden Panels)

```jsx
<Dashboard config={{
  views: ['table'],
  globalFilters: ['runner:not_in:local'],
  viewConfigs: {
    table: {
      showParameters: [], // Hides Parameters panel
      refreshRate: 45
    }
  }
}} />
```

## Available Parameters

For a complete list of available parameters, see the [Parameters section in canonical_metrics/README](../canonical_metrics/README.md#parameters-reference).

## Auto-Refresh Feature

Perfect for monitoring dashboards and real-time data viewing:

```jsx
<Dashboard config={{
  views: ['logs'],
  viewConfigs: {
    logs: {
      refreshRate: 30 // Refreshes every 30 seconds
    }
  }
}} />
```

**Notes:**
- Refresh intervals are automatically cleaned up when the component unmounts
- Different views can have different refresh rates
- Set to `undefined` or omit to disable auto-refresh

## Usage Scenarios

### Embedded Analytics Dashboard

```jsx
// In a larger application
function AnalyticsPage() {
  return (
    <div className="analytics-page">
      <header>
        <h1>Performance Analytics</h1>
      </header>
      
      <Dashboard config={{
        views: ['timeseries', 'table'],
        metricSelection: 'PERFORMANCE',
        globalFilters: ['runner:not_in:local'],
        defaultView: 'timeseries',
        viewConfigs: {
          timeseries: {
            defaultParameters: {
              time_filter: '1 month',
              time_granulation: '1 day'
            },
            refreshRate: 300 // 300 seconds
          },
          table: {
            showParameters: ['prune_mode'],
            defaultParameters: { prune_mode: 'column' },
            refreshRate: 300
          }
        }
      }} />
    </div>
  );
}
```

### Time Series Monitoring Widget

```jsx
// Real-time time series monitoring component
function TimeSeriesMonitor() {
  return (
    <div className="monitor-widget">
      <h3>Performance Trends</h3>
      <Dashboard config={{
        views: ['timeseries'],
        metricSelection: 'PERFORMANCE',
        defaultView: 'timeseries',
        viewConfigs: {
          timeseries: {
            defaultParameters: {
              time_filter: 'last day',
              time_granulation: '1 hour'
            },
            timeFilterRecommendations: ['last hour', 'last day'],
            refreshRate: 30
          }
        }
      }} />
    </div>
  );
}
```

### Monitoring Widget

```jsx
// Small monitoring component
function ErrorMonitor() {
  return (
    <div className="monitor-widget">
      <h3>Error Logs</h3>
      <Dashboard config={{
        views: ['logs'],
        metricSelection: 'ERROR',
        viewConfigs: {
          logs: {
            showParameters: [],
            refreshRate: 15
          }
        }
      }} />
    </div>
  );
}
```

### Performance Report

```jsx
// Performance reporting dashboard with time series primary
function PerformanceReport() {
  return (
    <Dashboard config={{
      views: ['timeseries', 'table', 'logs'],
      globalFilters: ['runner:not_in:local'],
      metricSelection: 'PERFORMANCE',
      defaultView: 'timeseries',
      viewConfigs: {
        timeseries: {
          defaultParameters: {
            time_filter: 'last week',
            time_granulation: '1 hour'
          },
          timeFilterRecommendations: ['last day', 'last week', 'last month']
        },
        table: {
          showParameters: ['prune_mode', 'absent_metrics_strategy'],
          defaultParameters: { prune_mode: 'column' },
          timeFilterRecommendations: ['last day', 'last week']
        },
        logs: {
          showParameters: ['groups_recommendation_strategy']
        }
      }
    }} />
  );
}
```

## Conditional UI Behavior

The Dashboard component automatically adapts its UI based on configuration:

### Views Panel
- **Hidden**: When only one view is configured (`views: ['timeseries']`)
- **Shown**: When multiple views are configured (`views: ['timeseries', 'table', 'logs']`)

### Parameters Panel
- **Hidden**: When `showParameters` is empty or undefined
- **Shown**: When `showParameters` contains parameter names

### Example of Minimal UI
```jsx
// This configuration will show minimal UI with no side panels
<Dashboard config={{
  views: ['table'],
  viewConfigs: {
    table: {
      showParameters: [] // Hides Parameters panel
    }
  }
}} />
```

## TypeScript Support

The component is fully typed. Import types for better development experience:

```typescript
import { Dashboard, DashboardConfig, ViewConfig } from '@nearai/analytics-dashboard';

const config: DashboardConfig = {
  views: ['timeseries', 'table'],
  globalFilters: ['runner:not_in:local'],
  defaultView: 'timeseries',
  viewConfigs: {
    timeseries: {
      defaultParameters: {
        time_filter: '1 week',
        time_granulation: '1 hour'
      },
      refreshRate: 60
    },
    table: {
      showParameters: ['prune_mode'],
      refreshRate: 60
    }
  }
};

function MyApp() {
  return <Dashboard config={config} />;
}
```

## API Requirements

The Dashboard component requires a metrics service running at `http://localhost:8000`. Ensure your metrics service is running before using the component.

## Styling and Theming

The component uses Tailwind CSS for styling. Ensure Tailwind is available in your application, or the component will fall back to unstyled HTML.

## Troubleshooting (suggested by AI)

### Common Issues

1. **Component not displaying data**
   - Verify metrics service is running at `http://localhost:8000`
   - Check browser console for API errors
   - Verify global filters are not too restrictive

2. **Auto-refresh not working**
   - Ensure `refreshRate` is set in view configuration
   - Check that component is not unmounting/remounting frequently

3. **Parameters panel not showing**
   - Verify `showParameters` array is not empty
   - Check that parameter names match available options

4. **Styling issues**
   - Ensure Tailwind CSS is properly configured in your application
   - Check for CSS conflicts with existing styles

### Debug Mode

For debugging, you can log the current configuration:

```jsx
function DebugDashboard() {
  const config = {
    views: ['table'],
    globalFilters: ['runner:not_in:local']
  };
  
  console.log('Dashboard config:', config);
  
  return <Dashboard config={config} />;
}
```