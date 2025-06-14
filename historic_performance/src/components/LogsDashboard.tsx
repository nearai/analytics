import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Table, FileText, Eye } from 'lucide-react';
import { LogsRequest, LogsResponse, LogGroup, LogEntry, LogFile, DashboardConfig } from './shared/types';
import { CollapsibleSection, DetailsPopup, FileContentPopup, FilterManager, formatTimestamp, getStyleClass, isTimestampLike, mergeGlobalFilters } from './shared/SharedComponents';

// Format metadata/metrics for display
const formatMetadataValue = (value: any): string => {
  if (typeof value === 'object' && value !== null) {
    if (value.min_value !== undefined && value.max_value !== undefined) {
      if (isTimestampLike(value.min_value)) {
        // Timestamp range
        return `${formatTimestamp(value.min_value)} - ${formatTimestamp(value.max_value)} (n=${value.n_samples || 0})`;
      }
      return `${value.min_value} - ${value.max_value} (n=${value.n_samples || 0})`;
    }
    return JSON.stringify(value);
  }
  if (isTimestampLike(value)) {
    return formatTimestamp(value);
  }
  return String(value);
};

// Format entry name based on metadata
const formatEntryName = (entry: LogEntry | LogGroup['aggr_entry'], isAggregated: boolean, filters: string[] = [], groups: string[] = []): React.ReactNode => {
  if (isAggregated) {
    return (
        <div>
          {Object.entries(entry.metadata).map(([key, value], index) => {
            const className = getStyleClass(key, filters, groups);
            return (
              <div key={index} className={className}>
                <b>{key}:</b> {formatMetadataValue(value)}
              </div>
            );
          })}
        </div>
      );
  } else {
    // For individual entries, show time_end_utc and time_end_local
    const utc = entry.metadata.time_end_utc;
    const local = entry.metadata.time_end_local;
    
    if (utc || local) {
      const parts: string[] = [];
      if (utc) parts.push(`UTC: ${formatTimestamp(utc)}`);
      if (local) parts.push(`Local: ${formatTimestamp(local)}`);
      return parts.join(' | ');
    }
    
    return entry.name; // Fallback to name if no time metadata
  }
};

// Log Aggregated Entry Component
const LogAggrEntryComponent: React.FC<{
  entry: LogGroup;
  filters: string[];
  groups: string[];
}> = ({ entry, filters, groups}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMetadataDetails, setShowMetadataDetails] = useState(false);
  const [showMetricsDetails, setShowMetricsDetails] = useState(false);

  return (
    <div className={`border border-gray-300 bg-gray-100 rounded-lg p-3 mb-2`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span className={`font-medium text-xs text-zinc-800`}>
            {formatEntryName(entry['aggr_entry'], true, filters, groups)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMetadataDetails(true);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Eye size={12} />
            Aggregated Metadata JSON
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMetricsDetails(true);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Eye size={12} />
            Aggregated Metrics JSON
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
            <div className="ml-4 mt-2">
              {entry['entries'].map((entry, entryIdx) => (
                <LogEntryComponent
                  key={entryIdx}
                  entry={entry}
                  filters={filters || []}
                  groups={groups || []}
                />
              ))}
            </div>
          )}
      {/* Popups */}
      {showMetadataDetails && (
        <DetailsPopup
          details={entry['aggr_entry'].metadata}
          onClose={() => setShowMetadataDetails(false)}
          title="Aggregated Metadata Details"
        />
      )}
      {showMetricsDetails && (
        <DetailsPopup
          details={entry['aggr_entry'].metrics}
          onClose={() => setShowMetricsDetails(false)}
          title="Aggregated Metrics Details"
        />
      )}
    </div>
  );
};

// Log Entry Component
const LogEntryComponent: React.FC<{
  entry: LogEntry;
  filters: string[];
  groups: string[];
}> = ({ entry, filters, groups}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<LogFile | null>(null);
  const [showMetadataDetails, setShowMetadataDetails] = useState(false);
  const [showMetricsDetails, setShowMetricsDetails] = useState(false);

  // Type guard to check if entry has log_files
  const hasLogFiles = (e: any): e is LogEntry => 'log_files' in e;

  return (
    <div className={`border border-gray-200 bg-white' rounded-lg p-3 mb-2`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span className={`font-medium text-sm`}>
            {formatEntryName(entry, false, filters, groups)}
          </span>
        </div>
        {hasLogFiles(entry) && entry.log_files.length > 0 && (
          <span className="text-xs text-gray-500">
            {entry.log_files.length} file{entry.log_files.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Metadata Section */}
          {Object.keys(entry.metadata).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-gray-700">Metadata</h4>
                <button
                  onClick={() => setShowMetadataDetails(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Eye size={12} />
                  View JSON
                </button>
              </div>
              <div className="bg-gray-50 rounded p-2 space-y-1">
                {Object.entries(entry.metadata).map(([key, value]) => {
                  const className = getStyleClass(key, filters, groups);
                  return (
                    <div key={key} className="text-xs">
                      <span className={`font-medium ${className}`}>{key}:</span>{' '}
                      <span className={`text-gray-700 ${className}`}>{formatMetadataValue(value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Metrics Section */}
          {Object.keys(entry.metrics).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-semibold text-gray-700">Metrics</h4>
                <button
                  onClick={() => setShowMetricsDetails(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Eye size={12} />
                  View JSON
                </button>
              </div>
              <div className="bg-gray-50 rounded p-2 space-y-1">
                {Object.entries(entry.metrics).map(([key, metric]) => {
                  const className = getStyleClass(key, filters, groups);
                  const value = typeof metric === 'object' && metric.value !== undefined ? metric.value : metric;
                  const description = typeof metric === 'object' && metric.description ? metric.description : '';
                  
                  return (
                    <div key={key} className="text-xs">
                      <span className={`font-medium ${className}`}>{key}:</span>{' '}
                      <span className={`text-gray-700 ${className}`}>{formatMetadataValue(value)}</span>
                      {description && <span className="text-gray-500 text-[10px] ml-1">({description})</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Log Files Section */}
          {hasLogFiles(entry) && entry.log_files.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-1">Log Files</h4>
              <div className="space-y-1">
                {entry.log_files.map((file, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(file);
                    }}
                    className="flex items-center gap-2 text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 w-full text-left transition-colors"
                  >
                    <FileText size={12} className="text-gray-600" />
                    <span className="font-medium">{file.filename}</span>
                    {file.description && (
                      <span className="text-gray-500 text-[10px]">- {file.description}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Popups */}
      {showMetadataDetails && (
        <DetailsPopup
          details={entry.metadata}
          onClose={() => setShowMetadataDetails(false)}
          title="Metadata Details"
        />
      )}
      {showMetricsDetails && (
        <DetailsPopup
          details={entry.metrics}
          onClose={() => setShowMetricsDetails(false)}
          title="Metrics Details"
        />
      )}
      {selectedFile && (
        <FileContentPopup
          filename={selectedFile.filename}
          content={selectedFile.content}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
};

interface LogsDashboardProps {
  onNavigateToTable: () => void;
  savedRequest?: LogsRequest | null;
  onRequestChange?: (request: LogsRequest) => void;
  config?: DashboardConfig;
  showViewsPanel?: boolean;
  refreshTrigger?: number;
}

const LogsDashboard: React.FC<LogsDashboardProps> = ({ 
  onNavigateToTable, 
  savedRequest, 
  onRequestChange, 
  config, 
  showViewsPanel = true,
  refreshTrigger = 0
}) => {
  // State
  const defaultRequest: LogsRequest = {
    prune_mode: 'all',
    groups_recommendation_strategy: 'concise',
    filters: [],
    groups: []
  };
  
  // Apply default parameters from config
  const getInitialRequest = (): LogsRequest => {
    const configDefaults = config?.viewConfigs?.logs?.defaultParameters || {};
    return { ...defaultRequest, ...configDefaults };
  };
  
  const [request, setRequest] = useState<LogsRequest>(savedRequest || getInitialRequest());
  
  // Helper functions for configuration
  const getVisibleParameters = (): string[] => {
    const showParameters = config?.viewConfigs?.logs?.showParameters;
    if (showParameters === undefined) {
      // Show all parameters by default
      return ['prune_mode', 'groups_recommendation_strategy'];
    }
    return showParameters;
  };
  
  const shouldShowParametersPanel = (): boolean => {
    const visibleParameters = getVisibleParameters();
    return visibleParameters.length > 0;
  };
  
  const [response, setResponse] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterInput, setFilterInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [panelWidth, setPanelWidth] = useState(256);

  // Store the last refresh trigger value to detect changes
  const lastRefreshTrigger = useRef(refreshTrigger);

  // Resize panel
  const isResizing = useRef(false);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = Math.max(200, Math.min(400, e.clientX));
    setPanelWidth(newWidth);
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Update parent component when request changes
  useEffect(() => {
    if (onRequestChange) {
      onRequestChange(request);
    }
  }, [request, onRequestChange]);

  // API call
  const fetchLogs = useCallback(async (requestData: LogsRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      setRequest(requestData);
      // Merge global filters with request filters
      const mergedFilters = mergeGlobalFilters(config?.globalFilters, requestData.filters);
      const requestWithGlobalFilters = {
        ...requestData,
        filters: mergedFilters
      };
      const res = await fetch('http://localhost:8000/api/v1/logs/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestWithGlobalFilters)
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [config?.globalFilters]);

  // Initial load. Use saved request if present.
  useEffect(() => {
    if (savedRequest) {
      fetchLogs(savedRequest);
    } else {
      fetchLogs(request);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle refresh trigger changes
  useEffect(() => {
    if (refreshTrigger !== lastRefreshTrigger.current && refreshTrigger > 0) {
      lastRefreshTrigger.current = refreshTrigger;
      // Only refresh if we have a request
      if (request) {
        fetchLogs(request);
      }
    }
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers
  const handleRemoveFilter = (filter: string) => {
    const newRequest = {
      ...request,
      filters: request.filters?.filter(f => f !== filter) || []
    };
    fetchLogs(newRequest);
  };

  const handleAddFilter = () => {
    if (filterInput.trim()) {
      const newRequest = {
        ...request,
        filters: [...(request.filters || []), filterInput.trim()]
      };
      setFilterInput('');
      fetchLogs(newRequest);
    }
  };

  const handleRemoveGroup = (group: string) => {
    const newRequest = {
      ...request,
      groups: request.groups?.filter(g => g !== group) || []
    };
    fetchLogs(newRequest);
  };

  const handleAddGroup = () => {
    if (groupInput.trim()) {
      const newRequest = {
        ...request,
        groups: [...(request.groups || []), groupInput.trim()]
      };
      setGroupInput('');
      fetchLogs(newRequest);
    }
  };

  const handleAddGroupRecommendation = (group: string) => {
    const newRequest = {
      ...request,
      groups: [...(request.groups || []), group]
    };
    fetchLogs(newRequest);
  };

  const handleParameterChange = (key: string, value: any) => {
    const newRequest = { ...request, [key]: value };
    fetchLogs(newRequest);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Control Panel */}
      <div 
        className="bg-gray-800 shadow-lg overflow-y-auto p-3 text-white relative dark-scrollbar" 
        style={{ width: `${panelWidth}px` }}
      >
        <h2 className="text-lg font-bold mb-3">Logs Controls</h2>
        
        {/* Navigation to Table */}
        {showViewsPanel && (
          <CollapsibleSection title="Views" defaultOpen={true}>
            <button
              onClick={onNavigateToTable}
              className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-purple-900 text-white py-2 px-4 rounded-md transition-colors text-sm"
            >
              <Table size={16} />
              View Table
            </button>
          </CollapsibleSection>
        )}
        
        {/* Parameters */}
        {shouldShowParametersPanel() && (
          <CollapsibleSection title="Parameters">
            <div className="space-y-2">
              {getVisibleParameters().includes('prune_mode') && (
                <div>
                  <label className="block text-xs font-medium mb-1" title="Heuristics to remove meaningless data">
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
                    <option value="all" title="Prune metrics marked in each entry">all</option>
                  </select>
                </div>
              )}
              {getVisibleParameters().includes('groups_recommendation_strategy') && (
                <div>
                  <label className="block text-xs font-medium mb-1" title="Strategy for recommending groups">
                    groups_recommendation_strategy
                  </label>
                  <select
                    value={request.groups_recommendation_strategy}
                    onChange={(e) => handleParameterChange('groups_recommendation_strategy', e.target.value)}
                    className="w-full p-1.5 border rounded text-xs bg-gray-700 text-white border-gray-600"
                    title="Select group recommendation strategy"
                  >
                    <option value="none" title="No group recommendations">none</option>
                    <option value="first_alphabetical" title="Recommend first alphabetical candidates">first_alphabetical</option>
                    <option value="concise" title="Recommend most concise candidates">concise</option>
                  </select>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Filters */}
        <CollapsibleSection title="Filters">
          <FilterManager
            title="Filters"
            items={request.filters || []}
            input={filterInput}
            setInput={setFilterInput}
            onAdd={handleAddFilter}
            onRemove={handleRemoveFilter}
            placeholder="e.g., runner:not_in:local"
            itemColor="blue"
            helpContent={
              <>
                <p className="font-medium mb-1">Filter Format: <u>field:operator:value</u></p>
                <p className="mb-1 text-gray-300">• <i>in/not_in</i>:</p>
                <p className="ml-2 text-gray-400">agent_name:in:agent1,agent2</p>
                <p className="mb-1 text-gray-300">• <i>range</i>:</p>
                <p className="ml-2 text-[10px] text-gray-400">value:range:10:100<span className="text-gray-500 ml-1">(between 10 and 100)</span></p>
                <p className="ml-2 text-[10px] text-gray-400">value:range:10:<span className="text-gray-500 ml-1">(minimum 10)</span></p>
                <p className="ml-2 text-[10px] text-gray-400">value:range::100<span className="text-gray-500 ml-1">(maximum 100)</span></p>
                <p className="ml-2 text-[10px] text-gray-400">time_end_utc:range:(2025-05-23T11:48):</p>
                <p className="ml-4 text-[10px] text-gray-500">(after specified date/time)</p>
              </>
            }
          />
        </CollapsibleSection>

        {/* Groups */}
        <CollapsibleSection title="Groups">
          <FilterManager
            title="Groups"
            items={request.groups || []}
            input={groupInput}
            setInput={setGroupInput}
            onAdd={handleAddGroup}
            onRemove={handleRemoveGroup}
            recommendations={response?.group_recommendations}
            onAddRecommendation={handleAddGroupRecommendation}
            placeholder="e.g., agent_name"
            itemColor="green"
            helpContent={
              <>
                <p className="mb-1">• Simple: agent_name</p>
                <p>• Conditional: debug_mode:in:false</p>
              </>
            }
          />
        </CollapsibleSection>
        
        {/* Resize handle */}
        <div
          className="absolute right-0 top-0 w-1 h-full cursor-ew-resize bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
          onMouseDown={handleMouseDown}
        >
          <GripVertical size={14} className="text-gray-500" />
        </div>
      </div>

      {/* Main Window */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {loading && <div className="text-center py-4 text-gray-600">Loading...</div>}
        {error && <div className="text-red-600 text-center py-2 text-xs">Error: {error}</div>}
        
        {response && response.groups.length === 0 && (
          <div className="text-center py-4 text-gray-600">No log entries found matching the criteria.</div>
        )}
        
        {response && response.groups.map((group, groupIdx) => (
          <div key={groupIdx} className="mb-6">
            {group.aggr_entry && (
              <LogAggrEntryComponent
                entry={group}
                filters={request.filters || []}
                groups={request.groups || []}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogsDashboard;