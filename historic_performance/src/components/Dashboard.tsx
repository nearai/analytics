import React, { useState, useEffect} from 'react';
import TimeSeriesDashboard from './TimeSeriesDashboard';
import TableDashboard from './TableDashboard';
import LogsDashboard from './LogsDashboard';
import { DashboardConfig, ViewType, TimeSeriesRequest, TableRequest, LogsRequest } from './shared/types';

interface DashboardProps {
  config?: DashboardConfig;
}

const DEFAULT_CONFIG: DashboardConfig = {
  views: ['timeseries', 'table', 'logs'],
  globalFilters: [],
  metricSelection: 'CUSTOM',
  viewConfigs: {
    timeseries: {
      refreshRate: undefined,
      defaultParameters: {
        time_filter: '1 month',
        time_granulation: '1 day'
      }
    },
    table: {
      refreshRate: undefined
    },
    logs: {
      timeFilterRecommendations: [],  // Default: disable
      refreshRate: undefined
    }
  },
  defaultView: 'timeseries'
};

const Dashboard: React.FC<DashboardProps> = ({ config = DEFAULT_CONFIG }) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Determine available views
  const availableViews = finalConfig.views || ['timeseries', 'table', 'logs'];
  
  // Current view state
  const [currentView, setCurrentView] = useState<ViewType>(
    finalConfig.defaultView || availableViews[0] || 'timeseries'
  );
  
  // Store requests for each view to maintain state when switching
  const [timeSeriesRequest, setTimeSeriesRequest] = useState<TimeSeriesRequest | null>(null);
  const [tableRequest, setTableRequest] = useState<TableRequest | null>(null);
  const [logsRequest, setLogsRequest] = useState<LogsRequest | null>(null);

  // Refresh triggers - incrementing these will cause child components to refresh
  const [timeSeriesRefreshTrigger, setTimeSeriesRefreshTrigger] = useState(0);
  const [tableRefreshTrigger, setTableRefreshTrigger] = useState(0);
  const [logsRefreshTrigger, setLogsRefreshTrigger] = useState(0);
  
  // Setup refresh intervals
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];
    
    // Setup time series refresh if specified
    const timeSeriesRefreshRate = finalConfig.viewConfigs?.timeseries?.refreshRate;
    if (timeSeriesRefreshRate && timeSeriesRefreshRate > 0) {
      const timeSeriesInterval = setInterval(() => {
        if (currentView === 'timeseries' && timeSeriesRequest) {
          setTimeSeriesRefreshTrigger(prev => prev + 1);
        }
      }, timeSeriesRefreshRate * 1000);
      intervals.push(timeSeriesInterval);
    }
    
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
  }, [finalConfig.viewConfigs, currentView, timeSeriesRequest, tableRequest, logsRequest]);

  // Navigation handlers
  const handleNavigateToTimeSeries = () => {
    if (availableViews.includes('timeseries')) {
      setCurrentView('timeseries');
    }
  };

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
    
    if (viewToRender === 'timeseries') {
      return (
        <TimeSeriesDashboard
          {...commonProps}
          onNavigateToTable={handleNavigateToTable}
          onNavigateToLogs={handleNavigateToLogs}
          savedRequest={timeSeriesRequest}
          onRequestChange={setTimeSeriesRequest}
          refreshTrigger={timeSeriesRefreshTrigger}
        />
      );
    } else if (viewToRender === 'table') {
      return (
        <TableDashboard
          {...commonProps}
          onNavigateToTimeSeries={handleNavigateToTimeSeries}
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
          onNavigateToTimeSeries={handleNavigateToTimeSeries}
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