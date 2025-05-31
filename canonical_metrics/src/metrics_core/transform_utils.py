"""Utilities to transform data."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from metrics_core.conversions.aggregate import AggregateAbsentMetricsStrategy, AggregateConversion, get_slice_values
from metrics_core.conversions.base import BaseConversion, ChainConversion
from metrics_core.conversions.categorize_metadata import CategorizeMetadataConversion
from metrics_core.conversions.determine_pruning import DeterminePruningConversion
from metrics_core.conversions.filter import FilterConversion
from metrics_core.conversions.ms_to_s import MsToSConversion
from metrics_core.conversions.prune import PruneConversion
from metrics_core.conversions.rename import RenameConversion
from metrics_core.conversions.round import RoundConversion
from metrics_core.conversions.sort_by_timestamp import SortByTimestampConversion
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry, MetadataFieldCategory
from metrics_core.models.column_selection import ColumnNode, TableColumnUnit
from metrics_core.models.condition import Condition, parse_condition_list, slice_condition
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
        while len(leaves_list) > 0 and leaves_list[len(leaves_list) - 1].column_node_id.startswith(root.column_node_id):
            leaf_name = leaves_list[len(leaves_list) - 1].column_node_id[len(root.column_node_id) :]
            if "/" not in leaf_name:
                root.children.append(leaves_list.pop(len(leaves_list) - 1))
                continue
            node_name = leaf_name.split("/")[0]
            node = ColumnNode(column_node_id=f"{root.column_node_id}{node_name}/", name=node_name)
            build_tree(node)
            root.children.append(node)

    root = ColumnNode(column_node_id="/", name="/")
    build_tree(root)
    return root


class SlicesRecommendationStrategy(Enum):
    """Strategies on which slices to recommend."""

    # No recommendations.
    NONE = "none"
    # Decouple slices by taking first alphabetical candidate.
    FIRST_ALPHABETICAL = "first_alphabetical"
    # Decouple slices by taking the most concise candidate.
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
    slices_recommendation_strategy: SlicesRecommendationStrategy = SlicesRecommendationStrategy.CONCISE


def create_table(
    entries: List[CanonicalMetricsEntry],
    params: TableCreationParams,
    verbose: bool = False,
    column_selections_to_add: Optional[List[str]] = None,
    column_selections_to_remove: Optional[List[str]] = None,
) -> Table:
    """Aggregates `entries` and creates Table."""
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

    if params.slices_recommendation_strategy == SlicesRecommendationStrategy.NONE:
        slice_recommendations = []
    else:
        possible_new_slices = determine_possible_new_slices(entries, slice_conditions)
        slice_recommendations = dedupe_slices(possible_new_slices, entries, params.slices_recommendation_strategy)

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


def determine_possible_new_slices(entries: List[CanonicalMetricsEntry], slices: List[Condition]) -> List[str]:
    """Return metadata keys for possible new slices."""
    accepted_slices: Set[str] = set()
    rejected_slices: Set[str] = set()
    # [new_slice_field, slice_values] -> new_slice_value
    # If there are multiple new slice values, then the candidate can be accepted.
    candidates: Dict[Tuple[str, Tuple[Any]], Any] = dict()
    new_slices: List[str] = []

    for entry in entries:
        slice_values = get_slice_values(entry, slices)
        for k, v in entry.metadata.items():
            if k == "files":
                continue
            if not isinstance(v, dict):
                continue
            if v.get("category", "") != MetadataFieldCategory.GROUP.value:
                continue
            if (k in accepted_slices) or (k in rejected_slices):
                continue
            if not slices:
                accepted_slices.add(k)
                new_slices.append(k)
                continue

            appears_in_slices = False
            for slice in slices:
                if slice.field_name == k:
                    # Even if it has operator other than slice.
                    appears_in_slices = True
                    break
            if appears_in_slices:
                rejected_slices.add(k)
                continue

            new_slice_value = v.get("value")
            candidate_value = candidates.get((k, slice_values))
            if candidate_value is None:
                candidates[(k, slice_values)] = new_slice_value
                continue
            if candidate_value == new_slice_value:
                continue

            accepted_slices.add(k)
            new_slices.append(k)

    return sorted(new_slices)


def dedupe_slices(
    slices: List[str],
    entries: List[CanonicalMetricsEntry],
    slices_recommendation_strategy: SlicesRecommendationStrategy,
) -> List[str]:
    """Reduce slices to the most promising and deduped ones.

    Assumptions about args:
    1. `slices` are given in alphabetical order.
    2. `entries` are given in chronological order, or otherwise in a format preference order.
    """
    if not slices:
        return []
    assert slices_recommendation_strategy in (
        SlicesRecommendationStrategy.FIRST_ALPHABETICAL,
        SlicesRecommendationStrategy.CONCISE,
    )
    # Assume that `slices` are already in alphabetic order.
    if slices_recommendation_strategy == SlicesRecommendationStrategy.CONCISE:
        # Assume entries are in chronological order. i.e. the order of format preference.
        first_slice_value_lengths: Dict[str, int] = dict()
        for entry in entries:
            for slice in slices:
                if first_slice_value_lengths.get(slice) is not None:
                    continue
                v = entry.fetch_value(slice)
                if v is not None:
                    first_slice_value_lengths[slice] = len(str(v))

        def get_sort_key(slice: str) -> int:
            """Calculate sort key as a length."""
            # Penalize "_version".
            penalty = 20 if "_version" in slice else 0
            return len(slice) + penalty + first_slice_value_lengths.get(slice, 0)

        slices = sorted(slices, key=get_sort_key)

    new_slices: List[str] = [slices[0]]
    new_slice_conditions: List[Condition] = [slice_condition(slices[0])]
    for slice in slices[1:]:
        # (slice values of new_slices) -> new_slice_value
        # If there are multiple possible values, then the candidate can be accepted.
        new_slice_values: Dict[tuple, Any] = {}
        for entry in entries:
            key = get_slice_values(entry, new_slice_conditions)
            v = entry.fetch_value(slice)
            if new_slice_values.get(key) is None:
                new_slice_values[key] = v
                continue
            if new_slice_values[key] == v:
                continue
            new_slices.append(slice)
            new_slice_conditions.append(slice_condition(slice))
    return new_slices
