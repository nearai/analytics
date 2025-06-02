import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Info } from 'lucide-react';

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
  itemColor: string; // 'blue' | 'green'
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
  
  const bgColors = {
    blue: 'bg-blue-950',
    green: 'bg-green-900'
  };
  
  const hoverColors = {
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
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onAdd()}
          placeholder={placeholder}
          className="w-full p-1.5 border rounded text-xs bg-gray-700 text-white border-gray-600 placeholder-gray-400"
        />
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