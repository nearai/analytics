import React, { useState, useEffect, useCallback } from 'react';
import TableDashboard from './TableDashboard';
import LogsDashboard from './LogsDashboard';
import { DashboardConfig, ViewType, TableRequest, LogsRequest } from './shared/types';

interface DashboardProps {
  config?: DashboardConfig;
}

const DEFAULT_CONFIG: DashboardConfig = {
  views: ['table', 'logs'],
  globalFilters: [],
  metricSelection: 'CUSTOM',
  viewConfigs: {
    table: {
      refreshRate: undefined
    },
    logs: {
      refreshRate: undefined
    }
  },
  defaultView: 'table'
};

const Dashboard: React.FC<DashboardProps> = ({ config = DEFAULT_CONFIG }) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Determine available views
  const availableViews = finalConfig.views || ['table', 'logs'];
  const showViewsPanel = availableViews.length > 1;
  
  // Current view state
  const [currentView, setCurrentView] = useState<ViewType>(
    finalConfig.defaultView || availableViews[0] || 'table'
  );
  
  // Store requests for each view to maintain state when switching
  const [tableRequest, setTableRequest] = useState<TableRequest | null>(null);
  const [logsRequest, setLogsRequest] = useState<LogsRequest | null>(null);
  
  // Refresh intervals for each view (for web component usage)
  const [refreshIntervals, setRefreshIntervals] = useState<{
    table?: NodeJS.Timeout;
    logs?: NodeJS.Timeout;
  }>({});

  // Setup refresh intervals when used as web component
  useEffect(() => {
    const tableRefreshRate = finalConfig.viewConfigs?.table?.refreshRate;
    const logsRefreshRate = finalConfig.viewConfigs?.logs?.refreshRate;
    
    // Clear existing intervals
    setRefreshIntervals(prev => {
      Object.values(prev).forEach(interval => {
        if (interval) clearInterval(interval);
      });
      return {};
    });
    
    const newIntervals: typeof refreshIntervals = {};
    
    // Setup table refresh if specified
    if (tableRefreshRate && tableRefreshRate > 0) {
      newIntervals.table = setInterval(() => {
        if (currentView === 'table' && tableRequest) {
          // Trigger refresh by updating request
          setTableRequest(prev => prev ? { ...prev } : null);
        }
      }, tableRefreshRate * 1000);
    }
    
    // Setup logs refresh if specified
    if (logsRefreshRate && logsRefreshRate > 0) {
      newIntervals.logs = setInterval(() => {
        if (currentView === 'logs' && logsRequest) {
          // Trigger refresh by updating request
          setLogsRequest(prev => prev ? { ...prev } : null);
        }
      }, logsRefreshRate * 1000);
    }
    
    setRefreshIntervals(newIntervals);
    
    // Cleanup on unmount
    return () => {
      Object.values(newIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, [finalConfig.viewConfigs, currentView, tableRequest, logsRequest]);

  // Helper to merge global filters with request filters
  const mergeGlobalFilters = useCallback((requestFilters?: string[]): string[] => {
    const globalFilters = finalConfig.globalFilters || [];
    const filters = requestFilters || [];
    return [...globalFilters, ...filters];
  }, [finalConfig.globalFilters]);

  // Enhanced request handlers that include global filters
  const handleTableRequestChange = useCallback((request: TableRequest) => {
    const enhancedRequest = {
      ...request,
      filters: mergeGlobalFilters(request.filters)
    };
    setTableRequest(prev => {
      // Only update if the request has actually changed
      if (JSON.stringify(prev) !== JSON.stringify(enhancedRequest)) {
        return enhancedRequest;
      }
      return prev;
    });
  }, [mergeGlobalFilters]);

  const handleLogsRequestChange = useCallback((request: LogsRequest) => {
    const enhancedRequest = {
      ...request,
      filters: mergeGlobalFilters(request.filters)
    };
    setLogsRequest(prev => {
      // Only update if the request has actually changed
      if (JSON.stringify(prev) !== JSON.stringify(enhancedRequest)) {
        return enhancedRequest;
      }
      return prev;
    });
  }, [mergeGlobalFilters]);

  // Navigation handlers
  const handleNavigateToLogs = () => {
    if (availableViews.includes('logs')) {
      setCurrentView('logs');
    }
  };

  const handleNavigateToTable = () => {
    if (availableViews.includes('table')) {
      setCurrentView('table');
    }
  };

  // Render the appropriate view
  const renderCurrentView = () => {
    if (currentView === 'table' && availableViews.includes('table')) {
      return (
        <TableDashboard
          onNavigateToLogs={handleNavigateToLogs}
          savedRequest={tableRequest}
          onRequestChange={handleTableRequestChange}
          config={finalConfig}
          showViewsPanel={showViewsPanel}
        />
      );
    } else if (currentView === 'logs' && availableViews.includes('logs')) {
      return (
        <LogsDashboard
          onNavigateToTable={handleNavigateToTable}
          savedRequest={logsRequest}
          onRequestChange={handleLogsRequestChange}
          config={finalConfig}
          showViewsPanel={showViewsPanel}
        />
      );
    } else {
      // Fallback to first available view
      const fallbackView = availableViews[0];
      if (fallbackView === 'table') {
        return (
          <TableDashboard
            onNavigateToLogs={handleNavigateToLogs}
            savedRequest={tableRequest}
            onRequestChange={handleTableRequestChange}
            config={finalConfig}
            showViewsPanel={showViewsPanel}
          />
        );
      } else {
        return (
          <LogsDashboard
            onNavigateToTable={handleNavigateToTable}
            savedRequest={logsRequest}
            onRequestChange={handleLogsRequestChange}
            config={finalConfig}
            showViewsPanel={showViewsPanel}
          />
        );
      }
    }
  };

  return renderCurrentView();
};

export default Dashboard;