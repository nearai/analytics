"""Evaluation table creation and utilities."""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from metrics_core.conversions.base import BaseConversion, ChainConversion
from metrics_core.conversions.categorize_metadata import CategorizeMetadataConversion
from metrics_core.conversions.filter import FilterConversion
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry, MetadataFieldCategory
from metrics_core.models.column_selection import create_column_tree, determine_column_unit
from metrics_core.models.condition import parse_condition_list
from metrics_core.models.table import SortOrder, Table, TableCell


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