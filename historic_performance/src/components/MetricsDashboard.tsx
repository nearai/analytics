import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, X, ChevronUp, Info } from 'lucide-react';

// Types
interface TableRequest {
  filters?: string[];
  slices?: string[];
  column_selections?: string[];
  column_selections_to_add?: string[];
  column_selections_to_remove?: string[];
  sort_by_column?: string;
  sort_order?: 'asc' | 'desc';
  prune_mode?: 'none' | 'all' | 'column';
  absent_metrics_strategy?: 'all_or_nothing' | 'nullify' | 'accept_subset';
  slices_recommendation_strategy?: 'none' | 'first_alphabetical' | 'concise';
}

interface ColumnNode {
  column_node_id: string;
  name: string;
  description?: string;
  selection_state: 'all' | 'partial' | 'none';
  children?: ColumnNode[];
}

interface Column {
  column_id: string;
  name: string;
  description?: string;
  unit?: string;
}

interface Cell {
  values: Record<string, any>;
  details: Record<string, any>;
}

interface TableResponse {
  rows: Cell[][];
  column_tree: ColumnNode;
  columns: Column[];
  filters: string[];
  slices: string[];
  slice_recommendations: string[];
  sorted_by?: { column: string; order: 'asc' | 'desc' };
}

// Utility functions
const formatTimestamp = (value: any): string => {
  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch {
    return String(value);
  }
};

const formatCellValue = (values: Record<string, any>, unit?: string): string => {
  const parts: string[] = [];
  if (values.value !== undefined && values.value !== null) {
    if (unit === 'timestamp') {
        parts.push(formatTimestamp(values.value));    
    } else {
        parts.push(String(values.value));
    }
  }
  if (values.min_value !== undefined && values.min_value !== null && values.max_value !== undefined && values.max_value !== null) {
    if (unit === 'timestamp') {
        parts.push(`[${formatTimestamp(values.min_value)}, ${formatTimestamp(values.max_value)}]`);
    } else {
        parts.push(`[${values.min_value}, ${values.max_value}]`);
    }
  }
  return parts.join('\n');
};

const formatColumnName = (values: Record<string, any>): string => {
  const value = values.value;
  if (!value) return '';
  
  const parts = String(value).split('/');
  return parts
    .map((part, i) => i < parts.length - 1 ? part + '/' : part)
    .join('\n');
};

const formatRowName = (values: Record<string, any>): string => {
  return Object.entries(values)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
};

// Components
const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2 bg-gray-100 hover:bg-gray-200 rounded"
      >
        <span className="font-semibold">{title}</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen && <div className="mt-2 p-2">{children}</div>}
    </div>
  );
};

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
        <div className="w-4 h-4 bg-purple-900 border border-purple-900 rounded-sm" />
      );
      case 'partial': return (
        <div className="w-4 h-4 border border-purple-900 rounded-sm relative overflow-hidden">
          <div 
            className="absolute inset-0 bg-purple-900" 
            style={{ 
              clipPath: 'polygon(100% 100%, 100% 0, 0 0)' 
            }} 
          />
        </div>
      );
      case 'none': return (
        <div className="w-4 h-4 border border-gray-400 rounded-sm" />
      );
    }
  };
  
  return (
    <div>
      <div 
        className="flex items-center py-1 hover:bg-gray-100 cursor-pointer"
        style={{ paddingLeft: `${level * 20}px` }}
      >
        <div className="w-5 mr-1">
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
        </div>
        <button
          onClick={() => onToggle(node.column_node_id)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {getCheckboxIcon()}
          <div className="flex-1">
            {level==0 && (
                <span className="text-sm text-gray-500">&lt;root&gt;</span>    
            )}
            {level>0 && (
                <span className="text-sm">{node.name}</span>    
            )}
            {node.description && (
              <span className="text-xs text-gray-500 ml-2">{node.description}</span>
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

const DetailsPopup: React.FC<{
  details: Record<string, any>;
  onClose: () => void;
}> = ({ details, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Details</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <pre className="text-xs p-4 rounded overflow-auto">
          {JSON.stringify(details, null, 2)}
        </pre>
      </div>
    </div>
  );
};

const MetricsDashboard: React.FC = () => {
  // State
  const [request, setRequest] = useState<TableRequest>({
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
  const [showFilterHelp, setShowFilterHelp] = useState(false);
  const [showSliceHelp, setShowSliceHelp] = useState(false);
  const [isColumnTreeOpen, setIsColumnTreeOpen] = useState(true);

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

  // API call
  const fetchTable = useCallback(async (requestData: TableRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      setRequest(requestData)
      const res = await fetch('http://localhost:8000/api/v1/table/create', {
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
    fetchTable(request);
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
    <div className="flex h-screen bg-gray-50">
      {/* Control Panel */}
      <div className="w-80 bg-white shadow-lg overflow-y-auto p-4">
        <h2 className="text-xl font-bold mb-4">Controls</h2>
        
        {/* Parameters */}
        <CollapsibleSection title="Parameters">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">prune_mode</label>
              <select
                value={request.prune_mode}
                onChange={(e) => handleParameterChange('prune_mode', e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="none">none - No pruning</option>
                <option value="column">column - Prune if marked in all slice entries</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">absent_metrics_strategy</label>
              <select
                value={request.absent_metrics_strategy}
                onChange={(e) => handleParameterChange('absent_metrics_strategy', e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="all_or_nothing">all_or_nothing - Include only if present in all slice entries</option>
                <option value="nullify">nullify - Replace missing with 0</option>
                <option value="accept_subset">accept_subset - Include even if only in some entries</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">slices_recommendation_strategy</label>
              <select
                value={request.slices_recommendation_strategy}
                onChange={(e) => handleParameterChange('slices_recommendation_strategy', e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="none">none - No recommendations</option>
                <option value="first_alphabetical">first_alphabetical - First alphabetical candidates</option>
                <option value="concise">concise - Most concise candidates</option>
              </select>
            </div>
          </div>
        </CollapsibleSection>

        {/* Filters */}
        <CollapsibleSection title="Filters">
          <div className="space-y-3">
            {/* Current filters */}
            <div>
              <label className="block text-sm font-medium mb-1">Current Filters</label>
              <div className="space-y-1">
                {request.filters?.map((filter, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                    <span className="text-sm">{filter}</span>
                    <button
                      onClick={() => handleRemoveFilter(filter)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add filter */}
            <div>
              <label className="block text-sm font-medium mb-1">Add Filter</label>
              <input
                type="text"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddFilter()}
                placeholder="e.g., runner:not_in:local"
                className="w-full p-2 border rounded"
              />
            </div>

            {/* Filter help */}
            <div>
              <button
                onClick={() => setShowFilterHelp(!showFilterHelp)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Info size={14} />
                Filter Syntax Help
              </button>
              {showFilterHelp && (
                <div className="mt-2 p-3 bg-gray-100 rounded text-sm">
                  <p className="font-medium mb-2">Filter Format: <u>field:operator:value</u></p>
                  <p className="mb-1">• <i>in/not_in</i>:</p>
                  <p className="mb-1">agent_name:in:agent1,agent2</p>
                  <p className="mb-1">• <i>range</i>:</p>
                  <p className="text-xs">value:range:10:100<span className="text-xs text-gray-500 ml-2">(between 10 and 100)</span></p>
                  <p className="text-xs">value:range:10:<span className="text-xs text-gray-500 ml-2">(minimum 10)</span></p>
                  <p className="text-xs">value:range::100<span className="text-xs text-gray-500 ml-2">(maximum 100)</span></p>
                  <p className="text-xs">time_end_utc:range:(2025-05-23T11:48):</p>
                  <p className="text-xs text-gray-500 ml-2">(after specified date/time)</p>
                </div>
              )}
            </div>

            {/* Time filters */}
            <div>
              <label className="block text-sm font-medium mb-1">Time Filters</label>
              <div className="space-y-1">
                {getTimeFilters().map(({ label, filter }) => (
                  <button
                    key={label}
                    onClick={() => handleTimeFilter(filter)}
                    className="w-full text-left p-2 bg-blue-50 hover:bg-blue-100 rounded text-sm"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Slices */}
        <CollapsibleSection title="Slices">
          <div className="space-y-3">
            {/* Current slices */}
            <div>
              <label className="block text-sm font-medium mb-1">Current Slices</label>
              <div className="space-y-1">
                {request.slices?.map((slice, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                    <span className="text-sm">{slice}</span>
                    <button
                      onClick={() => handleRemoveSlice(slice)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add slice */}
            <div>
              <label className="block text-sm font-medium mb-1">Add Slice</label>
              <input
                type="text"
                value={sliceInput}
                onChange={(e) => setSliceInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSlice()}
                placeholder="e.g., agent_name"
                className="w-full p-2 border rounded"
              />
            </div>

            {/* Slice help */}
            <div>
              <button
                onClick={() => setShowSliceHelp(!showSliceHelp)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Info size={14} />
                Slice Syntax Help
              </button>
              {showSliceHelp && (
                <div className="mt-2 p-3 bg-gray-100 rounded text-sm">
                  <p className="mb-1">• Simple: agent_name</p>
                  <p>• Conditional: runner:in:local</p>
                </div>
              )}
            </div>

            {/* Slice recommendations */}
            {response?.slice_recommendations && (
              <div>
                <label className="block text-sm font-medium mb-1">Recommendations</label>
                <div className="space-y-1">
                  {response.slice_recommendations.map((rec) => (
                    <button
                      key={rec}
                      onClick={() => handleAddSliceRecommendation(rec)}
                      className="w-full text-left p-2 bg-green-50 hover:bg-green-100 rounded text-sm"
                    >
                      {rec}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Main Window */}
      <div className="flex-1 flex flex-col overflow-x-auto">
        {/* Column Tree */}
        <div className="bg-white shadow-sm">
          <button
            onClick={() => setIsColumnTreeOpen(!isColumnTreeOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
          >
            <span className="font-semibold">Column Selection</span>
            {isColumnTreeOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {isColumnTreeOpen && response?.column_tree && (
            <div className="max-h-60 overflow-y-auto p-3 border-t">
              <ColumnTreeNode node={response.column_tree} onToggle={handleColumnToggle} />
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          {error && <div className="text-red-600 text-center py-4">Error: {error}</div>}
          
          {response && response.rows.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 text-left border-b border-r">
                      {response.rows[0][0] && (
                        <div 
                          className={`${Object.keys(response.rows[0][0].details).length > 0 ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                          onClick={() => Object.keys(response.rows[0][0].details).length > 0 && setSelectedDetails(response.rows[0][0].details)}
                        >
                          <pre className="text-sm whitespace-pre-wrap">
                            {formatColumnName(response.rows[0][0].values)}
                          </pre>
                        </div>
                      )}
                    </th>
                    {response.rows[0].slice(1).map((cell, idx) => {
                      const column = response.columns[idx];
                      const hasDetails = Object.keys(cell.details).length > 0;
                      return (
                        <th key={idx} className="p-3 text-left border-b relative group">
                          <div className="flex items-start justify-between">
                            <div 
                              className={`flex-1 ${hasDetails ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                              onClick={() => hasDetails && setSelectedDetails(cell.details)}
                            >
                              <pre className="text-sm whitespace-pre-wrap">
                                {formatColumnName(cell.values)}
                              </pre>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleSort(column.column_id, 'desc')}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Sort descending"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                onClick={() => handleSort(column.column_id, 'asc')}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Sort ascending"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                onClick={() => handleRemoveColumn(column.column_id)}
                                className="p-1 hover:bg-gray-200 rounded text-red-500"
                                title="Remove column"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {response.rows.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b hover:bg-gray-50">
                      <td className="p-3 border-r bg-gray-50">
                        <div 
                          className={`text-sm ${Object.keys(row[0].details).length > 0 ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                          onClick={() => Object.keys(row[0].details).length > 0 && setSelectedDetails(row[0].details)}
                        >
                          <pre className="whitespace-pre-wrap">
                            {formatRowName(row[0].values)}
                          </pre>
                        </div>
                      </td>
                      {row.slice(1).map((cell, cellIdx) => {
                        const column = response.columns[cellIdx];
                        const hasDetails = Object.keys(cell.details).length > 0;
                        
                        return (
                          <td
                            key={cellIdx}
                            className={`p-3 ${hasDetails ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                            onClick={() => hasDetails && setSelectedDetails(cell.details)}
                          >
                            <pre className="text-sm whitespace-pre-wrap">
                              {formatCellValue(cell.values, column?.unit)}
                            </pre>
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

export default MetricsDashboard;