import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Info, Plus, BarChart3, Table, FileText } from 'lucide-react';
import { DashboardConfig } from './types';

// Collapsible Section Component
export const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="mb-3 bg-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2 hover:bg-gray-600 text-white"
      >
        <span className="font-medium text-sm">{title}</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {isOpen && <div className="p-3 bg-gray-750">{children}</div>}
    </div>
  );
};

// Details Popup Component
export const DetailsPopup: React.FC<{
  details: Record<string, any>;
  onClose: () => void;
  title?: string;
}> = ({ details, onClose, title = "Details" }) => {
  // Handle Esc key press
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-4xl max-h-[80vh] overflow-auto" style={{ width: '80vw' }}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
        <pre className="text-[10px] p-3 rounded overflow-auto bg-gray-50 custom-scrollbar">
          {JSON.stringify(details, null, 2)}
        </pre>
      </div>
    </div>
  );
};

// File Content Popup Component
export const FileContentPopup: React.FC<{
  filename: string;
  content: string;
  onClose: () => void;
}> = ({ filename, content, onClose }) => {
  // Handle Esc key press
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-4xl max-h-[80vh] overflow-auto" style={{ width: '80vw' }}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">{filename}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
        <pre className="text-[10px] p-3 rounded overflow-auto bg-gray-50 custom-scrollbar whitespace-pre-wrap">
          {content}
        </pre>
      </div>
    </div>
  );
};

// Filter/Slice/Group Management Component
interface FilterManagerProps {
  title: string;
  items: string[];
  input: string;
  setInput: (value: string) => void;
  onAdd: () => void;
  onRemove: (item: string) => void;
  recommendations?: string[];
  onAddRecommendation?: (item: string) => void;
  placeholder: string;
  itemColor: 'blue' | 'green';
  showHelp?: boolean;
  helpContent?: React.ReactNode;
}

export const FilterManager: React.FC<FilterManagerProps> = ({
  title,
  items,
  input,
  setInput,
  onAdd,
  onRemove,
  recommendations,
  onAddRecommendation,
  placeholder,
  itemColor,
  showHelp = true,
  helpContent
}) => {
  const [showHelpContent, setShowHelpContent] = useState(false);
  
  const bgColors: Record<'blue' | 'green', string> = {
    blue: 'bg-blue-950',
    green: 'bg-green-900'
  };
  
  const hoverColors: Record<'blue' | 'green', string> = {
    blue: 'hover:bg-blue-800',
    green: 'hover:bg-green-800'
  };

  return (
    <div className="space-y-2">
      {/* Current items */}
      {items && items.length > 0 && (
        <div>
          <label className="block text-xs font-medium mb-1">Current {title}</label>
          <div className="flex flex-wrap gap-1">
            {items.map((item, idx) => (
              <div key={idx} className={`inline-flex items-center ${bgColors[itemColor]} px-2 py-1 rounded-full`}>
                <button
                  onClick={() => onRemove(item)}
                  className="text-red-400 hover:text-red-300 mr-1"
                >
                  <X size={10} />
                </button>
                <span className="text-xs">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add item */}
      <div>
        <label className="block text-xs font-medium mb-1">Add {title.slice(0, -1)}</label>
        <div className="flex gap-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onAdd()}
            placeholder={placeholder}
            className="flex-1 p-1.5 border rounded text-xs bg-gray-700 text-white border-gray-600 placeholder-gray-400"
          />
          <button
            onClick={onAdd}
            className="px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs flex items-center justify-center"
            title="Add filter"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Help */}
      {showHelp && helpContent && (
        <div>
          <button
            onClick={() => setShowHelpContent(!showHelpContent)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <Info size={12} />
            {title.slice(0, -1)} Syntax Help
          </button>
          {showHelpContent && (
            <div className="mt-2 p-2 bg-gray-600 rounded text-xs">
              {helpContent}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && onAddRecommendation && (
        <div>
          <label className="block text-xs font-medium mb-1">Recommendations</label>
          <div className="flex flex-wrap gap-1">
            {recommendations.map((rec) => (
              <button
                key={rec}
                onClick={() => onAddRecommendation(rec)}
                className={`inline-flex items-center px-2 py-1 ${bgColors[itemColor]} ${hoverColors[itemColor]} rounded-full text-xs`}
              >
                {rec}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Utility functions
export const isTimestampLike = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  
  // ISO 8601 timestamp patterns
  const isoPatterns = [
    // Full ISO format with timezone: 2025-05-23T11:48:26.341261+00:00
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+[+-]\d{2}:\d{2}$/,
    // ISO format without timezone: 2025-05-23T11:48:26.341267
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+$/,
    // ISO format with seconds: 2025-05-23T11:48:26
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
    // ISO format without seconds: 2025-05-23T11:48
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    // ISO format with Z timezone: 2025-05-23T11:48:26.341261Z
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/,
    // Date only: 2025-05-23
    /^\d{4}-\d{2}-\d{2}$/,
    // Unix timestamp (as string): 1716464906
    /^\d{10}$/,
    // Unix timestamp with milliseconds: 1716464906341
    /^\d{13}$/,
  ];
  
  // Check against regex patterns
  for (const pattern of isoPatterns) {
    if (pattern.test(value)) return true;
  }
  
  // Additional datetime formats that Date.parse can handle
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // Additional validation to avoid false positives
      const year = date.getFullYear();
      if (year >= 1900 && year <= 2100) return true;
    }
  } catch {
    // Ignore parse errors
  }
  
  // Additional heuristics for timestamp-like strings
  // Must contain date-like pattern (YYYY-MM-DD or similar)
  if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value)) {
    // And optionally time-like pattern
    if (value.includes('T') || /\d{1,2}:\d{2}/.test(value)) {
      return true;
    }
  }
  
  // Common date formats
  if (/^\d{1,2}\/\d{1,2}\/\d{4}( \d{1,2}:\d{2}(:\d{2})?)?$/.test(value)) {
    return true; // MM/DD/YYYY or MM/DD/YYYY HH:MM:SS
  }
  
  return false;
};

export const formatTimestamp = (value: any): string => {
  try {
    const date = new Date(value);
    // Compact format: MM/DD HH:mm
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  } catch {
    return String(value);
  }
};

export const getStyleClass = (key: string, filters: string[], slicesOrGroups: string[]): string => {
  const isFilterKey = filters.some(filter => filter.startsWith(`${key}:`));
  const isSliceKey = slicesOrGroups.includes(key) || slicesOrGroups.some(slice => slice.startsWith(`${key}:`));
  
  if (isSliceKey && isFilterKey) return 'text-cyan-700';
  if (isFilterKey) return 'text-blue-700';
  if (isSliceKey) return 'text-green-700';
  return '';
};

// Helper to merge global filters with request filters
export const mergeGlobalFilters = (globalFilters: string[] | undefined, requestFilters: string[] | undefined): string[] => {
  const global = globalFilters || [];
  const request = requestFilters || [];
  
  // Combine both arrays
  const combined = [...global, ...request];
  
  // Remove duplicates while preserving order
  return Array.from(new Set(combined));
};

// Helper function to convert human-readable time periods to hours
export const parseTimePeriodToHours = (period: string): number | null => {
  const normalized = period.toLowerCase().trim();

  if (normalized.includes('second')) {
    const match = normalized.match(/(\d+)\s*second/);
    if (match) return parseInt(match[1]) / 60 / 60;
    if (normalized.endsWith('second')) return 1 / 60 / 60;
  }
  
  if (normalized.includes('minute')) {
    const match = normalized.match(/(\d+)\s*minute/);
    if (match) return parseInt(match[1]) / 60;
    if (normalized.endsWith('minute')) return 1 / 60;
  }
  
  if (normalized.includes('hour')) {
    const match = normalized.match(/(\d+)\s*hour/);
    if (match) return parseInt(match[1]);
    if (normalized.endsWith('hour')) return 1;
  }
  
  if (normalized.includes('day')) {
    const match = normalized.match(/(\d+)\s*day/);
    if (match) return parseInt(match[1]) * 24;
    if (normalized.endsWith('day')) return 24;
  }
  
  if (normalized.includes('week')) {
    const match = normalized.match(/(\d+)\s*week/);
    if (match) return parseInt(match[1]) * 168;
    if (normalized.endsWith('week')) return 168;
  }
  
  if (normalized.includes('month')) {
    const match = normalized.match(/(\d+)\s*month/);
    if (match) return parseInt(match[1]) * 24 * 30; // Approximate
    if (normalized.endsWith('month')) return 24 * 30;
  }
  
  if (normalized.includes('year')) {
    const match = normalized.match(/(\d+)\s*year/);
    if (match) return parseInt(match[1]) * 24 * 365; // Approximate
    if (normalized.endsWith('year')) return 24 * 365;
  }
  
  return null;
};

export const getTimeFilter = (filter_label: string) => {
  const now = new Date();
  const hours = parseTimePeriodToHours(filter_label);
  if (hours !== null) {
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const isoString = cutoff.toISOString().replace(/\.\d{3}Z$/, '');
    return `time_end_utc:range:(${isoString}):`
  } else {
    return ''
  }
}

// Generate time filter suggestions
export const getTimeFilters = (timeFilterRecommendations?: string[]) => {
  // If config provides custom recommendations, convert them to filters
  if (timeFilterRecommendations) {
    return timeFilterRecommendations.map(recommendation => {
      return {
        label: recommendation,
        filter: getTimeFilter(recommendation)
      }
    });
  }

  const now = new Date();
  
  // Default recommendations
  const formats = [
    { label: 'last hour', hours: 1 },
    { label: 'last day', hours: 24 },
    { label: 'last week', hours: 168 },
    { label: 'last month', hours: 24 * 30 },
    { label: 'last year', hours: 24 * 365 }
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

// Filters Section Component
interface FiltersSectionProps {
  filters: string[];
  filterInput: string;
  setFilterInput: (value: string) => void;
  onAddFilter: () => void;
  onRemoveFilter: (filter: string) => void;
  onTimeFilter?: (filter: string) => void;
  timeFilterRecommendations?: string[];
  showTimeFilters?: boolean;
}

// Filter Help Content Component
export const FilterHelpContent: React.FC = () => (
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
);

export const FiltersSection: React.FC<FiltersSectionProps> = ({
  filters,
  filterInput,
  setFilterInput,
  onAddFilter,
  onRemoveFilter,
  onTimeFilter,
  timeFilterRecommendations,
  showTimeFilters = true
}) => {
  if (showTimeFilters && timeFilterRecommendations) {
    showTimeFilters = timeFilterRecommendations.length > 0
  }
  return (
    <CollapsibleSection title="Filters">
      <FilterManager
        title="Filters"
        items={filters}
        input={filterInput}
        setInput={setFilterInput}
        onAdd={onAddFilter}
        onRemove={onRemoveFilter}
        placeholder="e.g., runner:not_in:local"
        itemColor="blue"
        helpContent={<FilterHelpContent />}
      />

      {/* Time filters */}
      {showTimeFilters && onTimeFilter && (
        <div className="mt-2">
          <label className="block text-xs font-medium mb-1">Time Filters</label>
          <div className="flex flex-wrap gap-1">
            {getTimeFilters(timeFilterRecommendations).map(({ label, filter }) => (
              <button
                key={label}
                onClick={() => onTimeFilter(filter)}
                className="inline-flex items-center px-2 py-1 bg-blue-950 hover:bg-blue-800 rounded-full text-xs"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
};

// View Navigation Component
interface ViewNavigationProps {
  availableViews: string[];
  currentViewId: string;
  config: DashboardConfig;
  onNavigateToView: (viewId: string) => void;
}

const getViewTypeIcon = (viewType: string) => {
  switch (viewType) {
    case 'timeseries':
      return BarChart3;
    case 'table':
      return Table;
    case 'logs':
      return FileText;
    default:
      return FileText;
  }
};

const getDefaultViewName = (viewType: string) => {
  switch (viewType) {
    case 'timeseries':
      return 'Time Series';
    case 'table':
      return 'Table';
    case 'logs':
      return 'Logs';
    default:
      return 'View';
  }
};

export const ViewNavigation: React.FC<ViewNavigationProps> = ({
  availableViews,
  currentViewId,
  config,
  onNavigateToView
}) => {
  // Filter out the current view and show views in configuration order
  const otherViews = availableViews.filter(viewId => viewId !== currentViewId);
  
  // Only show if there are other views to navigate to
  if (otherViews.length === 0) {
    return null;
  }
  
  return (
    <CollapsibleSection title="Views" defaultOpen={true}>
      <div className="space-y-2">
        {otherViews.map(viewId => {
          const viewConfig = config?.viewConfigs?.[viewId];
          const viewType = viewConfig?.view_type || 'logs';
          const viewName = viewConfig?.view_name || getDefaultViewName(viewType);
          const IconComponent = getViewTypeIcon(viewType);
          
          return (
            <button
              key={viewId}
              onClick={() => onNavigateToView(viewId)}
              className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-purple-900 text-white py-2 px-4 rounded-md transition-colors text-sm"
            >
              <IconComponent size={16} />
              {viewName}
            </button>
          );
        })}
      </div>
    </CollapsibleSection>
  );
};

// API URL construction helper
export const getApiUrl = (config: DashboardConfig | undefined, apiCall: string): string => {
  const baseUrl = config?.metrics_service_url || 'http://localhost:8000/api/v1/';
  return baseUrl.endsWith('/') ? baseUrl + apiCall : baseUrl + '/' + apiCall;
};