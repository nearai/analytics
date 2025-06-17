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
  FilterHelpContent, 
  FilterManager, 
  FiltersSection, 
  mergeGlobalFilters, 
  parseTimePeriodToHours
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
  if (timeFilter.includes('hour')) {
    return '1 minute';
  } else if (timeFilter.includes('day')) {
    return '1 hour';
  } else if (timeFilter.includes('week')) {
    return '1 hour';
  } else if (timeFilter.includes('month')) {
    return '1 day';
  } else if (timeFilter.includes('year')) {
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

// Helper functions for handling color types
const getColorForLineConfig = (lineConfig: LineConfiguration, sliceValue?: string): string => {
  if (!lineConfig.color) {
    return getLineColor(lineConfig.metricName, sliceValue || '', lineConfig.filters || []);
  }
  
  if (typeof lineConfig.color === 'string') {
    return lineConfig.color;
  }

  // If color is a map and we have a slice, try to get the color for this slice value
  if (sliceValue && lineConfig.color[sliceValue]) {
    return lineConfig.color[sliceValue];
  }
  
  // Fallback to auto-generated color
  return getLineColor(lineConfig.metricName, sliceValue || '', lineConfig.filters || []);
};

const isSuccessLine = (metricName: string, sliceValue: string, filters: string[]): boolean => {
  // Check if 'success' is in metric name or slice value
  if (metricName.toLowerCase().includes('success') || sliceValue.toLowerCase().includes('success')) {
    return true;
  }
  
  // Check filters for success with lower bound > 0
  // Example: "api_call/summary/completion_calls_success:range:1:"
  for (const filter of filters) {
    if (filter.includes('success') && filter.includes('range:')) {
      const parts = filter.split(':');
      if (parts.length === 4 && parseFloat(parts[2]) > 0) {
        return true;
      }
    }
  }
  
  // Check filters for error/fail with upper bound = 0
  // Example: "errors/summary/error_count_all:range::0.0"
  for (const filter of filters) {
    if ((filter.includes('error') || filter.includes('fail')) && filter.includes('range:')) {
      const parts = filter.split(':');
      if (parts.length === 4 && parseFloat(parts[3]) === 0) {
        return true;
      }
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
  // Example: "api_call/summary/completion_calls_success:range::0"
  for (const filter of filters) {
    if (filter.includes('success') && filter.includes('range:')) {
      const parts = filter.split(':');
      if (parts.length === 4 && parseFloat(parts[3]) === 0) {
        return true;
      }
    }
  }
  
  // Check filters for error/fail with lower bound > 0
  // Example: "errors/summary/error_count_all:range:1:"
  for (const filter of filters) {
    if ((filter.includes('error') || filter.includes('fail')) && filter.includes('range:')) {
      const parts = filter.split(':');
      if (parts.length === 4 && parseFloat(parts[2]) > 0) {
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
  const isSelected = selectedPath === node.column_node_id;
  
  // Check if this is a leaf node (column_node_id doesn't end with '/')
  const isLeaf = !node.column_node_id.endsWith('/');
  
  if (!node.column_node_id.startsWith('/metrics') && level === 0) {
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
          isSelected && isLeaf ? 'bg-blue-100' : ''
        }`}
        onClick={() => {
          if (isLeaf) {
            onSelectMetric(node.name);
          } else if (hasChildren) {
            setIsExpanded(!isExpanded);
          }
        }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        <div className="flex-1">
          <span className={`text-sm ${isLeaf ? 'font-medium' : ''}`}>
            {node.name.split('/').pop()} {/* Show only the last part of the path */}
          </span>
          {node.description && (
            <span className="text-xs text-gray-500 ml-2" title={node.description}>
              {node.description}
            </span>
          )}
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child, idx) => (
            <MetricTree 
              key={child.column_node_id} 
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
  request: TimeSeriesRequest;
  config?: DashboardConfig;
}

// Convert time granulation to milliseconds
const getTimeGranulationMs = (granulation: string): number => {
  return (parseTimePeriodToHours(granulation) ?? 1) * 60 * 60 * 1000;
};

const LineConfigurationComponent: React.FC<LineConfigurationComponentProps> = ({
  lineConfig,
  onUpdate,
  onRemove,
  columnTree,
  request,
  config
}) => {
  const [filterInput, setFilterInput] = useState('');
  const [sliceValues, setSliceValues] = useState<string[]>([]);
  const [loadingSliceValues, setLoadingSliceValues] = useState(false);
  
  // Fetch slice values when slice changes
  useEffect(() => {
    const fetchSliceValues = async () => {
      if (!lineConfig.slice || !lineConfig.metricName) {
        setSliceValues([]);
        return;
      }
      
      setLoadingSliceValues(true);
      try {
        const apiRequest: TimeSeriesApiRequest = {
          time_granulation: getTimeGranulationMs(request.time_granulation || '1 day'),
          moving_aggregation_field_name: lineConfig.metricName,
          global_filters: mergeGlobalFilters(config?.globalFilters, request.filters),
          moving_aggregation_filters: lineConfig.filters,
          slice_field: lineConfig.slice
        };

        const response = await fetch('/api/v1/graphs/time-series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiRequest)
        });

        if (response.ok) {
          const data: TimeSeriesApiResponse = await response.json();
          setSliceValues(data.slice_values);
          
          // Initialize color map if needed
          if (data.slice_values.length > 0 && typeof lineConfig.color !== 'object') {
            const colorMap: Record<string, string> = {};
            data.slice_values.forEach((value, index) => {
              colorMap[value] = getLineColor(lineConfig.metricName, value, lineConfig.filters || []);
            });
            onUpdate({ ...lineConfig, color: colorMap });
          }
        }
      } catch (err) {
        console.error('Failed to fetch slice values:', err);
        setSliceValues([]);
      } finally {
        setLoadingSliceValues(false);
      }
    };

    fetchSliceValues();
  }, [lineConfig.slice, lineConfig.metricName, lineConfig.filters]); // eslint-disable-line react-hooks/exhaustive-deps
  
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
    if (slice) {
      // Switching to sliced mode - color should become a map
      onUpdate({ ...lineConfig, slice, color: {} });
    } else {
      // Switching to non-sliced mode - color should become a string
      const defaultColor = getColorForLineConfig(lineConfig);
      onUpdate({ ...lineConfig, slice: undefined, color: defaultColor });
    }
  };
  
  const handleColorChange = (color: string, sliceValue?: string) => {
    if (sliceValue && typeof lineConfig.color === 'object') {
      // Update color for specific slice value
      const newColorMap = { ...lineConfig.color, [sliceValue]: color };
      onUpdate({ ...lineConfig, color: newColorMap });
    } else if (!sliceValue) {
      // Update single color
      onUpdate({ ...lineConfig, color });
    }
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

      {/* Filters */}
      <div className="mb-3">
        <FilterManager
          title="Filters"
          items={lineConfig.filters || []}
          input={filterInput}
          setInput={setFilterInput}
          onAdd={handleAddFilter}
          onRemove={handleRemoveFilter}
          placeholder="e.g., runner:not_in:local"
          itemColor="blue"
          helpContent={<FilterHelpContent />}
        />
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
        {lineConfig.slice && loadingSliceValues && (
          <div className="mt-1 text-xs text-gray-500">Loading slice values...</div>
        )}
      </div>
      
      {/* Color(s) */}
      <div>
        <label className="block text-sm font-medium mb-1">
          {lineConfig.slice ? 'Colors' : 'Color'}
        </label>
        
        {!lineConfig.slice ? (
          // Single color picker when no slicing
          <input
            type="color"
            value={getColorForLineConfig(lineConfig)}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-16 h-8 border rounded"
          />
        ) : (
          // Multiple color pickers for each slice value
          <div className="space-y-2">
            {sliceValues.length === 0 && !loadingSliceValues && (
              <div className="text-xs text-gray-500">
                Enter metric and slice to see slice values
              </div>
            )}
            {sliceValues.map(sliceValue => {
              const currentColor = getColorForLineConfig(lineConfig, sliceValue);

              return (
                <div key={sliceValue} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentColor}
                    onChange={e => handleColorChange(e.target.value, sliceValue)}
                    className="w-12 h-6 border rounded"
                  />
                  <span className="text-sm">{sliceValue}</span>
                </div>
              );
            })}
          </div>
        )}
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
    const defaultTimeFilter = defaultParams.time_filter || '1 month';
    return {
      filters: [defaultTimeFilter],
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
  const [graphData, setGraphData] = useState<Record<string, { chartData: any[]; lineMetadata: Record<string, { configIndex: number; sliceValue?: string }> }>>({});

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
        filters: mergeGlobalFilters(config?.globalFilters, request.filters),
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
  }, [config?.globalFilters, request.filters]);

  useEffect(() => {
    fetchColumnTree();
  }, [fetchColumnTree, refreshTrigger]);

  // Fetch time series data for a graph
  const fetchTimeSeriesData = useCallback(async (graph: GraphConfiguration) => {
    const chartData: any[] = [];
    const lineMetadata: Record<string, { configIndex: number; sliceValue?: string }> = {};
    
    for (let configIndex = 0; configIndex < graph.lineConfigurations.length; configIndex++) {
      const lineConfig = graph.lineConfigurations[configIndex];
      if (!lineConfig.metricName) continue;
      
      try {
        const apiRequest: TimeSeriesApiRequest = {
          time_granulation: getTimeGranulationMs(request.time_granulation || '1 day'),
          moving_aggregation_field_name: lineConfig.metricName,
          global_filters: mergeGlobalFilters(config?.globalFilters, request.filters),
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
              const lineName = `${lineConfig.metricName.split('/').pop()}_${sliceValue}`;
              
              // Store metadata for color lookup
              lineMetadata[lineName] = { configIndex, sliceValue };
              
              timePoints.forEach((timestamp, timeIndex) => {
                if (timeIndex < lineData.length) {
                  let existingPoint = chartData.find(p => p.timestamp === timestamp);
                  if (!existingPoint) {
                    existingPoint = { timestamp, time: new Date(timestamp).toLocaleString() };
                    chartData.push(existingPoint);
                  }
                  existingPoint[lineName] = lineData[timeIndex];
                }
              });
            }
          });
        } else {
          // Single line (no slicing)
          if (data.values.length > 0) {
            const lineData = data.values[0];
            const lineName = lineConfig.metricName.split('/').pop() || lineConfig.metricName;
            
            // Store metadata for color lookup
            lineMetadata[lineName] = { configIndex };
            
            timePoints.forEach((timestamp, timeIndex) => {
              if (timeIndex < lineData.length) {
                let existingPoint = chartData.find(p => p.timestamp === timestamp);
                if (!existingPoint) {
                  existingPoint = { timestamp, time: new Date(timestamp).toLocaleString() };
                  chartData.push(existingPoint);
                }
                existingPoint[lineName] = lineData[timeIndex];
              }
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch time series data for line:', lineConfig.metricName, err);
      }
    }
    
    // Sort by timestamp and return both data and metadata
    chartData.sort((a, b) => a.timestamp - b.timestamp);
    return { chartData, lineMetadata };
  }, [request.time_granulation, request.filters, config?.globalFilters]);

  // Fetch data for all graphs
  const fetchAllGraphData = useCallback(async () => {
    if (graphs.length === 0) return;
    
    setLoading(true);
    try {
      const newGraphData: Record<string, { chartData: any[]; lineMetadata: Record<string, { configIndex: number; sliceValue?: string }> }> = {};
      
      for (const graph of graphs) {
        const result = await fetchTimeSeriesData(graph);
        newGraphData[graph.id] = result;
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
    const newFilters = (request.filters || []).filter(f => !f.startsWith('time_end_utc:'));
    const autoGranulation = getAutoTimeGranulation(filter);
    const newRequest = { 
      ...request, 
      filters: [...newFilters, filter],
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
      const newFilters = [...(request.filters || []), filterInput.trim()];
      const newRequest = { ...request, filters: newFilters };
      setRequest(newRequest);
      setFilterInput('');
    }
  };

  const handleRemoveFilter = (filter: string) => {
    const newFilters = (request.filters || []).filter(f => f !== filter);
    const newRequest = { ...request, filters: newFilters };
    setRequest(newRequest);
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

  // Add empty graph at specific index
  const addGraph = (index?: number) => {
    const newGraph: GraphConfiguration = {
      id: `graph-${Date.now()}`,
      lineConfigurations: []
    };
    
    let newGraphs: GraphConfiguration[];
    if (index !== undefined) {
      // Fill with empty graphs if needed
      const currentGraphs = [...graphs];
      while (currentGraphs.length < index) {
        currentGraphs.push({
          id: `empty-graph-${Date.now()}-${currentGraphs.length}`,
          lineConfigurations: []
        });
      }
      // Insert at specific position
      newGraphs = [...currentGraphs];
      newGraphs[index] = newGraph;
    } else {
      // Add at the end
      newGraphs = [...graphs, newGraph];
    }
    
    setGraphs(newGraphs);
    setRequest({ ...request, graphs: newGraphs });
    setShowGraphConfig({ graphId: newGraph.id });
  };

  // Component for Add Graph placeholder
  const AddGraphPlaceholder: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div 
      className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <Plus size={48} className="mx-auto text-gray-400 mb-2" />
          <div className="text-gray-500">Add Graph</div>
        </div>
      </div>
    </div>
  );

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
            <input
              type="text"
              value={request.time_granulation || '1 day'}
              onChange={(e) => handleTimeGranulationChange(e.target.value)}
              list="granulation-options"
              placeholder="e.g., 1 minute, 1 hour, 1 day"
              className="w-full p-1.5 border rounded text-xs bg-gray-700 text-white border-gray-600 placeholder-gray-400"
            />
            <datalist id="granulation-options">
              <option value="1 minute" />
              <option value="1 hour" />
              <option value="1 day" />
              <option value="1 week" />
            </datalist>
          </div>
        </CollapsibleSection>

        {/* Filters */}
        <FiltersSection
          filters={request.filters || []}
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
            {/* Graph Grid */}
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: Math.max(6, 2 + graphs.length) }).map((_, slotIdx) => {
                const graph = graphs[slotIdx];
                const isPlaceholder = !graph || graph.id.startsWith('empty-graph');

                /* ───── 1. A true graph card ───── */
                if (!isPlaceholder) {
                  return (
                    <div key={graph.id} className="border border-gray-300 rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">Graph {graphs.indexOf(graph) + 1}</h3>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setShowGraphConfig({ graphId: graph.id })}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Configure graph"
                          >
                            <Settings size={16} />
                          </button>
                          <button
                            onClick={() => {
                              const newGraphs = graphs.filter(g => g.id !== graph.id);
                              setGraphs(newGraphs);
                              setRequest({ ...request, graphs: newGraphs });
                            }}
                            className="p-1 text-red-500 hover:text-red-700"
                            title="Remove graph"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Display line configurations */}
                      {graph.lineConfigurations.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs text-gray-600 mb-1">Lines:</div>
                          <div className="flex flex-wrap gap-1">
                            {graph.lineConfigurations.map((lineConfig, idx) => {
                              // collect distinct slice values (if any) that belong to this config in the chart data
                              const sliceDots =
                                lineConfig.slice
                                  ? Object.values(graphData[graph.id]?.lineMetadata || {})
                                      .filter((m: any) => m.configIndex === idx)          // only this lineConfig
                                      .reduce<(readonly [string, string])[]>((acc, m) => { // [sliceValue, color]
                                        if (!acc.some(([v]) => v === m.sliceValue)) {
                                          acc.push([m.sliceValue || "", getColorForLineConfig(lineConfig, m.sliceValue)]);
                                        }
                                        return acc;
                                      }, [])
                                  : [];

                              return (
                                <div
                                  key={idx}
                                  onClick={() => setShowGraphConfig({ graphId: graph.id })}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs
                                            cursor-pointer hover:bg-gray-200"
                                >
                                  {/* one dot per slice, or a single dot if no slice */}
                                  {sliceDots.length > 0
                                    ? sliceDots.map(([val, col]) => (
                                        <div
                                          key={val}
                                          className="w-3 h-3 rounded-full"
                                          style={{ backgroundColor: col }}
                                          title={val}                           // tooltip shows slice value
                                        />
                                      ))
                                    : (
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: getColorForLineConfig(lineConfig) }}
                                      />
                                    )
                                  }

                                  <span>
                                    {lineConfig.metricName.split('/').pop()}
                                    {lineConfig.slice && ` (${lineConfig.slice})`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <div className="h-64 bg-gray-50 rounded">
                        {graph.lineConfigurations.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-gray-500">
                            No lines configured
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={graphData[graph.id]?.chartData || []}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" fontSize={10} />
                              <YAxis fontSize={10} />
                              <Tooltip />
                              <Legend />
                              {/* Render lines based on available data keys */}
                              {Object.keys(graphData[graph.id]?.chartData?.[0] || {})
                                .filter(k => k !== 'timestamp' && k !== 'time')
                                .map(dataKey => {
                                  const metadata   = graphData[graph.id]?.lineMetadata?.[dataKey];
                                  const lineConfig = metadata ? graph.lineConfigurations[metadata.configIndex] : undefined;

                                  const color = lineConfig
                                    ? getColorForLineConfig(lineConfig, metadata?.sliceValue)
                                    : DEFAULT_COLORS[0];

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
                                })}
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  )}
                
                /* ───── 2. Empty slot → “Add Graph” placeholder ───── */
                return (
                  <AddGraphPlaceholder
                    key={`placeholder-${slotIdx}`}
                    onClick={() => addGraph(slotIdx)}
                  />
                );
              })}  
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
          request={request}
          config={config}
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
  request: TimeSeriesRequest;
  config?: DashboardConfig;
  onClose: () => void;
  onSave: (graphs: GraphConfiguration[]) => void;
}

const GraphConfigModal: React.FC<GraphConfigModalProps> = ({
  graphId,
  graphs,
  setGraphs,
  columnTree,
  request,
  config,
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

  const handleSave = useCallback(() => {
    // Validate that all line configurations have a metric selected
    const validConfigs = localLineConfigs.filter(config => config.metricName.trim() !== '');
    
    if (validConfigs.length === 0) {
      alert('Please add at least one line configuration with a metric selected.');
      return;
    }
    // Ensure all valid configurations have colors assigned
    const configsWithColors = validConfigs.map(config => {
      if (!config.color) {
        // Assign a color if none is set
        const autoColor = getLineColor(config.metricName, config.slice || '', config.filters || []);
        return { ...config, color: autoColor };
      }
      return config;
    });
    // Update the graph in the graphs array
    const updatedGraphs = graphs.map(g => 
      g.id === graphId 
        ? { ...g, lineConfigurations: configsWithColors }
        : g
    );
    
    onSave(updatedGraphs);
  }, [localLineConfigs, graphs, graphId, onSave]);

  useEffect(() => {
    // Handle Esc key press
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSave();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [handleSave]);

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
              request={request}
              config={config}
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