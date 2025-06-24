"""Utilities to transform data."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from metrics_core.conversions.aggregate import AggregateAbsentMetricsStrategy, AggregateConversion, get_slice_values
from metrics_core.conversions.base import BaseConversion, ChainConversion
from metrics_core.conversions.categorize_metadata import CategorizeMetadataConversion
from metrics_core.conversions.determine_pruning import DeterminePruningConversion
from metrics_core.conversions.filter import FilterConversion, check_filters_against_entry
from metrics_core.conversions.ms_to_s import MsToSConversion
from metrics_core.conversions.prune import PruneConversion
from metrics_core.conversions.rename import RenameConversion
from metrics_core.conversions.round import RoundConversion
from metrics_core.conversions.sort_by_timestamp import SortByTimestampConversion
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry, MetadataFieldCategory
from metrics_core.models.column_selection import ColumnNode, TableColumnUnit
from metrics_core.models.condition import Condition, parse_condition_list, slice_condition
from metrics_core.models.grouped_canonical_metrics import GroupedCanonicalMetrics, GroupedCanonicalMetricsList
from metrics_core.models.moving_aggregation import MovingAggregation
from metrics_core.models.table import SortOrder, Table, TableCell


class MetricsTuneParams:
    """Parameters for metrics tuning conversions."""

    def __init__(
        self,
        verbose: bool = False,
        rename: bool = False,
        ms_to_s: bool = False,
        round: bool = True,
        round_precision: int = 2,
        determine_pruning: bool = True,
    ):
        """Initialize metrics tuning parameters.

        Args:
        ----
            verbose: Enable verbose logging.
            rename: Enable metric heuristic renaming.
            ms_to_s: Convert milliseconds to seconds.
            round: Enable value rounding.
            round_precision: Number of decimal places for rounding.
            determine_pruning: Enable pruning determination.

        """
        self.verbose = verbose
        self.rename = rename
        self.ms_to_s = ms_to_s
        self.round = round
        self.round_precision = round_precision
        self.determine_pruning = determine_pruning


def create_metrics_tuning(params: MetricsTuneParams) -> BaseConversion:
    """Create a metrics tuning conversion chain.

    Args:
    ----
        params: Configuration parameters for metrics tuning.

    Returns:
    -------
        A BaseConversion that applies the configured tuning operations.

    """
    conversions: List[BaseConversion] = []

    if params.rename:
        conversions.append(RenameConversion(verbose=params.verbose))

    if params.ms_to_s:
        conversions.append(MsToSConversion(verbose=params.verbose))

    if params.round:
        conversions.append(RoundConversion(precision=params.round_precision))

    if params.determine_pruning:
        conversions.append(DeterminePruningConversion())

    return ChainConversion(conversions)


class PruneMode(Enum):
    """Prune mode."""

    NONE = "none"
    ALL = "all"  # Individual pruning - prune metrics marked in each entry
    COLUMN = "column"  # Global pruning - only prune metrics marked in all entries


class AggregationParams:
    """Parameters for aggregation conversions."""

    def __init__(
        self,
        filters: List[Condition],
        slices: List[Condition],
        verbose: bool = False,
        prune_mode: PruneMode = PruneMode.NONE,
        categorize_metadata: bool = True,
        absent_metrics_strategy=AggregateAbsentMetricsStrategy.ALL_OR_NOTHING,
        round: bool = True,
        round_precision: int = 2,
    ):
        """Initialize aggregation parameters.

        Args:
        ----
            filters: Filter conditions.
            slices: Slice conditions.
            verbose: Enable verbose logging.
            prune_mode: How to prune metrics.
            categorize_metadata: Enable metadata categorization.
            absent_metrics_strategy: Strategy on how to deal with absent metrics.
            round: Enable value rounding after aggregation.
            round_precision: Number of decimal places for rounding.

        """
        self.filters = filters
        self.slices = slices
        self.verbose = verbose
        self.prune_mode = prune_mode
        self.categorize_metadata = categorize_metadata
        self.absent_metrics_strategy = absent_metrics_strategy
        self.round = round
        self.round_precision = round_precision


def create_aggregation(params: AggregationParams) -> BaseConversion:
    """Create an aggregation conversion chain.

    Args:
    ----
        params: Configuration parameters for aggregation.

    Returns:
    -------
        A BaseConversion that applies the configured aggregation operations.

    """
    conversions: List[BaseConversion] = []

    if params.categorize_metadata:
        conversions.append(CategorizeMetadataConversion())

    if params.filters:
        conversions.append(FilterConversion(params.filters))

    # Sort by timestamp so that the most recent entries have priority in aggregation
    conversions.append(SortByTimestampConversion())

    # Apply aggregation with slice conditions
    conversions.append(AggregateConversion(params.slices, absent_metrics_strategy=params.absent_metrics_strategy))

    # Sort again by new timestamp - should be done in api, but meaningless when dealing with local files
    conversions.append(SortByTimestampConversion(sort_field_name="time_end_utc/max_value"))

    # Apply pruning based on mode
    if params.prune_mode == PruneMode.ALL:
        conversions.append(PruneConversion(verbose=params.verbose, prune_all_entries=True))
    elif params.prune_mode == PruneMode.COLUMN:
        conversions.append(PruneConversion(verbose=params.verbose, prune_all_entries=False))
    # PruneMode.NONE - no pruning conversion added

    if params.round:
        conversions.append(RoundConversion(precision=params.round_precision))

    return ChainConversion(conversions)


def create_column_tree(entries: List[CanonicalMetricsEntry]) -> ColumnNode:
    """Create column tree from all fields in entries."""
    leaves: Dict[str, ColumnNode] = dict()
    leaves_subfields: Dict[str, Dict[str, ColumnNode]] = dict()
    non_subfields: Set[str] = {"value", "category", "prune", "description"}

    def add_leaf(key: str, v: Any) -> None:
        if not leaves.get(key):
            name = key.split("/")[-1]
            description = None
            if isinstance(v, dict):
                description = v.get("description")
            leaves[key] = ColumnNode(column_node_id=key, name=name, description=description)
            leaves_subfields[key] = dict()

        if not isinstance(v, dict):
            return
        for subfield, _v in v.items():
            if (subfield not in non_subfields) and (subfield not in leaves_subfields[key]):
                leaves_subfields[key][subfield] = ColumnNode(column_node_id=f"{key}/{subfield}", name=subfield)

    for entry in entries:
        for k, v in entry.metadata.items():
            if k == "files":
                continue
            add_leaf("/metadata/" + k, v)
        for k, v in entry.metrics.items():
            add_leaf("/metrics/" + k, v)

    for k, leaf_subfields in leaves_subfields.items():
        leaves[k].children = sorted(leaf_subfields.values(), key=lambda node: node.name)

    # Create a stack by reversing a sort (popping from the beginning of the list is slow).
    leaves_list = sorted(leaves.values(), key=lambda node: node.column_node_id, reverse=True)

    def build_tree(root: ColumnNode) -> None:
        while len(leaves_list) > 0 and leaves_list[-1].column_node_id.startswith(root.column_node_id):
            leaf_name = leaves_list[-1].column_node_id[len(root.column_node_id) :]
            if "/" not in leaf_name:
                root.children.append(leaves_list.pop(-1))
                continue
            node_name = leaf_name.split("/")[0]
            node = ColumnNode(column_node_id=f"{root.column_node_id}{node_name}/", name=node_name)
            build_tree(node)
            root.children.append(node)

    root = ColumnNode(column_node_id="/", name="/")
    build_tree(root)
    return root


class GroupsRecommendationStrategy(Enum):
    """Strategies on which groups (or slices) to recommend."""

    # No recommendations.
    NONE = "none"
    # Decouple groups by taking first alphabetical candidate.
    FIRST_ALPHABETICAL = "first_alphabetical"
    # Decouple groups by taking the most concise candidate.
    CONCISE = "concise"


@dataclass
class TableCreationParams:
    """Parameters for table creation."""

    # List of filter conditions
    filters: List[str] = field(default_factory=list)
    # List of slice conditions
    slices: List[str] = field(default_factory=list)
    # Ids of columns or column groups to show
    column_selections: List[str] = field(default_factory=list)
    # Sorted by (column_id, sort_order)
    sort_by: Optional[Tuple[str, SortOrder]] = None
    # How to prune metrics: NONE or COLUMN.
    # Pruning heuristically determines which columns do not contain any useful information and removes them.
    prune_mode: PruneMode = PruneMode.COLUMN
    # Strategy on how to deal with absent metrics.
    absent_metrics_strategy: AggregateAbsentMetricsStrategy = AggregateAbsentMetricsStrategy.ALL_OR_NOTHING
    # Strategy on how to recommend slices.
    slices_recommendation_strategy: GroupsRecommendationStrategy = GroupsRecommendationStrategy.CONCISE


def create_table(
    entries: List[CanonicalMetricsEntry],
    params: TableCreationParams,
    verbose: bool = False,
    column_selections_to_add: Optional[List[str]] = None,
    column_selections_to_remove: Optional[List[str]] = None,
) -> Table:
    """Aggregate `entries` and creates Table."""
    filter_conditions = parse_condition_list(params.filters)
    slice_conditions = parse_condition_list(params.slices)

    preprocess_conversions: List[BaseConversion] = [CategorizeMetadataConversion()]
    if filter_conditions:
        preprocess_conversions.append(FilterConversion(filter_conditions))
    preprocess_conversions.append(SortByTimestampConversion())
    entries = ChainConversion(preprocess_conversions).convert(entries)

    aggregation_params = AggregationParams(
        filters=[],  # already filtered
        slices=slice_conditions,
        categorize_metadata=False,  # already categorized
        verbose=verbose,
        prune_mode=params.prune_mode,
        absent_metrics_strategy=params.absent_metrics_strategy,
    )
    aggr_entries = create_aggregation(aggregation_params).convert(entries)

    column_tree = create_column_tree(aggr_entries)
    column_tree.add_selection(params.column_selections)
    if column_selections_to_add:
        column_tree.add_selection(column_selections_to_add)
    if column_selections_to_remove:
        column_tree.remove_selection(column_selections_to_remove)

    columns = column_tree.get_selection()
    for column in columns:
        column.unit = determine_column_unit(column.name, aggr_entries)

    if params.slices_recommendation_strategy == GroupsRecommendationStrategy.NONE:
        slice_recommendations = []
    else:
        possible_new_slices = determine_possible_new_groups(entries, slice_conditions)
        slice_recommendations = dedupe_groups(possible_new_slices, entries, params.slices_recommendation_strategy)

    headers: List[TableCell] = [TableCell()]
    for column in columns:
        headers.append(
            TableCell(values={"value": column.name}, details={"name": column.name, "description": column.description})
        )
    rows: List[List[TableCell]] = [headers]
    for entry in aggr_entries:
        key = TableCell()
        for k, v in entry.metadata.items():
            if isinstance(v, dict) and v.get("category", "") == MetadataFieldCategory.GROUP.value:
                key.values[k] = v
            key.details[k] = v
        row: List[TableCell] = [key]
        for column in columns:
            column_value = TableCell()
            v = entry.metadata.get(column.name)
            if v is None:
                v = entry.metrics.get(column.name)
            if v is None:
                # subfield
                v = entry.fetch_value(column.name)
            if v is None:
                row.append(column_value)
                continue
            if not isinstance(v, dict):
                column_value.values["value"] = v
                column_value.details["value"] = v
                row.append(column_value)
                continue
            v = v.copy()
            column_value.values["value"] = v.get("value")
            column_value.values["min_value"] = v.get("min_value")
            column_value.values["max_value"] = v.get("max_value")
            v["name"] = column.name
            column_value.details = v
            row.append(column_value)
        rows.append(row)

    table = Table(
        rows=rows,
        column_tree=column_tree,
        columns=columns,
        filters=filter_conditions,
        slices=slice_conditions,
        slice_recommendations=slice_recommendations,
    )
    if params.sort_by:
        try:
            table.sort_rows(params.sort_by[0], params.sort_by[1])
        except Exception:
            pass

    table.remove_subfields(["prune", "category"])
    table.flatten_values()
    return table


def determine_column_unit(key: str, entries: List[CanonicalMetricsEntry]) -> TableColumnUnit:
    for entry in entries:
        metadata_field = entry.metadata.get(key)
        if metadata_field is None:
            # Split by field_name /, remove last part
            if "/" in key:
                splits = key.split("/")
                parent_field = "/".join(splits[:-1])
                subfield = splits[-1]
                parent_data = entry.metadata.get(parent_field)
                if isinstance(parent_data, dict) and subfield in ["min_value", "max_value"]:
                    metadata_field = parent_data
        if (
            isinstance(metadata_field, dict)
            and metadata_field.get("category", "") == MetadataFieldCategory.TIMESTAMP.value
        ):
            return TableColumnUnit.TIMESTAMP
        v = entry.fetch_value(key)
        if v is not None:
            if isinstance(v, (int, float)):
                return TableColumnUnit.NUMERICAL
            else:
                return TableColumnUnit.STRING
    return TableColumnUnit.STRING


def determine_possible_new_groups(entries: List[CanonicalMetricsEntry], groups: List[Condition]) -> List[str]:
    """Return metadata keys for possible new groups."""
    accepted_groups: Set[str] = set()
    rejected_groups: Set[str] = set()
    # [new_group_field, group_values] -> new_group_value
    # If there are multiple new group values, then the candidate can be accepted.
    candidates: Dict[Tuple[str, Tuple[Any]], Any] = dict()
    new_groups: List[str] = []

    for entry in entries:
        group_values = get_slice_values(entry, groups)
        for k, v in entry.metadata.items():
            if k == "files":
                continue
            if not isinstance(v, dict):
                continue
            if v.get("category", "") != MetadataFieldCategory.GROUP.value:
                continue
            if (k in accepted_groups) or (k in rejected_groups):
                continue
            if not groups:
                accepted_groups.add(k)
                new_groups.append(k)
                continue

            appears_in_groups = False
            for group in groups:
                if group.field_name == k:
                    # Even if it has operator other than slice.
                    appears_in_groups = True
                    break
            if appears_in_groups:
                rejected_groups.add(k)
                continue

            new_group_value = v.get("value")
            candidate_value = candidates.get((k, group_values))
            if candidate_value is None:
                candidates[(k, group_values)] = new_group_value
                continue
            if candidate_value == new_group_value:
                continue

            accepted_groups.add(k)
            new_groups.append(k)

    return sorted(new_groups)


def dedupe_groups(
    groups: List[str],
    entries: List[CanonicalMetricsEntry],
    groups_recommendation_strategy: GroupsRecommendationStrategy,
) -> List[str]:
    """Reduce groups to the most promising and deduped ones.

    Assumptions about args:
    1. `groups` are given in alphabetical order.
    2. `entries` are given in chronological order, or otherwise in a format preference order.
    """
    if not groups:
        return []
    assert groups_recommendation_strategy in (
        GroupsRecommendationStrategy.FIRST_ALPHABETICAL,
        GroupsRecommendationStrategy.CONCISE,
    )
    # Assume that `groups` are already in alphabetic order.
    if groups_recommendation_strategy == GroupsRecommendationStrategy.CONCISE:
        # Assume entries are in chronological order. i.e. the order of format preference.
        first_group_value_lengths: Dict[str, int] = dict()
        for entry in entries:
            for group in groups:
                if first_group_value_lengths.get(group) is not None:
                    continue
                v = entry.fetch_value(group)
                if v is not None:
                    first_group_value_lengths[group] = len(str(v))

        def get_sort_key(group: str) -> int:
            """Calculate sort key as a length."""
            # Penalize "_version".
            penalty = 20 if "_version" in group else 0
            return len(group) + penalty + first_group_value_lengths.get(group, 0)

        groups = sorted(groups, key=get_sort_key)

    new_groups: List[str] = [groups[0]]
    new_group_conditions: List[Condition] = [slice_condition(groups[0])]
    for group in groups[1:]:
        # (group values of new_groups) -> new_group_value
        # If there are multiple possible values, then the candidate can be accepted.
        new_group_values: Dict[tuple, Any] = {}
        for entry in entries:
            key = get_slice_values(entry, new_group_conditions)
            v = entry.fetch_value(group)
            if new_group_values.get(key) is None:
                new_group_values[key] = v
                continue
            if new_group_values[key] == v:
                continue
            new_groups.append(group)
            new_group_conditions.append(slice_condition(group))
    return new_groups


@dataclass
class ListLogsCreationParams:
    """Parameters for list logs request."""

    # List of filter conditions
    filters: List[str] = field(default_factory=list)
    # List of group conditions
    groups: List[str] = field(default_factory=list)
    # How to prune metrics: NONE, COLUMN, or ALL.
    # Pruning heuristically determines which metrics do not contain any useful information and removes them.
    prune_mode: PruneMode = PruneMode.ALL
    # Strategy on how to recommend groups.
    groups_recommendation_strategy: GroupsRecommendationStrategy = GroupsRecommendationStrategy.CONCISE
    # Number of decimal places for rounding.
    round_precision: int = 2


def create_logs_list(
    entries: List[CanonicalMetricsEntry],
    params: ListLogsCreationParams,
    verbose: bool = False,
) -> GroupedCanonicalMetricsList:
    """Group `entries` into list of GroupedCanonicalMetricsList."""
    filter_conditions = parse_condition_list(params.filters)
    group_conditions = parse_condition_list(params.groups)

    preprocess_conversions: List[BaseConversion] = [CategorizeMetadataConversion()]
    if filter_conditions:
        preprocess_conversions.append(FilterConversion(filter_conditions))
    preprocess_conversions.append(SortByTimestampConversion())
    entries = ChainConversion(preprocess_conversions).convert(entries)

    groups: Dict[tuple, List[CanonicalMetricsEntry]] = {}
    for entry in entries:
        key = get_slice_values(entry, group_conditions)
        if key not in groups:
            groups[key] = [entry]
        else:
            groups[key].append(entry)

    aggregation_conversions: List[BaseConversion] = [AggregateConversion(slices=[])]
    prune_conversion: Optional[PruneConversion] = None
    # Apply pruning based on mode
    if params.prune_mode == PruneMode.ALL:
        prune_conversion = PruneConversion(verbose=verbose, prune_all_entries=True)
    elif params.prune_mode == PruneMode.COLUMN:
        prune_conversion = PruneConversion(verbose=verbose, prune_all_entries=False)
    if prune_conversion:
        aggregation_conversions.append(prune_conversion)
    aggregation_conversions.append(RoundConversion(precision=params.round_precision))
    aggregation_conversion = ChainConversion(aggregation_conversions)
    grouped_entries: List[GroupedCanonicalMetrics] = []
    for group_entries in groups.values():
        aggr_entries = aggregation_conversion.convert(group_entries)
        assert len(aggr_entries) == 1
        if prune_conversion:
            group_entries = prune_conversion.convert(group_entries)
        grouped_entries.append(GroupedCanonicalMetrics(aggr_entry=aggr_entries[0], entries=group_entries))

    # Sort. Most recent ones first, oldest last.
    def get_sort_key(entry: GroupedCanonicalMetrics):
        timestamp = entry.aggr_entry.fetch_value("time_end_utc/max_value")
        if timestamp:
            return timestamp
        return ""  # Put entries without timestamps at the end (empty string sorts before valid timestamps)

    grouped_entries = sorted(grouped_entries, key=get_sort_key, reverse=True)

    if params.groups_recommendation_strategy == GroupsRecommendationStrategy.NONE:
        group_recommendations = []
    else:
        possible_new_groups = determine_possible_new_groups(entries, group_conditions)
        group_recommendations = dedupe_groups(possible_new_groups, entries, params.groups_recommendation_strategy)

    for grouped_entry in grouped_entries:
        grouped_entry.aggr_entry.remove_subfields(["prune", "category"])
        grouped_entry.aggr_entry.flatten_values()
        for entry in grouped_entry.entries:
            entry.remove_subfields(["prune", "category"])
            entry.flatten_values()

    return GroupedCanonicalMetricsList(groups=grouped_entries, group_recommendations=group_recommendations)


@dataclass
class MovingAggregationParams:
    """Parameters to calculate moving aggregation."""

    # Time granulation in ms
    time_granulation: int
    # A field name (can be subfield) used to calculate moving aggregation values
    moving_aggregation_field_name: str
    # Global filters to apply first
    global_filters: List[str] = field(default_factory=list)
    # List of filter conditions to calculate moving aggregation values
    moving_aggregation_filters: List[str] = field(default_factory=list)
    # Optional slice field
    slice_field: str = ""
    # Number of decimal places for rounding
    round_precision: int = 2


def time_str_to_ms(time_str) -> int:
    # Parse the ISO format datetime string
    dt = datetime.fromisoformat(time_str)
    # Convert to milliseconds since Unix epoch
    time_ms = int(dt.timestamp() * 1000)
    return time_ms


def extract_base_field_name(field_name: str) -> str:
    """Extract base field name by removing subfields like /n_samples, /min_value, /max_value."""
    # Remove subfield suffixes
    subfields = ["/n_samples", "/min_value", "/max_value"]
    base_field = field_name

    for subfield in subfields:
        if base_field.endswith(subfield):
            base_field = base_field[: -len(subfield)]
            break

    return base_field


def create_moving_aggregation(
    entries: List[CanonicalMetricsEntry],
    params: MovingAggregationParams,
    _verbose: bool = False,
) -> MovingAggregation:
    """Create Moving Aggregation."""
    filter_conditions = parse_condition_list(params.global_filters)
    moving_aggregation_filters = parse_condition_list(params.moving_aggregation_filters)

    preprocess_conversions: List[BaseConversion] = []
    if filter_conditions:
        preprocess_conversions.append(FilterConversion(filter_conditions))
    preprocess_conversions.append(SortByTimestampConversion())
    preprocess_conversions.append(CategorizeMetadataConversion())
    entries = ChainConversion(preprocess_conversions).convert(entries)

    no_result = MovingAggregation(
        time_begin=0,
        time_end=0,
        time_granulation=params.time_granulation,
        filters=moving_aggregation_filters,
        field_name=params.moving_aggregation_field_name,
        values=[],
        min_value=0,
        max_value=0,
    )

    if not entries:
        return no_result

    # Determine slice values. Prioritize the ones that appear in the latest entries.
    slice_values_to_index: Dict[str, int] = {}
    if params.slice_field:
        for entry in entries:
            if not check_filters_against_entry(entry, moving_aggregation_filters):
                continue
            slice_value = str(entry.fetch_value(params.slice_field))
            if slice_values_to_index.get(slice_value) is not None:
                continue
            slice_values_to_index[slice_value] = len(slice_values_to_index)
    slice_values_list: List[str] = list(slice_values_to_index.keys())

    def fetch_time(entry: CanonicalMetricsEntry) -> int:
        time_str = entry.fetch_value("time_end_utc")
        assert isinstance(time_str, str)
        return time_str_to_ms(time_str)

    time_end = fetch_time(entries[0])
    time_begin = fetch_time(entries[-1])

    # Time window: (time_window_begin; time_window_end]
    # Includes time_window_end, but does not include time_window_begin
    # In order to include all entries should satisfy this condition:
    # time_end - n * time_granulation < time_begin
    # n > (time_end - time_begin) / time_granulation
    n = int((time_end - time_begin) / params.time_granulation) + 1

    time_begin = time_end - n * params.time_granulation
    values: List[List[float]] = []
    # One list when no slicing, otherwise number of slice values.
    if not slice_values_list:
        values = [[]]
    else:
        for _slice_value in slice_values_list:
            values.append([])

    min_value: Optional[float] = None
    max_value: Optional[float] = None

    def update_min_max_values(value: float):
        nonlocal min_value, max_value
        if min_value is None:
            min_value = value
        else:
            min_value = min(min_value, value)
        if max_value is None:
            max_value = value
        else:
            max_value = max(max_value, value)

    base_field_name = extract_base_field_name(params.moving_aggregation_field_name)
    slices: List[Condition] = []
    if params.slice_field:
        slices = [slice_condition(params.slice_field)]

    # Use entries as a stack, calculating time windows, and popping entries from the end of the list.
    time_window_begin = time_begin
    while time_window_begin < time_end:
        num_populated_windows = len(values[0])
        try:
            window_entries: List[CanonicalMetricsEntry] = []
            while entries:
                entry = entries[-1]
                entry_time = fetch_time(entry)
                if entry_time > time_window_begin + params.time_granulation:
                    break
                entries.pop(-1)
                if not check_filters_against_entry(entry, moving_aggregation_filters):
                    continue

                window_entry = CanonicalMetricsEntry()
                window_entry.metadata[params.slice_field] = entry.metadata.get(params.slice_field)
                metadata_field_value = entry.metadata.get(base_field_name)
                if metadata_field_value:
                    window_entry.metadata[base_field_name] = metadata_field_value
                metrics_field_value = entry.metrics.get(base_field_name)
                if metrics_field_value:
                    window_entry.metrics[base_field_name] = metrics_field_value
                window_entries.append(window_entry)

            window_entries = AggregateConversion(
                slices, absent_metrics_strategy=AggregateAbsentMetricsStrategy.NULLIFY
            ).convert(window_entries)
            for entry in window_entries:
                if not params.slice_field:
                    slice_index = 0
                else:
                    slice_index = slice_values_to_index[str(entry.fetch_value(params.slice_field))]
                value_obj = entry.fetch_value(params.moving_aggregation_field_name)
                if not isinstance(value_obj, (float, int)):
                    value = 0.0
                else:
                    value = float(value_obj)
                    value = round(value, params.round_precision)
                update_min_max_values(value)
                values[slice_index].append(value)
        finally:
            for slice_values in values:
                if len(slice_values) == num_populated_windows:
                    slice_values.append(0.0)
                    update_min_max_values(0.0)
            time_window_begin += params.time_granulation

    return MovingAggregation(
        time_begin=time_begin,
        time_end=time_end,
        time_granulation=params.time_granulation,
        filters=moving_aggregation_filters,
        field_name=params.moving_aggregation_field_name,
        slice_field=params.slice_field,
        slice_values=slice_values_list,
        values=values,
        min_value=min_value if min_value else 0.0,
        max_value=max_value if max_value else 0.0,
    )


@dataclass
class EvaluationTableCreationParams:
    """Parameters for evaluation table creation."""

    # List of filter conditions
    filters: List[str] = field(default_factory=list)
    # Ids of columns or column groups to show
    column_selections: List[str] = field(default_factory=list)
    # Sorted by (column_id, sort_order)
    sort_by: Optional[Tuple[str, SortOrder]] = None


def create_evaluation_table(
    entries: List[CanonicalMetricsEntry],
    params: EvaluationTableCreationParams,
    verbose: bool = False,
    column_selections_to_add: Optional[List[str]] = None,
    column_selections_to_remove: Optional[List[str]] = None,
) -> Table:
    """Converts evaluation `entries` into Table."""
    filter_conditions = parse_condition_list(params.filters)

    preprocess_conversions: List[BaseConversion] = [CategorizeMetadataConversion()]
    if filter_conditions:
        preprocess_conversions.append(FilterConversion(filter_conditions))
    entries = ChainConversion(preprocess_conversions).convert(entries)

    column_tree = create_column_tree(entries)
    column_tree.add_selection(params.column_selections)
    if column_selections_to_add:
        column_tree.add_selection(column_selections_to_add)
    if column_selections_to_remove:
        column_tree.remove_selection(column_selections_to_remove)

    columns = column_tree.get_selection()
    for column in columns:
        column.unit = determine_column_unit(column.name, entries)

    headers: List[TableCell] = [TableCell()]
    for column in columns:
        headers.append(
            TableCell(values={"value": column.name}, details={"name": column.name, "description": column.description})
        )
    rows: List[List[TableCell]] = [headers]
    for entry in entries:
        key = TableCell()
        for k, v in entry.metadata.items():
            if isinstance(v, dict) and v.get("category", "") == MetadataFieldCategory.UNIQUE.value:
                key.values[k] = v
            key.details[k] = v
        row: List[TableCell] = [key]
        for column in columns:
            column_value = TableCell()
            v = entry.metadata.get(column.name)
            if v is None:
                v = entry.metrics.get(column.name)
            if v is None:
                # subfield
                v = entry.fetch_value(column.name)
            if v is None:
                row.append(column_value)
                continue
            if not isinstance(v, dict):
                column_value.values["value"] = v
                column_value.details["value"] = v
                row.append(column_value)
                continue
            v = v.copy()
            column_value.values["value"] = v.get("value")
            v["name"] = column.name
            column_value.details = v
            row.append(column_value)
        rows.append(row)

    table = Table(
        rows=rows,
        column_tree=column_tree,
        columns=columns,
        filters=filter_conditions,
        slices=[],
        slice_recommendations=[],
    )
    if params.sort_by:
        try:
            table.sort_rows(params.sort_by[0], params.sort_by[1])
        except Exception:
            pass

    table.remove_subfields(["prune", "category"])
    table.flatten_values()
    return table
