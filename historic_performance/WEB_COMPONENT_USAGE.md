# Web Component Usage Guide

The Historic Performance Dashboard can be used as a configurable web component in other React applications, providing flexible integration options while maintaining full functionality.

## Installation

First, ensure you have the dashboard package available in your React application:

```bash
# If using as a dependency
npm install @nearai/analytics-dashboard

# Or if copying the source code
cp -r analytics/historic_performance/src/components ./src/
```

## Basic Import and Usage

```jsx
import { Dashboard } from './components';

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

The Dashboard component accepts a `config` prop with the following TypeScript interface:

```typescript
interface DashboardConfig {
  // Which views to show ('table', 'logs'). Single view hides Views panel
  views?: ViewType[];
  
  // Filters applied to all requests but not shown in UI
  globalFilters?: string[];
  
  // Metric selection for future use
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
  globalFilters: ['status:error', 'severity:high'],
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
  globalFilters: ['environment:production'],
  metricSelection: 'PERFORMANCE',
  defaultView: 'table',
  viewConfigs: {
    table: {
      showParameters: ['prune_mode', 'sort_by_column', 'sort_order'],
      defaultParameters: { 
        prune_mode: 'column',
        sort_order: 'desc' 
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
  globalFilters: ['environment:staging'],
  viewConfigs: {
    table: {
      showParameters: [], // Hides Parameters panel
      refreshRate: 45
    }
  }
}} />
```

## Available Parameters

### Table View Parameters

- **prune_mode**: `'none' | 'column'` - How to handle missing data
- **absent_metrics_strategy**: `'all_or_nothing' | 'nullify' | 'accept_subset'` - Strategy for missing metrics
- **slices_recommendation_strategy**: `'none' | 'first_alphabetical' | 'concise'` - How to recommend data slices
- **sort_by_column**: `string` - Column to sort by
- **sort_order**: `'asc' | 'desc'` - Sort direction

### Logs View Parameters

- **prune_mode**: `'none' | 'column' | 'all'` - Data pruning strategy
- **groups_recommendation_strategy**: `'none' | 'first_alphabetical' | 'concise'` - How to recommend groupings

## Global Filters

Global filters are powerful for web component usage as they pre-filter data without showing the filters in the UI:

```jsx
// Pre-filter to production environment data only
globalFilters: ['environment:production']

// Multiple filters
globalFilters: [
  'runner:not_in:local',
  'status:success',
  'date:>2024-01-01'
]

// Complex filters
globalFilters: [
  'performance.latency:<1000',
  'metadata.model_name:gpt-4'
]
```

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
        globalFilters: ['environment:production'],
        viewConfigs: {
          table: {
            showParameters: ['prune_mode'],
            defaultParameters: { prune_mode: 'column' },
            refreshRate: 300 // 5 minutes
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
        globalFilters: ['status:error'],
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
import { Dashboard, DashboardConfig, ViewConfig } from './components';

const config: DashboardConfig = {
  views: ['table'],
  globalFilters: ['environment:production'],
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

The Dashboard component requires a metrics service running at `http://localhost:8000` with the following endpoints:

- **POST /api/metrics/table** - For table data
- **POST /api/metrics/logs** - For logs data

Ensure your metrics service is running before using the component.

## Styling and Theming

The component uses Tailwind CSS for styling. Ensure Tailwind is available in your application, or the component will fall back to unstyled HTML.

## Troubleshooting

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
    globalFilters: ['debug:true']
  };
  
  console.log('Dashboard config:', config);
  
  return <Dashboard config={config} />;
}
```

## Migration from Standalone Usage

If you're migrating from standalone usage to web component usage:

```jsx
// Before (standalone)
// No changes needed - component works with default config

// After (web component with custom config)
<Dashboard config={{
  views: ['table', 'logs'], // Same as default
  viewConfigs: {
    table: {
      showParameters: ['prune_mode'], // Customize as needed
      refreshRate: 60 // Add auto-refresh
    }
  }
}} />
```

The component maintains full backward compatibility, so existing usage continues to work without changes.