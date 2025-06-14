import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Settings, Table, FileText, X, ChevronDown, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  TimeSeriesRequest, 
  DashboardConfig, 
  TableRequest, 
  TableResponse,
  GraphConfiguration,
  LineConfiguration,
  ColumnNode,
  TimeSeriesApiRequest,
  TimeSeriesApiResponse
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

// Color schemes for lines
const SUCCESS_COLORS = ['#10b981', '#059669', '#047857', '#065f46'];
const ERROR_COLORS = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'];
const DEFAULT_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#84cc16', '#f97316'];

const getLineColor = (metricName: string, sliceValue: string, filters: string[]): string => {
  const isSuccess = isSuccessLine(metricName, sliceValue, filters);
  const isError = isErrorLine(metricName, sliceValue, filters);
  
  if (isSuccess) {
    return SUCCESS_COLORS[Math.floor(Math.random() * SUCCESS_COLORS.length)];
  } else if (isError) {
    return ERROR_COLORS[Math.floor(Math.random() * ERROR_COLORS.length)];
  } else {
    return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
  }
};

const isSuccessLine = (metricName: string, sliceValue: string, filters: string[]): boolean => {
  // Check if 'success' is in metric name or slice value
  if (metricName.toLowerCase().includes('success') || sliceValue.toLowerCase().includes('success')) {
    return true;
  }
  
  // Check filters for success with lower bound > 0
  for (const filter of filters) {
    if (filter.includes('success') && filter.includes('range:') && filter.includes(':')) {
      const parts = filter.split(':');
      if (parts.length >= 4 && parseFloat(parts[3]) > 0) {
        return true;
      }
    }
  }
  
  // Check filters for error/fail with upper bound = 0
  for (const filter of filters) {
    if ((filter.includes('error') || filter.includes('fail')) && filter.includes('range:') && filter.includes('::0')) {
      return true;
    }
  }
  
  return false;
};

const isErrorLine = (metricName: string, sliceValue: string, filters: string[]): boolean => {
  // Check if 'fail' or 'error' is in metric name or slice value
  if (metricName.toLowerCase().includes('fail') || metricName.toLowerCase().includes('error') || 
      sliceValue.toLowerCase().includes('fail') || sliceValue.toLowerCase().includes('error')) {
    return true;
  }
  
  // Check filters for success with upper bound = 0
  for (const filter of filters) {
    if (filter.includes('success') && filter.includes('range:') && filter.includes('::0')) {
      return true;
    }
  }
  
  // Check filters for error/fail with lower bound > 0
  for (const filter of filters) {
    if ((filter.includes('error') || filter.includes('fail')) && filter.includes('range:') && filter.includes(':')) {
      const parts = filter.split(':');
      if (parts.length >= 4 && parseFloat(parts[3]) > 0) {
        return true;
      }
    }
  }
  
  return false;
};

// Metric Tree Component for selecting metrics
interface MetricTreeProps {
  node: ColumnNode;
  selectedPath: string;
  onSelectMetric: (path: string) => void;
  level?: number;
}

const MetricTree: React.FC<MetricTreeProps> = ({ node, selectedPath, onSelectMetric, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedPath === node.name;
  
  // Only show metrics (leaf nodes under '/metrics/')
  const isMetric = !hasChildren && node.name.startsWith('metrics/');
  
  if (!node.name.startsWith('metrics/') && level === 0) {
    // If this is the root and doesn't start with metrics/, look for metrics/ children
    const metricsChild = node.children?.find(child => child.name === 'metrics');
    if (metricsChild) {
      return <MetricTree node={metricsChild} selectedPath={selectedPath} onSelectMetric={onSelectMetric} level={level} />;
    }
    return null;
  }

  return (
    <div className={`${level > 0 ? 'ml-4' : ''}`}>
      <div 
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 ${
          isSelected ? 'bg-blue-100' : ''
        }`}
        onClick={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          } else if (isMetric) {
            onSelectMetric(node.name);
          }
        }}
      >
        {hasChildren && (
          isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        )}
        <span className={`text-sm ${isMetric ? 'font-medium' : ''}`}>
          {node.name.split('/').pop()} {/* Show only the last part of the path */}
        </span>
      </div>
      
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child, idx) => (
            <MetricTree 
              key={idx} 
              node={child} 
              selectedPath={selectedPath} 
              onSelectMetric={onSelectMetric} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Line Configuration Component
interface LineConfigurationComponentProps {
  lineConfig: LineConfiguration;
  onUpdate: (config: LineConfiguration) => void;
  onRemove: () => void;
  columnTree: ColumnNode | null;
}

const LineConfigurationComponent: React.FC<LineConfigurationComponentProps> = ({
  lineConfig,
  onUpdate,
  onRemove,
  columnTree
}) => {
  const [filterInput, setFilterInput] = useState('');
  
  const handleMetricSelect = (metricName: string) => {
    onUpdate({ ...lineConfig, metricName });
  };
  
  const handleAddFilter = () => {
    if (filterInput.trim()) {
      const newFilters = [...(lineConfig.filters || []), filterInput.trim()];
      onUpdate({ ...lineConfig, filters: newFilters });
      setFilterInput('');
    }
  };
  
  const handleRemoveFilter = (filterToRemove: string) => {
    const newFilters = (lineConfig.filters || []).filter(f => f !== filterToRemove);
    onUpdate({ ...lineConfig, filters: newFilters });
  };
  
  const handleSliceChange = (slice: string) => {
    onUpdate({ ...lineConfig, slice: slice || undefined });
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 mb-4 bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium">Line Configuration</h4>
        <button
          onClick={onRemove}
          className="text-red-500 hover:text-red-700"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Metric Selection */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Metric *</label>
        <div className="border border-gray-300 rounded p-2 max-h-48 overflow-y-auto bg-white">
          {columnTree ? (
            <MetricTree 
              node={columnTree} 
              selectedPath={lineConfig.metricName} 
              onSelectMetric={handleMetricSelect} 
            />
          ) : (
            <div className="text-gray-500 text-sm">Loading metrics...</div>
          )}
        </div>
        {lineConfig.metricName && (
          <div className="mt-1 text-xs text-gray-600">
            Selected: {lineConfig.metricName}
          </div>
        )}
      </div>
      
      {/* Filters */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Filters</label>
        {lineConfig.filters && lineConfig.filters.length > 0 && (
          <div className="mb-2">
            <div className="flex flex-wrap gap-1">
              {lineConfig.filters.map((filter, idx) => (
                <div key={idx} className="inline-flex items-center bg-blue-100 px-2 py-1 rounded-full">
                  <button
                    onClick={() => handleRemoveFilter(filter)}
                    className="text-red-400 hover:text-red-600 mr-1"
                  >
                    <X size={10} />
                  </button>
                  <span className="text-xs">{filter}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddFilter()}
            placeholder="e.g., runner:not_in:local"
            className="flex-1 p-1.5 border rounded text-sm"
          />
          <button
            onClick={handleAddFilter}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
      
      {/* Slice */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Slice</label>
        <input
          type="text"
          value={lineConfig.slice || ''}
          onChange={(e) => handleSliceChange(e.target.value)}
          placeholder="e.g., agent_name"
          className="w-full p-1.5 border rounded text-sm"
        />
      </div>
      
      {/* Color */}
      <div>
        <label className="block text-sm font-medium mb-1">Color</label>
        <input
          type="color"
          value={lineConfig.color || getLineColor(lineConfig.metricName, lineConfig.slice || '', lineConfig.filters || [])}
          onChange={(e) => onUpdate({ ...lineConfig, color: e.target.value })}
          className="w-16 h-8 border rounded"
        />
      </div>
    </div>
  );
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
  const [columnTree, setColumnTree] = useState<ColumnNode | null>(null);
  const [graphs, setGraphs] = useState<GraphConfiguration[]>(request.graphs || []);
  const [showGraphConfig, setShowGraphConfig] = useState<{ graphId: string; lineId?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<Record<string, any[]>>({});

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
      setColumnTree(data.column_tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch column tree');
    } finally {
      setLoading(false);
    }
  }, [config?.globalFilters, request.time_filter]);

  useEffect(() => {
    fetchColumnTree();
  }, [fetchColumnTree, refreshTrigger]);

  // Convert time granulation to milliseconds
  const getTimeGranulationMs = (granulation: string): number => {
    switch (granulation) {
      case '1 hour': return 60 * 60 * 1000;
      case '1 day': return 24 * 60 * 60 * 1000;
      case '1 week': return 7 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  };

  // Fetch time series data for a graph
  const fetchTimeSeriesData = useCallback(async (graph: GraphConfiguration) => {
    const chartData: any[] = [];
    
    for (const lineConfig of graph.lineConfigurations) {
      if (!lineConfig.metricName) continue;
      
      try {
        const apiRequest: TimeSeriesApiRequest = {
          time_granulation: getTimeGranulationMs(request.time_granulation || '1 day'),
          moving_aggregation_field_name: lineConfig.metricName,
          global_filters: mergeGlobalFilters(config?.globalFilters, [request.time_filter || '']),
          moving_aggregation_filters: lineConfig.filters,
          slice_field: lineConfig.slice
        };

        const response = await fetch('/api/v1/graphs/time-series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiRequest)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: TimeSeriesApiResponse = await response.json();
        
        // Convert API response to chart data
        const timePoints: number[] = [];
        const numPoints = data.values.length > 0 ? data.values[0].length : 0;
        for (let i = 0; i < numPoints; i++) {
          timePoints.push(data.time_begin + i * data.time_granulation);
        }

        if (data.slice_values.length > 0) {
          // Multiple lines (sliced data)
          data.slice_values.forEach((sliceValue, sliceIndex) => {
            if (sliceIndex < data.values.length) {
              const lineData = data.values[sliceIndex];
              timePoints.forEach((timestamp, timeIndex) => {
                if (timeIndex < lineData.length) {
                  let existingPoint = chartData.find(p => p.timestamp === timestamp);
                  if (!existingPoint) {
                    existingPoint = { timestamp, time: new Date(timestamp).toLocaleString() };
                    chartData.push(existingPoint);
                  }
                  const lineName = `${lineConfig.metricName.split('/').pop()}_${sliceValue}`;
                  existingPoint[lineName] = lineData[timeIndex];
                }
              });
            }
          });
        } else {
          // Single line (no slicing)
          if (data.values.length > 0) {
            const lineData = data.values[0];
            timePoints.forEach((timestamp, timeIndex) => {
              if (timeIndex < lineData.length) {
                let existingPoint = chartData.find(p => p.timestamp === timestamp);
                if (!existingPoint) {
                  existingPoint = { timestamp, time: new Date(timestamp).toLocaleString() };
                  chartData.push(existingPoint);
                }
                const lineName = lineConfig.metricName.split('/').pop() || lineConfig.metricName;
                existingPoint[lineName] = lineData[timeIndex];
              }
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch time series data for line:', lineConfig.metricName, err);
      }
    }
    
    // Sort by timestamp
    chartData.sort((a, b) => a.timestamp - b.timestamp);
    return chartData;
  }, [request.time_granulation, request.time_filter, config?.globalFilters]);

  // Fetch data for all graphs
  const fetchAllGraphData = useCallback(async () => {
    if (graphs.length === 0) return;
    
    setLoading(true);
    try {
      const newGraphData: Record<string, any[]> = {};
      
      for (const graph of graphs) {
        const data = await fetchTimeSeriesData(graph);
        newGraphData[graph.id] = data;
      }
      
      setGraphData(newGraphData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch graph data');
    } finally {
      setLoading(false);
    }
  }, [graphs, fetchTimeSeriesData]);

  // Fetch graph data when graphs change or refresh is triggered
  useEffect(() => {
    fetchAllGraphData();
  }, [fetchAllGraphData, refreshTrigger]);

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
                  <div className="h-64 bg-gray-50 rounded">
                    {graph.lineConfigurations.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        No lines configured
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={graphData[graph.id] || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" fontSize={10} />
                          <YAxis fontSize={10} />
                          <Tooltip />
                          <Legend />
                          {/* Render lines based on available data keys */}
                          {Object.keys(graphData[graph.id]?.[0] || {})
                            .filter(key => key !== 'timestamp' && key !== 'time')
                            .map((dataKey, idx) => {
                              const lineConfig = graph.lineConfigurations[idx % graph.lineConfigurations.length];
                              const color = lineConfig?.color || getLineColor(
                                lineConfig?.metricName || dataKey, 
                                lineConfig?.slice || '', 
                                lineConfig?.filters || []
                              );
                              
                              return (
                                <Line 
                                  key={dataKey}
                                  type="monotone" 
                                  dataKey={dataKey} 
                                  stroke={color}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              );
                            })
                          }
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
        <GraphConfigModal
          graphId={showGraphConfig.graphId}
          graphs={graphs}
          setGraphs={setGraphs}
          columnTree={columnTree}
          onClose={() => setShowGraphConfig(null)}
          onSave={(updatedGraphs) => {
            setGraphs(updatedGraphs);
            setRequest({ ...request, graphs: updatedGraphs });
            setShowGraphConfig(null);
          }}
        />
      )}
    </div>
  );
};

// Graph Configuration Modal Component
interface GraphConfigModalProps {
  graphId: string;
  graphs: GraphConfiguration[];
  setGraphs: (graphs: GraphConfiguration[]) => void;
  columnTree: ColumnNode | null;
  onClose: () => void;
  onSave: (graphs: GraphConfiguration[]) => void;
}

const GraphConfigModal: React.FC<GraphConfigModalProps> = ({
  graphId,
  graphs,
  setGraphs,
  columnTree,
  onClose,
  onSave
}) => {
  const graph = graphs.find(g => g.id === graphId);
  
  // Initialize with existing configurations or create a default one
  const [localLineConfigs, setLocalLineConfigs] = useState<LineConfiguration[]>(() => {
    const existing = graph?.lineConfigurations || [];
    if (existing.length === 0) {
      return [{
        id: `line-${Date.now()}`,
        metricName: '',
        filters: [],
        slice: undefined,
        color: undefined
      }];
    }
    return existing;
  });

  useEffect(() => {
    // Handle Esc key press
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const addLineConfiguration = () => {
    const newLineConfig: LineConfiguration = {
      id: `line-${Date.now()}`,
      metricName: '',
      filters: [],
      slice: undefined,
      color: undefined
    };
    setLocalLineConfigs([...localLineConfigs, newLineConfig]);
  };

  const updateLineConfiguration = (index: number, config: LineConfiguration) => {
    const newConfigs = [...localLineConfigs];
    newConfigs[index] = config;
    setLocalLineConfigs(newConfigs);
  };

  const removeLineConfiguration = (index: number) => {
    const newConfigs = localLineConfigs.filter((_, i) => i !== index);
    setLocalLineConfigs(newConfigs);
  };

  const handleSave = () => {
    // Validate that all line configurations have a metric selected
    const validConfigs = localLineConfigs.filter(config => config.metricName.trim() !== '');
    
    if (validConfigs.length === 0) {
      alert('Please add at least one line configuration with a metric selected.');
      return;
    }

    // Update the graph in the graphs array
    const updatedGraphs = graphs.map(g => 
      g.id === graphId 
        ? { ...g, lineConfigurations: validConfigs }
        : g
    );
    
    onSave(updatedGraphs);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
        <h3 className="text-lg font-semibold mb-4">Configure Graph Lines</h3>
        
        <div className="mb-4">
          {localLineConfigs.map((lineConfig, index) => (
            <LineConfigurationComponent
              key={lineConfig.id}
              lineConfig={lineConfig}
              onUpdate={(config) => updateLineConfiguration(index, config)}
              onRemove={() => removeLineConfiguration(index)}
              columnTree={columnTree}
            />
          ))}
          
          <button
            onClick={addLineConfiguration}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800"
          >
            + Add Line Configuration
          </button>
        </div>
        
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeSeriesDashboard;