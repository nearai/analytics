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

// Time Series API types
export interface LineConfiguration {
  /** Unique identifier for this line configuration. Generated using `line-${Date.now()}` for internal state management and React keys. */
  id: string;
  metricName: string;
  filters?: string[];
  slice?: string;
  /** Color assignment. If no slice is used, this is a single color string. If slice is used, this should be a map from slice values to colors. */
  color?: string | Record<string, string>;
  /** Track which colors were manually set by the user vs auto-generated. For single colors: boolean. For slice colors: map from slice values to boolean. */
  userSetColor?: boolean | Record<string, boolean>;
  /** Optional custom display name for this line. If not provided, auto-generated names will be used. */
  displayName?: string;
  /** Optional custom display names for slice lines. If not given, "${displayName}_${sliceValue}" is used */
  displayNamesForSliceLines?: Record<string, string>;
}

export interface GraphConfiguration {
  /** Unique identifier for this graph configuration. Generated using `graph-${Date.now()}` for internal state management and React keys. */
  id: string;
  lineConfigurations: LineConfiguration[];
  /** Optional custom name for this graph. If not provided, auto-generated names will be used. */
  name?: string;
}

export interface TimeSeriesRequest {
  /** Array of filters from control panel including the temporal filter */
  filters?: string[];
  time_granulation?: string;
  /** Array of graph configurations. Position in the grid is determined by array order (2-column grid layout, left-to-right, top-to-bottom). */
  graphs?: GraphConfiguration[];
}

export interface TimeSeriesDataPoint {
  time: number;
  value: number;
}

export interface TimeSeriesLine {
  /** Unique identifier for this rendered line. Generated during data processing from LineConfiguration metadata and slice values. */
  id: string;
  name: string;
  data: TimeSeriesDataPoint[];
  /** Color for this specific line. Derived from LineConfiguration.color based on slice values or auto-assigned. */
  color: string;
}

export interface TimeSeriesGraph {
  /** Unique identifier for this rendered graph. Corresponds to GraphConfiguration.id for associating data with configuration. */
  id: string;
  lines: TimeSeriesLine[];
}

export interface TimeSeriesApiRequest {
  time_granulation: number;
  moving_aggregation_field_name: string;
  global_filters?: string[];
  moving_aggregation_filters?: string[];
  slice_field?: string;
}

export interface TimeSeriesApiResponse {
  time_begin: number;
  time_end: number;
  time_granulation: number;
  filters: string[];
  field_name: string;
  slice_field: string;
  slice_values: string[];
  values: number[][];
  min_value: number;
  max_value: number;
}

// Dashboard Configuration types for web component usage
export type MetricSelection = 'CUSTOM' | 'PERFORMANCE' | 'CAL' | 'ERROR' | 'FEEDBACK' | 'COMPARE_MODELS';
export type ViewType = 'timeseries' | 'table' | 'logs';

export interface ViewConfig {
  // Type of view component to render
  view_type: ViewType;
  // Display name for the view
  view_name: string;
  // Metric selection for this specific view
  metricSelection: MetricSelection;
  // Which parameters to show and their default values
  showParameters?: string[];
  defaultParameters?: Record<string, any>;
  // Which time filters to include in recommendations
  timeFilterRecommendations?: string[];
  // Refresh rate in seconds (for web component usage)
  refreshRate?: number;
  // Time field name
  time_field?: string;
}

export interface DashboardConfig {
  // Which views to show by their unique IDs - if single view, don't show 'Views' panel
  views?: string[];
  // Global filters - not shown in 'Filters' panel but passed in each request
  globalFilters?: string[];
  // Metrics service URL
  metrics_service_url?: string;
  // Configuration for each view, keyed by view ID
  viewConfigs?: Record<string, ViewConfig>;
  // Default view to show by view ID
  defaultView?: string;
}