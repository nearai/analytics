import React from 'react';
import { Dashboard } from './components';

// Example configurations for different use cases

// 1. Single table view with custom parameters
const TableOnlyConfig = () => (
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
        timeFilterRecommendations: ['last hour', 'last day']
      }
    }
  }} />
);

// 2. Logs only view with auto-refresh
const LogsOnlyConfig = () => (
  <Dashboard config={{
    views: ['logs'],
    globalFilters: ['status:error'],
    metricSelection: 'ERROR',
    viewConfigs: {
      logs: {
        refreshRate: 30, // Refresh every 30 seconds
        showParameters: ['prune_mode']
      }
    }
  }} />
);

// 3. Cost/Accuracy/Latency tracking
const CALTrackingConfig = () => (
  <Dashboard config={{
    views: ['table'],
    metricSelection: 'CAL',
    viewConfigs: {
      table: {
        showParameters: ['absent_metrics_strategy'],
        defaultParameters: {
          absent_metrics_strategy: 'accept_subset'
        }
      }
    }
  }} />
);

// 4. Time Series dashboard with default configuration
const TimeSeriesConfig = () => (
  <Dashboard config={{
    views: ['timeseries'],
    defaultView: 'timeseries',
    metricSelection: 'PERFORMANCE',
    viewConfigs: {
      timeseries: {
        defaultParameters: {
          time_filter: '1 month',
          time_granulation: '1 day'
        },
        timeFilterRecommendations: ['last hour', 'last day', 'last week', 'last month', 'last year']
      }
    }
  }} />
);

// 5. Full dashboard with all views
const FullDashboardConfig = () => (
  <Dashboard config={{
    views: ['timeseries', 'table', 'logs'],
    defaultView: 'timeseries',
    metricSelection: 'CUSTOM',
    viewConfigs: {
      timeseries: {
        defaultParameters: {
          time_filter: '1 month',
          time_granulation: '1 day'
        },
        timeFilterRecommendations: ['last hour', 'last day', 'last week', 'last month', 'last year']
      },
      table: {
        timeFilterRecommendations: ['last hour', 'last day', 'last week']
      },
      logs: {
        showParameters: ['prune_mode', 'groups_recommendation_strategy']
      }
    }
  }} />
);

// Export examples
export {
  TableOnlyConfig,
  LogsOnlyConfig,
  CALTrackingConfig,
  TimeSeriesConfig,
  FullDashboardConfig
};