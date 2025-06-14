import React, { useState, useEffect} from 'react';
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
      timeFilterRecommendations: [],
      refreshRate: undefined
    }
  },
  defaultView: 'table'
};

const Dashboard: React.FC<DashboardProps> = ({ config = DEFAULT_CONFIG }) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Determine available views
  const availableViews = finalConfig.views || ['table', 'logs'];
  
  // Current view state
  const [currentView, setCurrentView] = useState<ViewType>(
    finalConfig.defaultView || availableViews[0] || 'table'
  );
  
  // Store requests for each view to maintain state when switching
  const [tableRequest, setTableRequest] = useState<TableRequest | null>(null);
  const [logsRequest, setLogsRequest] = useState<LogsRequest | null>(null);

  // Refresh triggers - incrementing these will cause child components to refresh
  const [tableRefreshTrigger, setTableRefreshTrigger] = useState(0);
  const [logsRefreshTrigger, setLogsRefreshTrigger] = useState(0);
  
  // Setup refresh intervals
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];
    
    // Setup table refresh if specified
    const tableRefreshRate = finalConfig.viewConfigs?.table?.refreshRate;
    if (tableRefreshRate && tableRefreshRate > 0) {
      const tableInterval = setInterval(() => {
        if (currentView === 'table' && tableRequest) {
          setTableRefreshTrigger(prev => prev + 1);
        }
      }, tableRefreshRate * 1000);
      intervals.push(tableInterval);
    }
    
    // Setup logs refresh if specified
    const logsRefreshRate = finalConfig.viewConfigs?.logs?.refreshRate;
    if (logsRefreshRate && logsRefreshRate > 0) {
      const logsInterval = setInterval(() => {
        if (currentView === 'logs' && logsRequest) {
          setLogsRefreshTrigger(prev => prev + 1);
        }
      }, logsRefreshRate * 1000);
      intervals.push(logsInterval);
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      intervals.forEach(interval => clearInterval(interval));
    };
  }, [finalConfig.viewConfigs, currentView, tableRequest, logsRequest]);

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
    const viewToRender = availableViews.includes(currentView) ? currentView : availableViews[0];
    
    const commonProps = {
      config: finalConfig,
    };
    
    if (viewToRender === 'table') {
      return (
        <TableDashboard
          {...commonProps}
          onNavigateToLogs={handleNavigateToLogs}
          savedRequest={tableRequest}
          onRequestChange={setTableRequest}
          refreshTrigger={tableRefreshTrigger}
        />
      );
    } else {
      return (
        <LogsDashboard
          {...commonProps}
          onNavigateToTable={handleNavigateToTable}
          savedRequest={logsRequest}
          onRequestChange={setLogsRequest}
          refreshTrigger={logsRefreshTrigger}
        />
      );
    }
  };

  return renderCurrentView();
};

export default Dashboard;