// Shared types for both Table and Logs views

// Common types
export interface Cell {
  values: Record<string, any>;
  details: Record<string, any>;
}

// Table API types
export interface TableRequest {
  filters?: string[];
  slices?: string[];
  column_selections?: string[];
  column_selections_to_add?: string[];
  column_selections_to_remove?: string[];
  sort_by_column?: string;
  sort_order?: 'asc' | 'desc';
  prune_mode?: 'none' | 'column';
  absent_metrics_strategy?: 'all_or_nothing' | 'nullify' | 'accept_subset';
  slices_recommendation_strategy?: 'none' | 'first_alphabetical' | 'concise';
}

export interface ColumnNode {
  column_node_id: string;
  name: string;
  description?: string;
  selection_state: 'all' | 'partial' | 'none';
  children?: ColumnNode[];
}

export interface Column {
  column_id: string;
  name: string;
  description?: string;
  unit?: string;
}

export interface TableResponse {
  rows: Cell[][];
  column_tree: ColumnNode;
  columns: Column[];
  filters: string[];
  slices: string[];
  slice_recommendations: string[];
  sorted_by?: { column: string; order: 'asc' | 'desc' };
}

// Logs API types
export interface LogsRequest {
  filters?: string[];
  groups?: string[];
  prune_mode?: 'none' | 'column' | 'all';
  groups_recommendation_strategy?: 'none' | 'first_alphabetical' | 'concise';
}

export interface LogFile {
  filename: string;
  description: string;
  content: string;
}

export interface LogEntry {
  name: string;
  metadata: Record<string, any>;
  metrics: Record<string, any>;
  log_files: LogFile[];
}

export interface LogGroup {
  aggr_entry: {
    name: string;
    metadata: Record<string, any>;
    metrics: Record<string, any>;
  };
  entries: LogEntry[];
}

export interface LogsResponse {
  groups: LogGroup[];
  group_recommendations: string[];
}

// Dashboard Configuration types for web component usage
export type MetricSelection = 'CUSTOM' | 'PERFORMANCE' | 'CAL' | 'ERROR' | 'FEEDBACK';
export type ViewType = 'table' | 'logs';

export interface ViewConfig {
  // Which parameters to show and their default values
  showParameters?: string[];
  defaultParameters?: Record<string, any>;
  // Which time filters to include in recommendations
  timeFilterRecommendations?: string[];
  // Refresh rate in seconds (for web component usage)
  refreshRate?: number;
}

export interface DashboardConfig {
  // Which views to show - if single view, don't show 'Views' panel
  views?: ViewType[];
  // Global filters - not shown in 'Filters' panel but passed in each request
  globalFilters?: string[];
  // Metric selection - keep as unused param for now
  metricSelection?: MetricSelection;
  // Configuration for each view
  viewConfigs?: {
    table?: ViewConfig;
    logs?: ViewConfig;
  };
  // Default view to show
  defaultView?: ViewType;
}