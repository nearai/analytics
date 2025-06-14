import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Settings, Table, FileText } from 'lucide-react';
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  TimeSeriesRequest, 
  DashboardConfig, 
  TableRequest, 
  TableResponse,
  GraphConfiguration
} from './shared/types';
import { 
  CollapsibleSection, 
  FiltersSection, 
  mergeGlobalFilters 
} from './shared/SharedComponents';

interface TimeSeriesDashboardProps {
  onNavigateToTable: () => void;
  onNavigateToLogs: () => void;
  savedRequest?: TimeSeriesRequest | null;
  onRequestChange?: (request: TimeSeriesRequest) => void;
  config?: DashboardConfig;
  refreshTrigger?: number;
}

// Helper functions for time granulation
const getAutoTimeGranulation = (timeFilter: string): string => {
  if (timeFilter.includes('last hour') || timeFilter.includes('1 hour')) {
    return '1 hour';
  } else if (timeFilter.includes('last day') || timeFilter.includes('1 day')) {
    return '1 hour';
  } else if (timeFilter.includes('last week') || timeFilter.includes('1 week')) {
    return '1 hour';
  } else if (timeFilter.includes('last month') || timeFilter.includes('1 month')) {
    return '1 day';
  } else if (timeFilter.includes('last year') || timeFilter.includes('1 year')) {
    return '1 week';
  }
  return '1 day'; // default
};

const TimeSeriesDashboard: React.FC<TimeSeriesDashboardProps> = ({
  onNavigateToTable,
  onNavigateToLogs,
  savedRequest,
  onRequestChange,
  config,
  refreshTrigger
}) => {
  const getAvailableViews = (): string[] => {
    return config?.views || ['timeseries', 'table', 'logs'];
  };
  
  const shouldShowViewsPanel = (): boolean => {
    const availableViews = getAvailableViews();
    return availableViews.length > 1;
  };

  // Default request based on config
  const getDefaultRequest = (): TimeSeriesRequest => {
    const defaultParams = config?.viewConfigs?.timeseries?.defaultParameters || {};
    return {
      time_filter: defaultParams.time_filter || '1 month',
      time_granulation: defaultParams.time_granulation || '1 day',
      graphs: []
    };
  };

  const [request, setRequest] = useState<TimeSeriesRequest>(savedRequest || getDefaultRequest());
  const [filterInput, setFilterInput] = useState('');
  const [panelWidth, setPanelWidth] = useState(256);
  const [graphs, setGraphs] = useState<GraphConfiguration[]>(request.graphs || []);
  const [showGraphConfig, setShowGraphConfig] = useState<{ graphId: string; lineId?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update saved request when request changes
  useEffect(() => {
    if (onRequestChange) {
      onRequestChange(request);
    }
  }, [request, onRequestChange]);

  // Fetch column tree for metric selection
  const fetchColumnTree = useCallback(async () => {
    try {
      setLoading(true);
      const tableRequest: TableRequest = {
        filters: mergeGlobalFilters(config?.globalFilters, [request.time_filter || '']),
        slices: [],
        absent_metrics_strategy: 'accept_subset'
      };

      const response = await fetch('/api/v1/table/aggregation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tableRequest)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TableResponse = await response.json();
      // Store column tree for later use in metric selection
      console.log('Column tree loaded:', data.column_tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch column tree');
    } finally {
      setLoading(false);
    }
  }, [config?.globalFilters, request.time_filter]);

  useEffect(() => {
    fetchColumnTree();
  }, [fetchColumnTree, refreshTrigger]);

  // Handle time filter change with auto granulation
  const handleTimeFilterChange = (filter: string) => {
    const autoGranulation = getAutoTimeGranulation(filter);
    const newRequest = { 
      ...request, 
      time_filter: filter,
      time_granulation: autoGranulation
    };
    setRequest(newRequest);
  };

  const handleTimeGranulationChange = (granulation: string) => {
    const newRequest = { ...request, time_granulation: granulation };
    setRequest(newRequest);
  };

  const handleAddFilter = () => {
    if (filterInput.trim()) {
      // For time series, we might handle global filters differently
      // For now, we'll store them in the request
      setFilterInput('');
    }
  };

  const handleRemoveFilter = (filter: string) => {
    // Handle filter removal
  };

  // Resize panel functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, startWidth + (e.clientX - startX)));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Add empty graph
  const addGraph = () => {
    const newGraph: GraphConfiguration = {
      id: `graph-${Date.now()}`,
      lineConfigurations: []
    };
    const newGraphs = [...graphs, newGraph];
    setGraphs(newGraphs);
    setRequest({ ...request, graphs: newGraphs });
    setShowGraphConfig({ graphId: newGraph.id });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Control Panel */}
      <div 
        className="bg-gray-800 shadow-lg overflow-y-auto p-3 text-white relative dark-scrollbar" 
        style={{ width: `${panelWidth}px` }}
      >
        <h2 className="text-lg font-bold mb-3">Time Series Controls</h2>
        
        {/* Navigation to other views */}
        {shouldShowViewsPanel() && (
          <CollapsibleSection title="Views" defaultOpen={true}>
            <div className="space-y-2">
              {getAvailableViews().includes('table') && (
                <button
                  onClick={onNavigateToTable}
                  className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-purple-900 text-white py-2 px-4 rounded-md transition-colors text-sm"
                >
                  <Table size={16} />
                  View Table
                </button>
              )}
              {getAvailableViews().includes('logs') && (
                <button
                  onClick={onNavigateToLogs}
                  className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-purple-900 text-white py-2 px-4 rounded-md transition-colors text-sm"
                >
                  <FileText size={16} />
                  View Logs
                </button>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Time Granulation */}
        <CollapsibleSection title="Time Granulation">
          <div>
            <label className="block text-xs font-medium mb-1">Granulation</label>
            <select
              value={request.time_granulation || '1 day'}
              onChange={(e) => handleTimeGranulationChange(e.target.value)}
              className="w-full p-1.5 border rounded text-xs bg-gray-700 text-white border-gray-600"
            >
              <option value="1 hour">1 hour</option>
              <option value="1 day">1 day</option>
              <option value="1 week">1 week</option>
            </select>
          </div>
        </CollapsibleSection>

        {/* Filters */}
        <FiltersSection
          filters={[]} // TODO: Implement filter management for time series
          filterInput={filterInput}
          setFilterInput={setFilterInput}
          onAddFilter={handleAddFilter}
          onRemoveFilter={handleRemoveFilter}
          onTimeFilter={handleTimeFilterChange}
          timeFilterRecommendations={config?.viewConfigs?.timeseries?.timeFilterRecommendations}
          showTimeFilters={true}
        />
        
        {/* Resize handle */}
        <div
          className="absolute right-0 top-0 w-1 h-full cursor-ew-resize bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          onMouseDown={handleMouseDown}
        >
          <div className="w-0.5 h-8 bg-gray-500"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-600">Loading...</div>
          </div>
        )}
        
        {error && (
          <div className="m-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Time Series Dashboard</h1>
            
            {/* Graph Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Existing graphs */}
              {graphs.map((graph) => (
                <div key={graph.id} className="border border-gray-300 rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Graph {graphs.indexOf(graph) + 1}</h3>
                    <button
                      onClick={() => setShowGraphConfig({ graphId: graph.id })}
                      className="p-1 text-gray-500 hover:text-gray-700"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                  <div className="h-64 bg-gray-50 rounded flex items-center justify-center">
                    {graph.lineConfigurations.length === 0 ? (
                      <div className="text-gray-500">No lines configured</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {/* Lines will be added here */}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Add new graph placeholders */}
              {Array.from({ length: Math.max(0, 6 - graphs.length) }, (_, index) => (
                <div 
                  key={`placeholder-${index}`}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={addGraph}
                >
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <Plus size={48} className="mx-auto text-gray-400 mb-2" />
                      <div className="text-gray-500">Add Graph</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Graph Configuration Modal */}
      {showGraphConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4">Configure Graph</h3>
            
            {/* TODO: Implement graph configuration interface */}
            <div className="mb-4">
              <p className="text-gray-600">Graph configuration interface will be implemented here.</p>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowGraphConfig(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowGraphConfig(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSeriesDashboard;