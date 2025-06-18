import React from 'react';
import { Dashboard } from './components';

// Example configurations for different use cases

// 1. Single table view with custom parameters
const TableOnlyConfig = () => (
  <Dashboard config={{
    views: ['table'],
    globalFilters: ['runner:not_in:local'],
    viewConfigs: {
      table: {
        view_type: 'table',
        view_name: 'Table',
        metricSelection: 'PERFORMANCE',
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
    viewConfigs: {
      logs: {
        view_type: 'logs',
        view_name: 'Logs',
        metricSelection: 'ERROR',
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
    viewConfigs: {
      table: {
        view_type: 'table',
        view_name: 'CAL Metrics',
        metricSelection: 'CAL',
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
    viewConfigs: {
      timeseries: {
        view_type: 'timeseries',
        view_name: 'Performance Metrics',
        metricSelection: 'PERFORMANCE',
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
    viewConfigs: {
      timeseries: {
        view_type: 'timeseries',
        view_name: 'Time Series',
        metricSelection: 'CUSTOM',
        defaultParameters: {
          time_filter: '1 month',
          time_granulation: '1 day'
        },
        timeFilterRecommendations: ['last hour', 'last day', 'last week', 'last month', 'last year']
      },
      table: {
        view_type: 'table',
        view_name: 'Table',
        metricSelection: 'CUSTOM',
        timeFilterRecommendations: ['last hour', 'last day', 'last week']
      },
      logs: {
        view_type: 'logs',
        view_name: 'Logs',
        metricSelection: 'CUSTOM',
        showParameters: ['prune_mode', 'groups_recommendation_strategy']
      }
    }
  }} />
);

// 6. Example with multiple views of same type and new features
const ExampleNewFeaturesConfig = () => (
  <Dashboard config={{
    views: ['timeseries_performance', 'table_performance', 'logs_all', 'logs_errors'],
    globalFilters: [],
    metrics_service_url: 'http://localhost:8000/api/v1/',
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
        view_name: 'Table',
        metricSelection: 'PERFORMANCE',
        defaultParameters: {
          time_filter: '1 month'
        }
      },
      logs_all: {
        view_type: 'logs',
        view_name: 'Logs',
        metricSelection: 'PERFORMANCE',
        defaultParameters: {
          time_filter: '1 month'
        }
      },
      logs_errors: {
        view_type: 'logs',
        view_name: 'Error Logs',
        timeFilterRecommendations: [],  // Default: disable
        metricSelection: 'ERROR'
      }
    },
    defaultView: 'timeseries_performance'
  }} />
);

// Export examples
export {
  TableOnlyConfig,
  LogsOnlyConfig,
  CALTrackingConfig,
  TimeSeriesConfig,
  FullDashboardConfig,
  ExampleNewFeaturesConfig
};