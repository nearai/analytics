import React, { useState, useEffect, useCallback, useMemo} from 'react';
import TimeSeriesDashboard from './TimeSeriesDashboard';
import TableDashboard from './TableDashboard';
import LogsDashboard from './LogsDashboard';
import { DashboardConfig, ViewConfig, TimeSeriesRequest, TableRequest, LogsRequest } from './shared/types';

interface DashboardProps {
  config?: DashboardConfig;
}

const DEFAULT_CONFIG: DashboardConfig = {
  views: ['timeseries_performance', 'timeseries_latency', 'table', 'model_comparison', 'logs', 'error_logs'],
  globalFilters: [],
  metrics_service_url: 'http://localhost:8000/api/v1/',
  viewConfigs: {
    timeseries_performance: {
      view_type: 'timeseries',
      view_name: 'Performance',
      metricSelection: 'PERFORMANCE',
      refreshRate: undefined,
      defaultParameters: {
        time_filter: '1 month',
        time_granulation: '1 day'
      }
    },
    timeseries_latency: {
      view_type: 'timeseries',
      view_name: 'Latency',
      metricSelection: 'CAL',
      refreshRate: undefined,
      defaultParameters: {
        time_filter: '1 month',
        time_granulation: '3 days'
      }
    },
    table: {
      view_type: 'table',
      view_name: 'Table',
      metricSelection: 'CUSTOM',
      refreshRate: undefined
    },
    model_comparison: {
      view_type: 'table',
      view_name: 'Compare Models',
      metricSelection: 'COMPARE_MODELS',
      refreshRate: undefined
    },
    logs: {
      view_type: 'logs',
      view_name: 'Logs',
      metricSelection: 'CUSTOM',
      timeFilterRecommendations: [],  // Default: disable
      refreshRate: undefined
    },
    error_logs: {
      view_type: 'logs',
      view_name: 'Error Logs',
      metricSelection: 'ERROR',
      timeFilterRecommendations: [],  // Default: disable
      refreshRate: undefined
    }
  }
};

const Dashboard: React.FC<DashboardProps> = ({ config = DEFAULT_CONFIG }) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Determine available views
  const availableViews = useMemo(() => {
    return finalConfig.views || ['timeseries', 'table', 'logs'];
  }, [finalConfig.views]);
  
  // Current view state
  const [currentView, setCurrentView] = useState<string>(
    finalConfig.defaultView || availableViews[0] || 'timeseries'
  );
  
  // Store requests for each view to maintain state when switching
  const [viewRequests, setViewRequests] = useState<Record<string, TimeSeriesRequest | TableRequest | LogsRequest>>({});

  // Refresh triggers - incrementing these will cause child components to refresh
  const [refreshTriggers, setRefreshTriggers] = useState<Record<string, number>>({});
  
  // Helper function to get view config by view ID
  const getViewConfig = useCallback((viewId: string): ViewConfig | undefined => {
    return finalConfig.viewConfigs?.[viewId];
  }, [finalConfig.viewConfigs]);
  
  // Helper function to trigger refresh for a specific view
  const triggerRefresh = (viewId: string) => {
    setRefreshTriggers(prev => ({
      ...prev,
      [viewId]: (prev[viewId] || 0) + 1
    }));
  };
  
  // Setup refresh intervals
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];
    
    // Setup refresh intervals for all views that have refreshRate configured
    availableViews.forEach(viewId => {
      const viewConfig = getViewConfig(viewId);
      const refreshRate = viewConfig?.refreshRate;
      
      if (refreshRate && refreshRate > 0) {
        const interval = setInterval(() => {
          if (currentView === viewId && viewRequests[viewId]) {
            triggerRefresh(viewId);
          }
        }, refreshRate * 1000);
        intervals.push(interval);
      }
    });
    
    // Cleanup on unmount or when dependencies change
    return () => {
      intervals.forEach(interval => clearInterval(interval));
    };
  }, [finalConfig.viewConfigs, currentView, viewRequests, availableViews, getViewConfig]);

  // Navigation handlers
  const handleNavigateToView = (viewId: string) => {
    if (availableViews.includes(viewId)) {
      setCurrentView(viewId);
    }
  };

  // Render the appropriate view
  const renderCurrentView = () => {
    const viewToRender = availableViews.includes(currentView) ? currentView : availableViews[0];
    const viewConfig = getViewConfig(viewToRender);
    
    if (!viewConfig) {
      return <div>Error: View configuration not found for {viewToRender}</div>;
    }
    
    const commonProps = {
      config: finalConfig,
      viewId: viewToRender,
      viewConfig: viewConfig,
      onNavigateToView: handleNavigateToView,
      savedRequest: viewRequests[viewToRender] || null,
      onRequestChange: (request: TimeSeriesRequest | TableRequest | LogsRequest) => {
        setViewRequests(prev => ({
          ...prev,
          [viewToRender]: request
        }));
      },
      refreshTrigger: refreshTriggers[viewToRender] || 0
    };
    
    if (viewConfig.view_type === 'timeseries') {
      return (
        <TimeSeriesDashboard
          key={viewToRender} // Add unique key to force remount
          {...commonProps}
          savedRequest={viewRequests[viewToRender] as TimeSeriesRequest || null}
          onRequestChange={(request: TimeSeriesRequest) => {
            setViewRequests(prev => ({
              ...prev,
              [viewToRender]: request
            }));
          }}
        />
      );
    } else if (viewConfig.view_type === 'table') {
      return (
        <TableDashboard
          key={viewToRender} // Add unique key to force remount
          {...commonProps}
          savedRequest={viewRequests[viewToRender] as TableRequest || null}
          onRequestChange={(request: TableRequest) => {
            setViewRequests(prev => ({
              ...prev,
              [viewToRender]: request
            }));
          }}
        />
      );
    } else if (viewConfig.view_type === 'logs') {
      return (
        <LogsDashboard
          key={viewToRender} // Add unique key to force remount
          {...commonProps}
          savedRequest={viewRequests[viewToRender] as LogsRequest || null}
          onRequestChange={(request: LogsRequest) => {
            setViewRequests(prev => ({
              ...prev,
              [viewToRender]: request
            }));
          }}
        />
      );
    } else {
      return <div>Error: Unknown view type {viewConfig.view_type}</div>;
    }
  };

  return renderCurrentView();
};

export default Dashboard;