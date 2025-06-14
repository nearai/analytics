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

// 4. Full dashboard with both views
const FullDashboardConfig = () => (
  <Dashboard config={{
    views: ['table', 'logs'],
    defaultView: 'table',
    metricSelection: 'CUSTOM',
    viewConfigs: {
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
  FullDashboardConfig
};