import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Settings, X, ChevronDown, ChevronRight } from 'lucide-react';
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
  ParameterManager, 
  FiltersSection,
  ViewNavigation,
  getTimeFilter, 
  mergeGlobalFilters, 
  parseTimePeriodToHours,
  getApiUrl,
  fetchImportantMetrics,
  ImportantMetricsResponse
} from './shared/SharedComponents';

interface TimeSeriesDashboardProps {
  onNavigateToView?: (viewId: string) => void;
  savedRequest?: TimeSeriesRequest | null;
  onRequestChange?: (request: TimeSeriesRequest) => void;
  config?: DashboardConfig;
  viewId?: string;
  viewConfig?: import('./shared/types').ViewConfig;
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
const DEFAULT_COLORS = ['#f59e0b', '#8b5cf6', '#3b82f6', '#06b6d4', '#84cc16', '#f97316'];

// Simple hash function to generate deterministic color selection
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

// Helper function to make a color darker by reducing lightness
const makeDarkerColor = (hexColor: string): string => {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // Make darker by reducing each component by about 30%
  const darkerR = Math.floor(r * 0.7);
  const darkerG = Math.floor(g * 0.7);
  const darkerB = Math.floor(b * 0.7);
  
  // Convert back to hex
  return `#${darkerR.toString(16).padStart(2, '0')}${darkerG.toString(16).padStart(2, '0')}${darkerB.toString(16).padStart(2, '0')}`;
};

// Helper function to adjust hue of a color
const adjustHue = (color: string, hueShift: number): string => {
  // Convert hex to HSL
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const s = max === 0 ? 0 : (max - min) / max;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  // Apply hue shift and normalize
  h = (h * 360 + hueShift) % 360;
  if (h < 0) h += 360;
  
  // Convert back to RGB
  const hslToRgb = (h: number, s: number, l: number) => {
    h /= 360;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    if (s === 0) {
      return [l, l, l]; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      return [
        hue2rgb(p, q, h + 1/3),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 1/3)
      ];
    }
  };
  
  const [newR, newG, newB] = hslToRgb(h, s, l);
  
  // Convert back to hex
  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

const getLineColor = (metricName: string, sliceValue: string, filters: string[]): string => {
  const isSuccess = isSuccessLine(metricName, sliceValue, filters);
  const isError = isErrorLine(metricName, sliceValue, filters);

  // Transform metricName before creating the hash key
  const normalizedMetricName = metricName
    .replace(/\/(min_value|max_value)$/g, '') // Remove /min_value and /max_value suffixes
    .replace(/\b(avg|min|max)\b/gi, ''); // Remove occurrences of 'avg', 'min', 'max'
  
  // Create a deterministic key from the inputs
  const key = `${normalizedMetricName}|${sliceValue}|${filters.join(',')}`;
  const hash = hashString(key);
  
  let baseColor: string;
  if (isSuccess) {
    baseColor = SUCCESS_COLORS[hash % SUCCESS_COLORS.length];
  } else if (isError) {
    baseColor = ERROR_COLORS[hash % ERROR_COLORS.length];
  } else {
    baseColor = DEFAULT_COLORS[hash % DEFAULT_COLORS.length];
  }

  // Apply small hue diversion based on hash
  const hueShift = 2 * (((hash >> 8) % 21) - 10);
  baseColor = adjustHue(baseColor, hueShift);
  
  // Make darker if this is a "Max" metric (for latency graphs)
  if (metricName.toLowerCase().includes('max') || 
      (sliceValue && sliceValue.toLowerCase().includes('max'))) {
    return makeDarkerColor(baseColor);
  }
  
  return baseColor;
};

// Helper functions for handling color types
const getColorForLineConfig = (lineConfig: LineConfiguration, sliceValue?: string): string => {
  // Check if user has manually set this color
  const hasUserSetColor = sliceValue 
    ? (typeof lineConfig.userSetColor === 'object' && lineConfig.userSetColor?.[sliceValue])
    : (typeof lineConfig.userSetColor === 'boolean' && lineConfig.userSetColor);
  
  // If user set the color, return it
  if (hasUserSetColor && lineConfig.color) {
    if (typeof lineConfig.color === 'string') {
      return lineConfig.color;
    }
    if (sliceValue && lineConfig.color[sliceValue]) {
      return lineConfig.color[sliceValue];
    }
  }
  
  // Auto-generate color based on current category
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

// Helper to count slice values for a given metric
const getSliceValueCount = async (
  metricName: string, 
  sliceField: string,
  config?: DashboardConfig,
  requestFilters?: string[]
): Promise<number> => {
  try {
    const apiRequest: TimeSeriesApiRequest = {
      time_granulation: 24 * 60 * 60 * 1000, // 1 day in ms
      moving_aggregation_field_name: metricName,
      global_filters: mergeGlobalFilters(config?.globalFilters, requestFilters),
      slice_field: sliceField
    };

    const timeSeriesUrl = getApiUrl(config?.metrics_service_url, 'graphs/time-series');
    const response = await fetch(timeSeriesUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequest)
    });

    if (response.ok) {
      const data: TimeSeriesApiResponse = await response.json();
      return data.slice_values.length;
    }
  } catch (err) {
    console.error('Failed to get slice value count:', err);
  }
  return 0;
};

// Function to create initial graphs from important metrics
const createInitialGraphsFromImportantMetrics = async (
  importantMetrics: ImportantMetricsResponse,
  config?: DashboardConfig,
  requestFilters?: string[]
): Promise<GraphConfiguration[]> => {
  const graphs: GraphConfiguration[] = [];

  // 1. Agent Invocations - Single line
  if (importantMetrics['Agent Invocations']) {
    const [filters, fieldName] = importantMetrics['Agent Invocations'];
    graphs.push({
      id: `graph-${Date.now()}-agent-invocations`,
      name: 'Agent Invocations',
      lineConfigurations: [{
        id: `line-${Date.now()}-agent-invocations`,
        metricName: fieldName,
        filters: filters,
        displayName: 'Agent Invocations',
        color: getLineColor(fieldName, '', filters),
        userSetColor: true
      }]
    });
  }

  // 2. Successful/Failed Invocations - Two lines
  if (importantMetrics['Successful Invocations'] && importantMetrics['Failed Invocations']) {
    const [successFilters, successField] = importantMetrics['Successful Invocations'];
    const [failFilters, failField] = importantMetrics['Failed Invocations'];
    
    graphs.push({
      id: `graph-${Date.now()}-success-fail-invocations`,
      name: 'Successful/Failed Invocations',
      lineConfigurations: [
        {
          id: `line-${Date.now()}-successful`,
          metricName: successField,
          filters: successFilters,
          displayName: 'Successful Invocations',
          color: getLineColor(successField, '', successFilters),
          userSetColor: true
        },
        {
          id: `line-${Date.now()}-failed`,
          metricName: failField,
          filters: failFilters,
          displayName: 'Failed Invocations',
          color: getLineColor(failField, '', failFilters),
          userSetColor: false
        }
      ]
    });
  }

  // 3. Avg/Max Agent Latency - Two lines, slice by agent_name if < 7 agents
  if (importantMetrics['Avg Agent Latency'] && importantMetrics['Max Agent Latency']) {
    const [avgFilters, avgField] = importantMetrics['Avg Agent Latency'];
    const [maxFilters, maxField] = importantMetrics['Max Agent Latency'];
    
    // Check agent count
    const agentCount = await getSliceValueCount(avgField, 'agent_name', config, requestFilters);
    const shouldSlice = agentCount > 0 && agentCount < 7;
    
    graphs.push({
      id: `graph-${Date.now()}-agent-latency`,
      name: 'Avg/Max Agent Latency',
      lineConfigurations: [
        {
          id: `line-${Date.now()}-avg-agent`,
          metricName: avgField,
          filters: avgFilters,
          slice: shouldSlice ? 'agent_name' : undefined,
          displayName: shouldSlice ? 'avg' : 'Avg Agent Latency',
          color: shouldSlice ? {} : getLineColor(avgField, '', avgFilters),
          userSetColor: shouldSlice ? {} : true
        },
        {
          id: `line-${Date.now()}-max-agent`,
          metricName: maxField,
          filters: maxFilters,
          slice: shouldSlice ? 'agent_name' : undefined,
          displayName: shouldSlice ? 'max' : 'Max Agent Latency',
          color: shouldSlice ? {} : getLineColor(maxField, '', maxFilters),
          userSetColor: shouldSlice ? {} : true
        }
      ]
    });
  }

  // 4. Avg/Max Runner Latency - Sliced by runner
  if (importantMetrics['Avg Runner Start Latency'] && importantMetrics['Max Runner Start Latency']) {
    const [avgFilters, avgField] = importantMetrics['Avg Runner Start Latency'];
    const [maxFilters, maxField] = importantMetrics['Max Runner Start Latency'];
    
    graphs.push({
      id: `graph-${Date.now()}-runner-latency`,
      name: 'Avg/Max Runner Latency',
      lineConfigurations: [
        {
          id: `line-${Date.now()}-avg-runner`,
          metricName: avgField,
          filters: avgFilters,
          slice: 'runner',
          displayName: 'avg',
          color: {},
          userSetColor: {}
        },
        {
          id: `line-${Date.now()}-max-runner`,
          metricName: maxField,
          filters: maxFilters,
          slice: 'runner',
          displayName: 'max',
          color: {},
          userSetColor: {}
        }
      ]
    });
  }

  // 5. Avg/Max Completion Latency - Sliced by model if < 7 models
  if (importantMetrics['Avg Completion Latency'] && importantMetrics['Max Completion Latency']) {
    const [avgFilters, avgField] = importantMetrics['Avg Completion Latency'];
    const [maxFilters, maxField] = importantMetrics['Max Completion Latency'];
    
    // Check model count
    const modelCount = await getSliceValueCount(avgField, 'model', config, requestFilters);
    const shouldSlice = modelCount > 0 && modelCount < 7;
    
    graphs.push({
      id: `graph-${Date.now()}-completion-latency`,
      name: 'Avg/Max Completion Latency',
      lineConfigurations: [
        {
          id: `line-${Date.now()}-avg-completion`,
          metricName: avgField,
          filters: avgFilters,
          slice: shouldSlice ? 'model' : undefined,
          displayName: shouldSlice ? 'avg' : 'Avg Completion Latency',
          color: shouldSlice ? {} : getLineColor(avgField, '', avgFilters),
          userSetColor: shouldSlice ? {} : true
        },
        {
          id: `line-${Date.now()}-max-completion`,
          metricName: maxField,
          filters: maxFilters,
          slice: shouldSlice ? 'model' : undefined,
          displayName: shouldSlice ? 'max' : 'Max Completion Latency',
          color: shouldSlice ? {} : getLineColor(maxField, '', maxFilters),
          userSetColor: shouldSlice ? {} : true
        }
      ]
    });
  }

  return graphs;
};

// Metric Tree Component for selecting metrics
interface MetricTreeProps {
  node: ColumnNode;
  selectedPath: string;
  onSelectMetric: (path: string) => void;
  level?: number;
}

const MetricTree: React.FC<MetricTreeProps> = ({ node, selectedPath, onSelectMetric, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2 && !node.column_node_id.startsWith('/metadata'));
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedPath === node.column_node_id;
  
  // Check if this is a leaf node (column_node_id doesn't end with '/')
  const isLeaf = !node.column_node_id.endsWith('/');
  
  return (
    <div className={`${level > 0 ? 'ml-4' : ''}`}>
      <div 
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 ${
          isSelected && isLeaf ? 'bg-blue-100' : ''
        }`}
        onClick={() => {
          if (isLeaf) {
            onSelectMetric(node.column_node_id.replace(/^\/(?:metrics|metadata)\//, ''));
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
  totalLineConfigsCount?: number;
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
  config,
  totalLineConfigsCount = 1
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

        const timeSeriesUrl = getApiUrl(config?.metrics_service_url, 'graphs/time-series');
        const response = await fetch(timeSeriesUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiRequest)
        });

        if (response.ok) {
          const data: TimeSeriesApiResponse = await response.json();
          setSliceValues(data.slice_values);
          
          // Initialize color map if needed, but don't overwrite user-set colors
          if (data.slice_values.length > 0 && typeof lineConfig.color !== 'object') {
            const colorMap: Record<string, string> = {};
            const userSetColorMap: Record<string, boolean> = {};
            data.slice_values.forEach((value, index) => {
              colorMap[value] = getLineColor(lineConfig.metricName, value, lineConfig.filters || []);
              userSetColorMap[value] = false; // Mark as auto-generated
            });
            onUpdate({ ...lineConfig, color: colorMap, userSetColor: userSetColorMap });
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
      onUpdate({ ...lineConfig, slice, color: {}, userSetColor: {} });
    } else {
      // Switching to non-sliced mode - color should become a string and clear slice line names
      const defaultColor = getLineColor(lineConfig.metricName, '', lineConfig.filters || []);
      onUpdate({ 
        ...lineConfig, 
        slice: undefined, 
        color: defaultColor, 
        userSetColor: false, 
        displayNamesForSliceLines: undefined 
      });
    }
  };
  
  const handleColorChange = (color: string, sliceValue?: string) => {
    if (sliceValue && typeof lineConfig.color === 'object') {
      // Update color for specific slice value and mark as user-set
      const newColorMap = { ...lineConfig.color, [sliceValue]: color };
      const newUserSetColorMap = { 
        ...(typeof lineConfig.userSetColor === 'object' ? lineConfig.userSetColor : {}), 
        [sliceValue]: true 
      };
      onUpdate({ ...lineConfig, color: newColorMap, userSetColor: newUserSetColorMap });
    } else if (!sliceValue) {
      // Update single color and mark as user-set
      onUpdate({ ...lineConfig, color, userSetColor: true });
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
        <ParameterManager
          title="Filters"
          items={lineConfig.filters || []}
          input={filterInput}
          setInput={setFilterInput}
          onAdd={handleAddFilter}
          onRemove={handleRemoveFilter}
          placeholder="e.g., runner:not_in:local"
          itemColor="lightBlue"
          helpContent={<FilterHelpContent theme="light" />}
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
      
      {/* Display Name */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Display Name</label>
        <input
          type="text"
          value={lineConfig.displayName || ''}
          onChange={(e) => onUpdate({ ...lineConfig, displayName: e.target.value || undefined })}
          placeholder="Optional custom name for this line"
          className="w-full p-1.5 border rounded text-sm"
        />
        <div className="mt-1 text-xs text-gray-500">
          Leave empty to use auto-generated name
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
        {lineConfig.slice && loadingSliceValues && (
          <div className="mt-1 text-xs text-gray-500">Loading slice values...</div>
        )}
      </div>
      
      {/* Slice Line Names (only shown when slice is configured and slice values are loaded) */}
      {lineConfig.slice && sliceValues.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Slice Line Display Names</label>
          <div className="space-y-2">
            {sliceValues.map(sliceValue => {
              const currentDisplayName = lineConfig.displayNamesForSliceLines?.[sliceValue] || '';
              
              return (
                <div key={sliceValue} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-24 flex-shrink-0">{sliceValue}:</span>
                  <input
                    type="text"
                    value={currentDisplayName}
                    onChange={(e) => {
                      const newValue = e.target.value.trim();
                      const newDisplayNames = { ...(lineConfig.displayNamesForSliceLines || {}) };
                      
                      if (newValue) {
                        newDisplayNames[sliceValue] = newValue;
                      } else {
                        delete newDisplayNames[sliceValue];
                      }
                      
                      onUpdate({ 
                        ...lineConfig, 
                        displayNamesForSliceLines: Object.keys(newDisplayNames).length > 0 ? newDisplayNames : undefined 
                      });
                    }}
                    placeholder={
                      totalLineConfigsCount === 1 
                        ? sliceValue 
                        : `${lineConfig.displayName || lineConfig.metricName.split('/').pop() || lineConfig.metricName}_${sliceValue}`
                    }
                    className="flex-1 p-1.5 border rounded text-sm"
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Leave empty to use auto-generated names
          </div>
        </div>
      )}

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
  onNavigateToView,
  savedRequest,
  onRequestChange,
  config,
  viewId,
  viewConfig,
  refreshTrigger
}) => {
  const getAvailableViews = (): string[] => {
    return config?.views || ['timeseries', 'table', 'logs'];
  };

  // Default request based on view config
  const getDefaultRequest = (): TimeSeriesRequest => {
    const defaultParams = viewConfig?.defaultParameters || {};
    const defaultTimeFilter = getTimeFilter(defaultParams.time_filter || '1 month');
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<Record<string, { chartData: any[]; lineMetadata: Record<string, { configIndex: number; sliceValue?: string }>; error?: string }>>({});
  const [initialGraphsLoaded, setInitialGraphsLoaded] = useState(false);

  // Store the last refresh trigger value to detect changes
  const lastRefreshTrigger = useRef(refreshTrigger || 0);

  // Load initial graphs from important metrics if no graphs exist
  const loadInitialGraphs = useCallback(async () => {
    if (initialGraphsLoaded || graphs.length > 0) return;
    
    try {
      setLoading(true);
      const importantMetrics = await fetchImportantMetrics(
        config?.metrics_service_url,
        viewConfig?.metricSelection || 'CUSTOM',
        mergeGlobalFilters(config?.globalFilters, request.filters)
      );
      
      const initialGraphs = await createInitialGraphsFromImportantMetrics(
        importantMetrics,
        config,
        request.filters
      );
      
      if (initialGraphs.length > 0) {
        setGraphs(initialGraphs);
        setRequest({ ...request, graphs: initialGraphs });
      }
      
      setInitialGraphsLoaded(true);
    } catch (err) {
      console.error('Failed to load initial graphs:', err);
      setInitialGraphsLoaded(true); // Still mark as loaded to prevent retries
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update saved request when request changes
  useEffect(() => {
    if (onRequestChange) {
      onRequestChange(request);
    }
  }, [request]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch column tree for metric selection
  const fetchColumnTree = useCallback(async () => {
    try {
      const tableRequest: TableRequest = {
        filters: mergeGlobalFilters(config?.globalFilters, request.filters),
        slices: [],
        absent_metrics_strategy: 'accept_subset'
      };

      const tableUrl = getApiUrl(config?.metrics_service_url, 'table/aggregation');
      const response = await fetch(tableUrl, {
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
    }
  }, [config?.globalFilters, config?.metrics_service_url, request.filters]);

  useEffect(() => {
    fetchColumnTree();
  }, [fetchColumnTree, refreshTrigger]);

  // Load initial graphs when component mounts
  useEffect(() => {
    if (!initialGraphsLoaded && graphs.length === 0) {
      loadInitialGraphs();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch time series data for a graph
  const fetchTimeSeriesData = useCallback(async (graph: GraphConfiguration) => {
    const chartData: any[] = [];
    const lineMetadata: Record<string, { configIndex: number; sliceValue?: string }> = {};
    
    // Count total lines that will be generated to check 20 line limit
    let totalLineCount = 0;
    
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

        const timeSeriesUrl = getApiUrl(config?.metrics_service_url, 'graphs/time-series');
        const response = await fetch(timeSeriesUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiRequest)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: TimeSeriesApiResponse = await response.json();
        
        // Count lines that will be generated from this configuration
        const linesFromThisConfig = data.slice_values.length > 0 ? data.slice_values.length : 1;
        totalLineCount += linesFromThisConfig;
        
        // Check if total lines exceed the limit of 20
        if (totalLineCount > 20) {
          return { 
            chartData: [], 
            lineMetadata: {}, 
            error: `This graph would generate ${totalLineCount} lines, but the maximum allowed is 20. Please reduce the number of line configurations or use fewer slice values.` 
          };
        }
        
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
              
              // Use custom slice line name if provided, otherwise use auto-generated name
              const customSliceName = lineConfig.displayNamesForSliceLines?.[sliceValue];
              let lineName: string;
              
              if (customSliceName) {
                lineName = `${customSliceName}`;
              } else if (graph.lineConfigurations.length === 1) {
                // If only single lineConfig, use slice value as display name
                lineName = sliceValue;
              } else {
                const baseName = lineConfig.displayName || `${lineConfig.metricName.split('/').pop() || lineConfig.metricName}_${configIndex}`;
                lineName = `${baseName}_${sliceValue}`;
              }
              
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
            const lineName = lineConfig.displayName || `${lineConfig.metricName.split('/').pop() || lineConfig.metricName}_${configIndex}`;
            
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
    return { chartData, lineMetadata, error: undefined };
  }, [request.time_granulation, request.filters, config?.globalFilters, config?.metrics_service_url]);

  // Fetch data for all graphs
  const fetchAllGraphData = useCallback(async (isRefresh = false) => {
    if (graphs.length === 0) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      const newGraphData: Record<string, { chartData: any[]; lineMetadata: Record<string, { configIndex: number; sliceValue?: string }>; error?: string }> = {};
      
      for (const graph of graphs) {
        const result = await fetchTimeSeriesData(graph);
        newGraphData[graph.id] = result;
      }
      
      setGraphData(newGraphData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch graph data');
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  }, [graphs, fetchTimeSeriesData]);

  // Fetch graph data when graphs change
  useEffect(() => {
    fetchAllGraphData();
  }, [fetchAllGraphData]);

  // Handle refresh trigger changes separately
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger !== lastRefreshTrigger.current && refreshTrigger > 0) {
      lastRefreshTrigger.current = refreshTrigger;
      // Only refresh if we have graphs
      if (graphs.length > 0) {
        fetchAllGraphData(true); // Pass true to indicate this is a refresh
      }
    }
  }, [refreshTrigger, request.time_granulation, request.filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle time filter change with auto granulation
  const handleTimeFilterChange = (filter: string) => {
    const newFilters = (request.filters || []).filter(f => !f.startsWith('time_end_utc:'));
    const newRequest = { 
      ...request, 
      filters: [...newFilters, filter],
      ...(autoTimeGranulation && { time_granulation: getAutoTimeGranulation(filter) })
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

  const [localTimeGranulation, setLocalTimeGranulation] = useState(request.time_granulation || '1 day');
  const [autoTimeGranulation, setAutoTimeGranulation] = useState(true);

  // Sync local state when request.time_granulation changes from external sources
  useEffect(() => {
    setLocalTimeGranulation(request.time_granulation || '1 day');
  }, [request.time_granulation]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Control Panel */}
      <div 
        className="bg-gray-800 shadow-lg overflow-y-auto p-3 text-white relative dark-scrollbar" 
        style={{ width: `${panelWidth}px` }}
      >
        <h2 className="text-lg font-bold mb-3">Controls</h2>
        
        {/* Navigation to other views */}
        <ViewNavigation
          availableViews={getAvailableViews()}
          currentViewId={viewId || 'timeseries'}
          config={config || {}}
          onNavigateToView={onNavigateToView || (() => {})}
        />

        {/* Time Granulation */}
        <CollapsibleSection title="Time Granulation" defaultOpen={true}>
          <div>
            <div className="mb-2">
              <label className="flex items-center text-xs text-white">
                <input
                  type="checkbox"
                  checked={autoTimeGranulation}
                  onChange={(e) => setAutoTimeGranulation(e.target.checked)}
                  className="mr-2 rounded bg-gray-700 border-gray-600"
                />
                Auto determine from time filter
              </label>
            </div>
            <label className="block text-xs font-medium mb-1">Granulation</label>
            <input
              type="text"
              value={localTimeGranulation}
              onChange={(e) => setLocalTimeGranulation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTimeGranulationChange(e.currentTarget.value);
                }
              }}
              onBlur={(e) => handleTimeGranulationChange(e.target.value)}
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
      <div className="flex-1 overflow-auto relative">
        {/* Show loading only for initial loads (when no previous graph data exists) */}
        {loading && Object.keys(graphData).length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-600">Loading...</div>
          </div>
        )}
        
        {error && (
          <div className="m-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            Error: {error}
          </div>
        )}

        {(!loading || Object.keys(graphData).length > 0) && !error && (
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
                        <h3 className="font-semibold">{graph.name || `Graph ${graphs.indexOf(graph) + 1}`}</h3>
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
                              const updatedGraphs = graphs.map(g => 
                                g.id === graph.id ? { id: `empty-graph-${Date.now()}`, lineConfigurations: [] } : g
                              );
                              setGraphs(updatedGraphs);
                              setRequest({ ...request, graphs: updatedGraphs });
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
                                    {lineConfig.displayName || lineConfig.metricName.split('/').pop()}
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
                        ) : graphData[graph.id]?.error ? (
                          <div className="flex items-center justify-center h-full p-4">
                            <div className="text-center">
                              <div className="text-red-600 font-medium mb-2">⚠️ Too Many Lines</div>
                              <div className="text-sm text-gray-700">{graphData[graph.id].error}</div>
                            </div>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={graphData[graph.id]?.chartData || []}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" fontSize={10} />
                              <YAxis fontSize={10} />
                              <Tooltip 
                                contentStyle={{ 
                                  fontSize: '7px',
                                  padding: '2px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  border: '1px solid #ccc',
                                  borderRadius: '2px',
                                  lineHeight: '0.6'
                                }}
                                labelStyle={{ fontSize: '7px' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '8px' }} />
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
        color: undefined,
        userSetColor: undefined,
        displayName: undefined,
        displayNamesForSliceLines: undefined
      }];
    }
    return existing;
  });

  // Initialize graph name state
  const [graphName, setGraphName] = useState<string>(graph?.name || '');

  const addLineConfiguration = () => {
    const newLineConfig: LineConfiguration = {
      id: `line-${Date.now()}`,
      metricName: '',
      filters: [],
      slice: undefined,
      color: undefined,
      userSetColor: undefined,
      displayName: undefined,
      displayNamesForSliceLines: undefined
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
        return { ...config, color: autoColor, userSetColor: false };
      }
      return config;
    });
    // Update the graph in the graphs array
    const updatedGraphs = graphs.map(g => 
      g.id === graphId 
        ? { ...g, lineConfigurations: configsWithColors, name: graphName || undefined }
        : g
    );
    
    onSave(updatedGraphs);
  }, [localLineConfigs, graphs, graphId, graphName, onSave]);

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
        <h3 className="text-lg font-semibold mb-4">Configure Graph</h3>
        
        {/* Graph Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Graph Name</label>
          <input
            type="text"
            value={graphName}
            onChange={(e) => setGraphName(e.target.value)}
            placeholder="Optional custom name for this graph"
            className="w-full p-2 border rounded"
          />
          <div className="mt-1 text-xs text-gray-500">
            Leave empty to use auto-generated name (Graph 1, Graph 2, etc.)
          </div>
        </div>
        
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
              totalLineConfigsCount={localLineConfigs.length}
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