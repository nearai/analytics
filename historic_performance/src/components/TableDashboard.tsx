import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, X, ChevronUp, GripVertical, FileText } from 'lucide-react';
import { TableRequest, TableResponse, ColumnNode, Column, Cell } from './shared/types';
import { CollapsibleSection, DetailsPopup, FilterManager, formatTimestamp, getStyleClass } from './shared/SharedComponents';

// Component-specific utility functions
const formatCellValue = (values: Record<string, any>, unit?: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let hasValue = false;
  let hasRange = false;
  
  if (values.value !== undefined && values.value !== null) {
    hasValue = true;
    const valueStr = unit === 'timestamp' ? formatTimestamp(values.value) : String(values.value);
    parts.push(
      <div key="value" className="text-xs font-medium text-center">
        {valueStr}
      </div>
    );
  }
  
  if (values.min_value !== undefined && values.min_value !== null && values.max_value !== undefined && values.max_value !== null) {
    hasRange = true;
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
            {level==0 && (
                <span className="text-xs text-gray-500">&lt;root&gt;</span>    
            )}
            {level>0 && (
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
  onNavigateToLogs: () => void;
  savedRequest?: TableRequest | null;
  onRequestChange?: (request: TableRequest) => void;
}

const TableDashboard: React.FC<TableDashboardProps> = ({ onNavigateToLogs, savedRequest, onRequestChange }) => {
  // State
  const [request, setRequest] = useState<TableRequest>(savedRequest || {
    prune_mode: 'column',
    absent_metrics_strategy: 'nullify',
    slices_recommendation_strategy: 'concise',
    filters: [],
    slices: [],
    column_selections: ['/metadata/time_end_utc/max_value', '/metrics/']
  });
  
  const [response, setResponse] = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, any> | null>(null);
  const [filterInput, setFilterInput] = useState('');
  const [sliceInput, setSliceInput] = useState('');
  const [isColumnTreeOpen, setIsColumnTreeOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(256); // 256px = 16rem

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

  // Generate time filter suggestions
  const getTimeFilters = () => {
    const now = new Date();
    const formats = [
      { label: 'last hour', hours: 1 },
      { label: 'last day', hours: 24 },
      { label: 'last week', hours: 168 }
    ];
    
    return formats.map(({ label, hours }) => {
      const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
      const isoString = cutoff.toISOString().replace(/\.\d{3}Z$/, '');
      return {
        label,
        filter: `time_end_utc:range:(${isoString}):`
      };
    });
  };

  // Update parent component when request changes
  useEffect(() => {
    if (onRequestChange) {
      onRequestChange(request);
    }
  }, [request, onRequestChange]);

  // API call
  const fetchTable = useCallback(async (requestData: TableRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      setRequest(requestData)
      const res = await fetch('http://localhost:8000/api/v1/table/aggregation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setResponse(data);
      
      // Update request with response data
      if (requestData.column_selections_to_remove && requestData.column_selections_to_remove?.length > 0) {
        setRequest(prev => ({
            ...prev,
            filters: data.filters || [],
            slices: data.slices || [],
            column_selections: data.columns.map((col: Column) => col.column_id),
            column_selections_to_add: [],
            column_selections_to_remove: []
        }));
      } else {
        setRequest(prev => ({
            ...prev,
            filters: data.filters || [],
            slices: data.slices || []
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!savedRequest) {
      fetchTable(request);
    }
  }, []); // Empty dependency array - only run once on mount

  // Load saved request when component mounts with saved data
  useEffect(() => {
    if (savedRequest) {
      fetchTable(savedRequest);
    }
  }, []); // Empty dependency array - only run once on mount

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
    const newFilters = (request.filters || []).filter(f => !f.startsWith('time_end_utc:'));
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

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Control Panel */}
      <div 
        className="bg-gray-800 shadow-lg overflow-y-auto p-3 text-white relative dark-scrollbar" 
        style={{ width: `${panelWidth}px` }}
      >
        <h2 className="text-lg font-bold mb-3">Table Controls</h2>
        
        {/* Parameters */}
        <CollapsibleSection title="Parameters">
          <div className="space-y-2">
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
            <div>
              <label className="block text-xs font-medium mb-1" title="How to handle metrics that are absent in some entries">
                absent_metrics_strategy
              </label>
              <select
                value={request.absent_metrics_strategy}
                onChange={(e) => handleParameterChange('absent_metrics_strategy', e.target.value)}
                className="w-full p-1.5 border rounded text-xs bg-gray-700 text-white border-gray-600"
                title="Select strategy for absent metrics"
              >
                <option value="all_or_nothing" title="Do aggregation only if present in all slice entries">all_or_nothing</option>
                <option value="nullify" title="Replace missing values with 0">nullify</option>
                <option value="accept_subset" title="Include even if only in some entries. Number of samples is recorded in n_samples">accept_subset</option>
              </select>
            </div>
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
          </div>
        </CollapsibleSection>

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

          {/* Time filters */}
          <div className="mt-2">
            <label className="block text-xs font-medium mb-1">Time Filters</label>
            <div className="flex flex-wrap gap-1">
              {getTimeFilters().map(({ label, filter }) => (
                <button
                  key={label}
                  onClick={() => handleTimeFilter(filter)}
                  className="inline-flex items-center px-2 py-1 bg-blue-950 hover:bg-blue-800 rounded-full text-xs"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* Slices */}
        <CollapsibleSection title="Slices">
          <FilterManager
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

        {/* Navigation to Logs */}
        <CollapsibleSection title="Views" defaultOpen={true}>
          <button
            onClick={onNavigateToLogs}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-purple-900 text-white py-2 px-4 rounded-md transition-colors text-sm"
          >
            <FileText size={16} />
            View Logs
          </button>
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
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
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