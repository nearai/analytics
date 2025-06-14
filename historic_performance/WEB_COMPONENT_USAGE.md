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

- **views**: Array of views to show ('table', 'logs'). If single view, hides the Views panel.
- **globalFilters**: Filters applied to all requests but not shown in the Filters panel.
- **metricSelection**: CUSTOM, PERFORMANCE, CAL (Cost/Accuracy/Latency), ERROR, FEEDBACK.
- **defaultView**: Initial view to display.
- **viewConfigs**: Per-view configuration:
  - **showParameters**: Which parameters to show in Parameters panel. If empty, hides the panel.
  - **defaultParameters**: Default values for parameters.
  - **timeFilterRecommendations**: Time filters to include in recommendations.
  - **refreshRate**: Refresh interval in seconds (useful for web component usage).

The Dashboard component accepts a `config` prop with the following TypeScript interface:

```typescript
interface DashboardConfig {
  // Which views to show ('table', 'logs'). Single view hides Views panel
  views?: ViewType[];
  
  // Filters applied to all requests but not shown in UI
  globalFilters?: string[];
  
  // Metric selection
  metricSelection?: 'CUSTOM' | 'PERFORMANCE' | 'CAL' | 'ERROR' | 'FEEDBACK';
  
  // Per-view configuration
  viewConfigs?: {
    table?: ViewConfig;
    logs?: ViewConfig;
  };
  
  // Initial view to display
  defaultView?: 'table' | 'logs';
}

interface ViewConfig {
  // Which parameters to show in Parameters panel (hides panel if empty)
  showParameters?: string[];
  
  // Default values for parameters
  defaultParameters?: Record<string, any>;
  
  // Time filter recommendations
  timeFilterRecommendations?: string[];
  
  // Auto-refresh interval in seconds
  refreshRate?: number;
}
```

## Configuration Examples

### 1. Table-Only View with Custom Parameters

```jsx
<Dashboard config={{
  views: ['table'],
  globalFilters: ['runner:not_in:local'],
  metricSelection: 'PERFORMANCE',
  viewConfigs: {
    table: {
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

### 2. Logs-Only Monitoring View

```jsx
<Dashboard config={{
  views: ['logs'],
  globalFilters: ['runner:not_in:local'],
  metricSelection: 'ERROR',
  defaultView: 'logs',
  viewConfigs: {
    logs: {
      showParameters: ['groups_recommendation_strategy'],
      defaultParameters: { groups_recommendation_strategy: 'concise' },
      refreshRate: 10 // Refresh every 10 seconds for monitoring
    }
  }
}} />
```

### 3. Full Dashboard with Custom Settings

```jsx
<Dashboard config={{
  views: ['table', 'logs'],
  globalFilters: ['runner:not_in:local'],
  metricSelection: 'PERFORMANCE',
  defaultView: 'table',
  viewConfigs: {
    table: {
      showParameters: ['prune_mode'],
      defaultParameters: { 
        prune_mode: 'column'
      },
      timeFilterRecommendations: ['last hour', 'last 6 hours', 'last day'],
      refreshRate: 60
    },
    logs: {
      showParameters: ['groups_recommendation_strategy'],
      defaultParameters: { groups_recommendation_strategy: 'first_alphabetical' },
      refreshRate: 120
    }
  }
}} />
```

### 4. Minimal Configuration (Hidden Panels)

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
        views: ['table'],
        metricSelection: 'PERFORMANCE',
        globalFilters: ['runner:not_in:local'],
        viewConfigs: {
          table: {
            showParameters: ['prune_mode'],
            defaultParameters: { prune_mode: 'column' },
            refreshRate: 300 // 300 seconds
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
// Performance reporting dashboard
function PerformanceReport() {
  return (
    <Dashboard config={{
      views: ['table', 'logs'],
      globalFilters: ['runner:not_in:local'],
      metricSelection: 'PERFORMANCE',
      defaultView: 'table',
      viewConfigs: {
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
- **Hidden**: When only one view is configured (`views: ['table']`)
- **Shown**: When multiple views are configured (`views: ['table', 'logs']`)

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
  views: ['table'],
  globalFilters: ['runner:not_in:local'],
  viewConfigs: {
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