import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, X, ChevronUp, Download } from 'lucide-react';
import { TableRequest, TableResponse, ColumnNode, Column, DashboardConfig } from './shared/types';
import {
  CollapsibleSection,
  DetailsPopup,
  ParameterManager,
  FiltersSection,
  ViewNavigation,
  formatTimestamp,
  getStyleClass,
  getTimeFilter as sharedGetTimeFilter,
  mergeGlobalFilters,
  getApiUrl,
  useResizablePanel,
  ResizeHandle
} from './shared/SharedComponents';

// Component-specific utility functions
const formatCellValue = (values: Record<string, any>, unit?: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  
  if (values.value !== undefined && values.value !== null) {
    const valueStr = unit === 'timestamp' ? formatTimestamp(values.value) : String(values.value);
    parts.push(
      <div key="value" className="text-xs font-medium text-center">
        {valueStr}
      </div>
    );
  }
  
  if (values.min_value !== undefined && values.min_value !== null && values.max_value !== undefined && values.max_value !== null) {
    const rangeStr = unit === 'timestamp' 
      ? `[${formatTimestamp(values.min_value)}, ${formatTimestamp(values.max_value)}]`
      : `[${values.min_value}, ${values.max_value}]`;
    parts.push(
      <div key="range" className="text-[10px] text-gray-600 text-center">
        {rangeStr}
      </div>
    );
  }
  
  return parts.length > 0 ? <div className="flex flex-col items-center justify-center">{parts}</div> : '';
};

const formatColumnName = (values: Record<string, any>, filters: string[] = [], slices: string[] = []): React.ReactNode => {
  const value = values.value;
  if (!value) return '';
  
  const parts = String(value).split('/');
  const text = parts
    .map((part, i) => i < parts.length - 1 ? part + '/' : part)
    .join('\n');

  const className = getStyleClass(value, filters, slices);
  return <div className={className}>{text}</div>;
};

const formatRowName = (values: Record<string, any>, filters: string[] = [], slices: string[] = []): React.ReactNode => {
  if (Object.keys(values).length === 0)
    return (<div>_</div>)
  return (
    <div>
      {Object.entries(values).map(([key, value], index) => {
        const className = getStyleClass(key, filters, slices);
        return (
          <div key={index} className={className}>
            {key}: {String(value)}
          </div>
        );
      })}
    </div>
  );
};

// Column Tree Node Component
const ColumnTreeNode: React.FC<{
  node: ColumnNode;
  onToggle: (nodeId: string) => void;
  level?: number;
}> = ({ node, onToggle, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  
  const getCheckboxIcon = () => {
    switch (node.selection_state) {
      case 'all': return (
        <div className="w-3 h-3 bg-purple-900 border border-purple-900 rounded-sm" />
      );
      case 'partial': return (
        <div className="w-3 h-3 border border-purple-900 rounded-sm relative overflow-hidden">
          <div 
            className="absolute inset-0 bg-purple-900" 
            style={{ 
              clipPath: 'polygon(100% 100%, 100% 0, 0 0)' 
            }} 
          />
        </div>
      );
      case 'none': return (
        <div className="w-3 h-3 border border-gray-400 rounded-sm" />
      );
    }
  };
  
  return (
    <div>
      <div 
        className="flex items-center py-0.5 hover:bg-gray-100 cursor-pointer"
        style={{ paddingLeft: `${level * 16}px` }}
      >
        <div className="w-4 mr-1">
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-0"
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>
        <button
          onClick={() => onToggle(node.column_node_id)}
          className="flex items-center gap-1.5 flex-1 text-left"
        >
          {getCheckboxIcon()}
          <div className="flex-1">
            {level === 0 && (
                <span className="text-xs text-gray-500">&lt;root&gt;</span>    
            )}
            {level > 0 && (
                <span className="text-xs">{node.name}</span>    
            )}
            {node.description && (
              <span className="text-[10px] text-gray-500 ml-2">{node.description}</span>
            )}
          </div>
        </button>
      </div>
      {isExpanded && hasChildren && node.children?.map((child) => (
        <ColumnTreeNode
          key={child.column_node_id}
          node={child}
          onToggle={onToggle}
          level={level + 1}
        />
      ))}
    </div>
  );
};

interface TableDashboardProps {
  onNavigateToView?: (viewId: string) => void;
  savedRequest?: TableRequest | null;
  onRequestChange?: (request: TableRequest) => void;
  config?: DashboardConfig;
  viewId?: string;
  viewConfig?: import('./shared/types').ViewConfig;
  refreshTrigger?: number;
}

const TableDashboard: React.FC<TableDashboardProps> = ({ 
  onNavigateToView,
  savedRequest, 
  onRequestChange, 
  config, 
  viewId,
  viewConfig,
  refreshTrigger = 0
}) => {
  // State
  const defaultRequest: TableRequest = {
    prune_mode: 'column',
    absent_metrics_strategy: 'nullify',
    slices_recommendation_strategy: 'concise',
    filters: [],
    slices: [],
    column_selections: [
      '/metadata/time_end_utc/max_value',
      '/metadata/instance_updated_at/max_value',
      '/metadata/time_end_utc/n_samples',
      '/metadata/instance_updated_at/n_samples',
      '/metrics/errors/summary/error_count_all',
      '/metrics/api_calls/inference_client_completions/count',
      '/metrics/api_calls/inference_client_completions/count_fail',
      '/metrics/api_calls/inference_client_completions/errors/count_all',
      '/metrics/api_calls/inference_client_completions/latency_s_all',
      '/metrics/api_calls/inference_client_completions/latency_s_avg',
      '/metrics/api_calls/inference_client_completions/latency_s_max',
      '/metrics/performance/latency/init_and_env_run_s_all'
    ]
  };
  
  // Apply default parameters from view config including time_filter
  const getInitialRequest = (): TableRequest => {
    const configDefaults = viewConfig?.defaultParameters || {};
    const isCompareModels = viewConfig?.metricSelection === 'COMPARE_MODELS';
    
    if (isCompareModels) {
      // For COMPARE_MODELS: no parameters, no slicing, no time filters, default column_selections
      return {
        filters: [],
        slices: [],
        column_selections: ['/metadata/price_output_tokens_1m', '/metrics/livebench/average', '/metrics/livebench/categories/', '/metrics/livebench/subcategories/agentic_coding/python', '/metrics/livebench/subcategories/agentic_coding/typescript'],
        sort_by_column: '/metrics/livebench/average'
      };
    }
    
    const defaultFilters = [];
    
    // Add time filter if specified in config
    if (configDefaults.time_filter) {
      const timeFilter = sharedGetTimeFilter(viewConfig?.time_field || 'time_end_utc', String(configDefaults.time_filter));
      defaultFilters.push(timeFilter);
    }
    
    return { 
      ...defaultRequest, 
      ...configDefaults,
      filters: [...defaultFilters, ...(configDefaults.filters || [])]
    };
  };
  
  const [request, setRequest] = useState<TableRequest>(savedRequest || getInitialRequest());
  
  // Helper functions for configuration
  const getAvailableViews = (): string[] => {
    return config?.views || ['timeseries', 'table', 'logs'];
  };

  const getVisibleParameters = (): string[] => {
    const showParameters = viewConfig?.showParameters;
    if (showParameters === undefined) {
      // Show all parameters by default
      return ['prune_mode', 'absent_metrics_strategy', 'slices_recommendation_strategy'];
    }
    return showParameters;
  };
  
  const shouldShowParametersPanel = (): boolean => {
    // Hide parameters panel for COMPARE_MODELS
    if (viewConfig?.metricSelection === 'COMPARE_MODELS') {
      return false;
    }
    const visibleParameters = getVisibleParameters();
    return visibleParameters.length > 0;
  };

  const shouldShowTimeFiltersSection = (): boolean => {
    // Hide time filters for COMPARE_MODELS
    return viewConfig?.metricSelection !== 'COMPARE_MODELS';
  };

  const shouldShowSlicesSection = (): boolean => {
    // Hide slices section for COMPARE_MODELS (no slicing)
    return viewConfig?.metricSelection !== 'COMPARE_MODELS';
  };
  
  const [response, setResponse] = useState<TableResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, any> | null>(null);
  const [filterInput, setFilterInput] = useState('');
  const [sliceInput, setSliceInput] = useState('');
  const [isColumnTreeOpen, setIsColumnTreeOpen] = useState(true);

  // Store the last refresh trigger value to detect changes
  const lastRefreshTrigger = useRef(refreshTrigger || 0);

  // Use shared resizable panel functionality
  const { panelWidth, controlPanelRef, handleMouseDown } = useResizablePanel({
    initialWidth: 256,
    minWidth: 200,
    maxWidth: 400
  });

  // Update parent component when request changes
  useEffect(() => {
    if (onRequestChange) {
      onRequestChange(request);
    }
  }, [request]); // eslint-disable-line react-hooks/exhaustive-deps

  // API call
  const fetchTable = useCallback(async (requestData: TableRequest, isRefresh = false) => {
    setError(null);
    
    try {
      setRequest(requestData);
      // Merge global filters with request filters
      const mergedFilters = mergeGlobalFilters(config?.globalFilters, requestData.filters);
      const requestWithGlobalFilters = {
        ...requestData,
        filters: mergedFilters
      };
      
      // Determine API endpoint and request data based on metricSelection
      const isCompareModels = viewConfig?.metricSelection === 'COMPARE_MODELS';
      const apiEndpoint = isCompareModels ? 'table/evaluation' : 'table/aggregation';
      
      const url = getApiUrl(config?.metrics_service_url, apiEndpoint);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestWithGlobalFilters)
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setResponse(data);
      
      // Update request with response data
      if (requestData.column_selections_to_remove && requestData.column_selections_to_remove?.length > 0) {
        const newRequest = {
            ...requestData,
            filters: data.filters || [],
            slices: data.slices || [],
            column_selections: data.columns.map((col: Column) => col.column_id),
            column_selections_to_add: [],
            column_selections_to_remove: []
        };
        setRequest(newRequest);
      } else {
        const newRequest = {
            ...requestData,
            filters: data.filters || [],
            slices: data.slices || []
        };
        setRequest(newRequest);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [config?.globalFilters, config?.metrics_service_url, viewConfig?.metricSelection]);

  // Initial load. Use saved request if present.
  useEffect(() => {
    if (savedRequest) {
      fetchTable(savedRequest);
    } else {
      fetchTable(request);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle refresh trigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger !== lastRefreshTrigger.current && refreshTrigger > 0) {
      lastRefreshTrigger.current = refreshTrigger;
      // Only refresh if we have a request
      if (request) {
        fetchTable(request, true); // Pass true to indicate this is a refresh
      }
    }
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // CSV download function
  const downloadCsv = useCallback(async () => {
    if (!response || !request) return;
    
    try {
      // Merge global filters with request filters
      const mergedFilters = mergeGlobalFilters(config?.globalFilters, request.filters);
      const requestWithGlobalFilters = {
        ...request,
        filters: mergedFilters
      };
      
      // Determine CSV API endpoint based on metricSelection
      const isCompareModels = viewConfig?.metricSelection === 'COMPARE_MODELS';
      const apiEndpoint = isCompareModels ? 'table/evaluation_csv' : 'table/aggregation_csv';
      
      const url = getApiUrl(config?.metrics_service_url, apiEndpoint);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestWithGlobalFilters)
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      // Get CSV content
      const csvContent = await res.text();
      
      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Generate filename based on table type and timestamp
      const tableType = isCompareModels ? 'evaluation' : 'aggregation';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `${tableType}-table-${timestamp}.csv`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (err) {
      console.error('Error downloading CSV:', err);
      setError(err instanceof Error ? `CSV download failed: ${err.message}` : 'CSV download failed');
    }
  }, [request, response, config?.globalFilters, config?.metrics_service_url, viewConfig?.metricSelection]);

  // Helper function to find node by ID
  const findNodeById = (node: ColumnNode | undefined, targetId: string): ColumnNode | null => {
    if (!node) return null;
    if (node.column_node_id === targetId) return node;
    
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeById(child, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  // Handlers
  const handleColumnToggle = (nodeId: string) => {
    const node = findNodeById(response?.column_tree, nodeId);
    if (!node) return;
    
    const newRequest = { ...request };
    
    if (node.selection_state === 'all') {
      // If fully selected, add to remove list
      newRequest.column_selections_to_remove = [
        ...(newRequest.column_selections_to_remove || []),
        nodeId
      ];
    } else {
      // If not fully selected or partially selected, add to add list
      newRequest.column_selections_to_add = [
        ...(newRequest.column_selections_to_add || []),
        nodeId
      ];
    }
    
    fetchTable(newRequest);
  };

  const handleRemoveFilter = (filter: string) => {
    const newRequest = {
      ...request,
      filters: request.filters?.filter(f => f !== filter) || []
    };
    fetchTable(newRequest);
  };

  const handleAddFilter = () => {
    if (filterInput.trim()) {
      const newRequest = {
        ...request,
        filters: [...(request.filters || []), filterInput.trim()]
      };
      setFilterInput('');
      fetchTable(newRequest);
    }
  };

  const handleTimeFilter = (filter: string) => {
    const newFilters = (request.filters || []).filter(f => !f.startsWith('time_end_utc:') && !f.startsWith('instance_updated_at:'));
    const newRequest = {
      ...request,
      filters: [...newFilters, filter]
    };
    fetchTable(newRequest);
  };

  const handleRemoveSlice = (slice: string) => {
    const newRequest = {
      ...request,
      slices: request.slices?.filter(s => s !== slice) || []
    };
    fetchTable(newRequest);
  };

  const handleAddSlice = () => {
    if (sliceInput.trim()) {
      const newRequest = {
        ...request,
        slices: [...(request.slices || []), sliceInput.trim()]
      };
      setSliceInput('');
      fetchTable(newRequest);
    }
  };

  const handleAddSliceRecommendation = (slice: string) => {
    const newRequest = {
      ...request,
      slices: [...(request.slices || []), slice]
    };
    fetchTable(newRequest);
  };

  const handleRemoveColumn = (columnId: string) => {
    const newRequest = { ...request };
    newRequest.column_selections_to_remove = [
      ...(newRequest.column_selections_to_remove || []),
      columnId
    ];
    fetchTable(newRequest);
  };

  const handleSort = (column: string, order: 'asc' | 'desc') => {
    const newRequest = {
      ...request,
      sort_by_column: column,
      sort_order: order
    };
    fetchTable(newRequest);
  };

  const handleParameterChange = (key: string, value: any) => {
    const newRequest = { ...request, [key]: value };
    fetchTable(newRequest);
  };

  // Helper function to detect if there's exactly one lower bound time filter
  const getTimeFilter = (time_field: string): string | null => {
    const timeFilters = (request.filters || []).filter(f => 
      new RegExp(`^${time_field}:range:\\([^)]+\\):`).test(f)
    );
    // Only show button if there's exactly one time filter to avoid confusion
    return timeFilters.length === 1 ? timeFilters[0] : null;
  };

  // Helper function to parse timestamp from time filter
  const parseTimeFilter = (time_field: string, filter: string): Date | null => {
    // Handle both formats:
    // 1. "time_field:range:(<timestamp>):"
    // 2. "time_field:range:(<timestamp>):(<upper_bound>)"
    const match = filter.match(new RegExp(`${time_field}:range:\\(([^)]+)\\):`));
    if (match && match[1]) {
      try {
        // Explicitly treat as UTC by adding 'Z' suffix if not present
        const timestamp = match[1].endsWith('Z') ? match[1] : match[1] + 'Z';
        return new Date(timestamp);
      } catch {
        return null;
      }
    }
    return null;
  };

  // Helper function to find min timestamp from existing time slices
  const getMinSliceTimestamp = (time_field: string): Date => {
    const timeSlices = (request.slices || []).filter(s => s.startsWith(`${time_field}:range:(`));
    let minTimestamp: Date | null = null;
    for (const slice of timeSlices) {
      const match = slice.match(new RegExp(`${time_field}:range:\\(([^)]+)\\):`));
      if (match && match[1]) {
        try {
          // Explicitly treat as UTC by adding 'Z' suffix if not present
          const match_utc = match[1].endsWith('Z') ? match[1] : match[1] + 'Z';
          const timestamp = new Date(match_utc);
          if (!minTimestamp || timestamp < minTimestamp) {
            minTimestamp = timestamp;
          }
        } catch {
          // Ignore invalid timestamps
        }
      }
    }
    return minTimestamp || new Date(); // Return current time if no valid slices found
  };

  // Handle adding another time slice row
  const handleAddTimeSlice = (time_field: string) => {
    const timeFilter = getTimeFilter(time_field);
    if (!timeFilter) return;
    
    const filterTimestamp = parseTimeFilter(time_field, timeFilter);
    if (!filterTimestamp) return;
    
    const minSliceTimestamp = getMinSliceTimestamp(time_field);
    const timeStep = minSliceTimestamp.getTime() - filterTimestamp.getTime();
    
    // Remove the time filter from filters
    const newFilters = (request.filters || []).filter(f => 
      !(new RegExp(`^${time_field}:range:\\([^)]+\\):`).test(f))
    );
    
    // Create new time filter with adjusted timestamp
    const adjustedTimestamp = new Date(filterTimestamp.getTime() - timeStep);
    const adjustedTimestampStr = adjustedTimestamp.toISOString().replace(/\.\d{3}Z$/, '');
  
    // Replace the first timestamp in the timeFilter with the adjusted timestamp
    const adjustedFilter = timeFilter.replace(
      new RegExp(`^(${time_field}:range:)\\([^)]+\\)`),
      `$1(${adjustedTimestampStr})`
    );
    
    // Add the original filter as a slice and the adjusted filter as a new filter
    const newRequest = {
      ...request,
      filters: [...newFilters, adjustedFilter],
      slices: [...(request.slices || []), timeFilter]
    };
    fetchTable(newRequest);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Control Panel */}
      <div 
        ref={controlPanelRef}
        className="bg-[#273141] shadow-lg overflow-y-auto p-3 text-white relative dark-scrollbar" 
        style={{ width: `${panelWidth}px` }}
      >
        <h2 className="text-lg font-bold mb-3">Controls</h2>
        
        {/* Navigation to other views */}
        <ViewNavigation
          availableViews={getAvailableViews()}
          currentViewId={viewId || 'table'}
          config={config || {}}
          onNavigateToView={onNavigateToView || (() => {})}
        />

        {/* Parameters */}
        {shouldShowParametersPanel() && (
          <CollapsibleSection title="Parameters">
            <div className="space-y-2">
              {getVisibleParameters().includes('prune_mode') && (
                <div>
                  <label className="block text-xs font-medium mb-1" title="Heuristics to remove meaningless columns">
                    prune_mode
                  </label>
                  <select
                    value={request.prune_mode}
                    onChange={(e) => handleParameterChange('prune_mode', e.target.value)}
                    className="w-full p-1.5 border rounded text-xs bg-gray-700 text-white border-gray-600"
                    title="Select pruning strategy"
                  >
                    <option value="none" title="No pruning applied">none</option>
                    <option value="column" title="Remove columns if all column values are determined meaningless">column</option>
                  </select>
                </div>
              )}
              {getVisibleParameters().includes('absent_metrics_strategy') && (
                <div>
                  <label className="block text-xs font-medium mb-1" title="Strategy on how to deal with absent metrics">
                    absent_metrics_strategy
                  </label>
                  <select
                    value={request.absent_metrics_strategy}
                    onChange={(e) => handleParameterChange('absent_metrics_strategy', e.target.value)}
                    className="w-full p-1.5 border rounded text-xs bg-gray-700 text-white border-gray-600"
                    title="Select absent metrics strategy"
                  >
                    <option value="all_or_nothing" title="Include metric only if present in all entries">all_or_nothing</option>
                    <option value="nullify" title="Replace missing values with 0">nullify</option>
                    <option value="accept_subset" title="Include even if only in some entries. Number of samples is recorded in n_samples">accept_subset</option>
                  </select>
                </div>
              )}
              {getVisibleParameters().includes('slices_recommendation_strategy') && (
                <div>
                  <label className="block text-xs font-medium mb-1" title="Strategy for recommending slices">
                    slices_recommendation_strategy
                  </label>
                  <select
                    value={request.slices_recommendation_strategy}
                    onChange={(e) => handleParameterChange('slices_recommendation_strategy', e.target.value)}
                    className="w-full p-1.5 border rounded text-xs bg-gray-700 text-white border-gray-600"
                    title="Select slice recommendation strategy"
                  >
                    <option value="none" title="No slice recommendations">none</option>
                    <option value="first_alphabetical" title="Recommend first alphabetical candidates">first_alphabetical</option>
                    <option value="concise" title="Recommend most concise candidates">concise</option>
                  </select>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Filters */}
        <FiltersSection
          filters={request.filters || []}
          filterInput={filterInput}
          setFilterInput={setFilterInput}
          onAddFilter={handleAddFilter}
          onRemoveFilter={handleRemoveFilter}
          onTimeFilter={handleTimeFilter}
          timeFilterRecommendations={viewConfig?.timeFilterRecommendations}
          timeField={viewConfig?.time_field || 'time_end_utc'}
          showTimeFilters={shouldShowTimeFiltersSection()}
        />

        {/* Slices */}
        {shouldShowSlicesSection() && (
          <CollapsibleSection title="Slices">
            <ParameterManager
              title="Slices"
              items={request.slices || []}
              input={sliceInput}
              setInput={setSliceInput}
              onAdd={handleAddSlice}
              onRemove={handleRemoveSlice}
              recommendations={response?.slice_recommendations}
              onAddRecommendation={handleAddSliceRecommendation}
              placeholder="e.g., agent_name"
              itemColor="green"
              helpContent={
                <>
                  <p className="mb-1">• Simple: agent_name</p>
                  <p>• Conditional: runner:in:local</p>
                </>
              }
            />
          </CollapsibleSection>
        )}
        
        {/* Resize handle */}
        <ResizeHandle onMouseDown={handleMouseDown} />
      </div>

      {/* Main Window */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
        {/* Column Tree */}
        <div className="bg-white shadow-sm flex-shrink-0">
          <button
            onClick={() => setIsColumnTreeOpen(!isColumnTreeOpen)}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-50"
          >
            <span className="font-medium text-sm">Column Selection</span>
            {isColumnTreeOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {isColumnTreeOpen && response?.column_tree && (
            <div className="max-h-48 overflow-y-auto p-2 border-t border-gray-200 custom-scrollbar">
              <ColumnTreeNode node={response.column_tree} onToggle={handleColumnToggle} />
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-2 custom-scrollbar">
          {error && <div className="text-red-600 text-center py-2 text-xs">Error: {error}</div>}
          
          {response && response.rows.length > 0 && (
            <>
              {/* Table Header with Download Button */}
              <div className="flex justify-end mb-2">
                <button
                  onClick={downloadCsv}
                  className="inline-flex items-center px-2.5 py-1.5 bg-green-50 hover:bg-green-200 text-gray-700 text-xs rounded transition-colors"
                  title="Download table as CSV"
                >
                  <Download size={12} className="mr-1" />
                  Download CSV
                </button>
              </div>
              
              {/* Table Content */}
              <div className="bg-white rounded shadow overflow-auto custom-scrollbar">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="p-2 text-left border-b border-r border-gray-300">
                        {response.rows[0][0] && (
                          <div 
                            className={`${Object.keys(response.rows[0][0].details).length > 0 ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                            onClick={() => Object.keys(response.rows[0][0].details).length > 0 && setSelectedDetails(response.rows[0][0].details)}
                          >
                            <pre className="text-[8px] whitespace-pre-wrap leading-tight">
                              {formatColumnName(response.rows[0][0].values, request.filters, request.slices)}
                            </pre>
                          </div>
                        )}
                      </th>
                      {response.rows[0].slice(1).map((cell, idx) => {
                        const column = response.columns[idx];
                        const hasDetails = Object.keys(cell.details).length > 0;
                        return (
                          <th key={idx} className="p-2 text-left border-b border-gray-300 relative group">
                            {/* Action buttons above column name */}
                            <div className="flex justify-end gap-0.5 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleSort(column.column_id, 'desc')}
                                className="p-0.5 hover:bg-gray-300 rounded"
                                title="Sort descending"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                onClick={() => handleSort(column.column_id, 'asc')}
                                className="p-0.5 hover:bg-gray-300 rounded"
                                title="Sort ascending"
                              >
                                <ChevronDown size={12} />
                              </button>
                              <button
                                onClick={() => handleRemoveColumn(column.column_id)}
                                className="p-0.5 hover:bg-gray-300 rounded text-red-500"
                                title="Remove column"
                              >
                                <X size={12} />
                              </button>
                            </div>
                            {/* Column name */}
                            <div 
                              className={`${hasDetails ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                              onClick={() => hasDetails && setSelectedDetails(cell.details)}
                            >
                              <pre className="text-[8px] whitespace-pre-wrap leading-tight">
                                {formatColumnName(cell.values, request.filters, request.slices)}
                              </pre>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {response.rows.slice(1).map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-2 border-r border-gray-200 bg-gray-100">
                          <div 
                            className={`text-xs ${Object.keys(row[0].details).length > 0 ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                            onClick={() => Object.keys(row[0].details).length > 0 && setSelectedDetails(row[0].details)}
                          >
                            {formatRowName(row[0].values, request.filters, request.slices)}
                          </div>
                        </td>
                        {row.slice(1).map((cell, cellIdx) => {
                          const column = response.columns[cellIdx];
                          const hasDetails = Object.keys(cell.details).length > 0;
                          
                          return (
                            <td
                              key={cellIdx}
                              className={`p-2 ${hasDetails ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                              onClick={() => hasDetails && setSelectedDetails(cell.details)}
                            >
                              {formatCellValue(cell.values, column?.unit)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Action Buttons */}
              {getTimeFilter(viewConfig?.time_field || 'time_end_utc') && (
                <div className="mt-2 flex justify-start gap-2">
                  {/* Add Time Slice Button */}
                  <button
                    onClick={() => handleAddTimeSlice(viewConfig?.time_field || 'time_end_utc')}
                    className="border-b border-gray-300 inline-flex items-center px-2.5 py-1.5 bg-blue-50 hover:bg-blue-200 text-gray-700 text-xs rounded transition-colors"
                    title="Add another time slice row"
                  >
                    + Add Time Slice
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Details Popup */}
      {selectedDetails && (
        <DetailsPopup
          details={selectedDetails}
          onClose={() => setSelectedDetails(null)}
        />
      )}
    </div>
  );
};

export default TableDashboard;