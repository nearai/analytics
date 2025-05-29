from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from metrics_cli.models.column_selection import ColumnNode, TableColumn
from metrics_cli.models.condition import Condition


class SortOrder(Enum):
    """Sort order for table columns."""

    ASC = "asc"
    DESC = "desc"


def flatten_values(fields: Dict[str, Any]) -> Dict[str, Any]:
    """If a field value only contains "value" field, flatten field value to the value of "value" field."""
    contracted_fields = {}

    for field_name, field_data in fields.items():
        if isinstance(field_data, dict):
            # Check if this dict only contains a "value" key
            if len(field_data) == 1 and "value" in field_data:
                # Contract: replace the dict with just the value
                contracted_fields[field_name] = field_data["value"]
            else:
                # Keep the original structure
                contracted_fields[field_name] = field_data
        else:
            # Not a dict, keep as-is
            contracted_fields[field_name] = field_data

    return contracted_fields


def remove_subfields(fields: Dict[str, Any], subfields_to_remove: List[str]) -> None:
    """Remove `subfields_to_remove` from `fields`."""
    for field_data in fields.values():
        if isinstance(field_data, dict):
            for subfield in subfields_to_remove:
                field_data.pop(subfield, None)


@dataclass
class TableCell:
    """Represents a single cell in a table with values and details."""

    values: Dict[str, Any] = field(default_factory=dict)
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self):  # noqa: D102
        return {"values": self.values, "details": self.details}

    def flatten_values(self) -> None:
        """Flatten values of cell fields.

        If a field value of `values` or `details` only contains "value" field,
        flatten field value to the value of "value" field.
        """
        self.values = flatten_values(self.values)
        self.details = flatten_values(self.details)

    def remove_subfields(self, subfields_to_remove: List[str]) -> None:
        """Remove `subfields_to_remove` from `self.values` and `self.details`."""
        remove_subfields(self.values, subfields_to_remove)
        remove_subfields(self.details, subfields_to_remove)


@dataclass
class Table:
    """Represents a table with filters, slices, selections, and data rows."""

    # List of selected table rows, where rows[0] contains column headers
    rows: List[List[TableCell]]
    # Column tree structure of all available columns
    column_tree: ColumnNode
    # Selected columns
    columns: List[TableColumn] = field(default_factory=list)
    # List of filter conditions
    filters: List[Condition] = field(default_factory=list)
    # List of slice conditions
    slices: List[Condition] = field(default_factory=list)
    # List of recommended slice field names
    slice_recommendations: List[str] = field(default_factory=list)
    # Sorted by (column_id, sort_order)
    sorted_by: Optional[Tuple[str, SortOrder]] = None

    def to_dict(self):
        """Convert table to dictionary representation."""
        sorted_by_dict = None
        if self.sorted_by is not None:
            sorted_by_dict = {"column_id": self.sorted_by[0], "sort_order": self.sorted_by[1].value}
        return {
            "rows": [[cell.to_dict() for cell in row] for row in self.rows],
            "column_tree": self.column_tree.to_dict(),
            "columns": [c.to_dict() for c in self.columns],
            "filters": [str(f) for f in self.filters],
            "slices": [str(s) for s in self.slices],
            "slice_recommendations": self.slice_recommendations,
            "sorted_by": sorted_by_dict,
        }

    def flatten_values(self) -> None:
        """Flatten values of cell fields.

        If a field value of `values` or `details` only contains "value" field,
        flatten field value to the value of "value" field.
        """
        for row in self.rows:
            for cell in row:
                cell.flatten_values()

    def remove_subfields(self, subfields_to_remove: List[str]) -> None:
        """Remove `subfields_to_remove` from `values` and `details` of each cell."""
        for row in self.rows:
            for cell in row:
                cell.remove_subfields(subfields_to_remove)

    def get_table_values(self) -> List[List[Dict[str, Any]]]:
        """Return `values` of each cell. Includes headers and row names."""
        table_values: List[List[Dict[str, Any]]] = []
        for row in self.rows:
            row_values: List[Dict[str, Any]] = []
            for cell in row:
                row_values.append(cell.values)
            table_values.append(row_values)
        return table_values

    def sort_rows(self, column_id: str, sort_order: SortOrder) -> None:
        """Sort table rows by the specified column.

        Args:
        ----
            column_id: The ID of the column to sort by
            sort_order: The sort order (ASC or DESC)

        """
        # Find the column index for the given node_id
        column_index = None
        for i, col in enumerate(self.columns):
            if col.column_id == column_id:
                column_index = i
                break

        if column_index is None:
            raise ValueError(f"Column with column_id {column_id} not found")

        # Account for row names
        column_index = column_index + 1

        # Don't sort the header row
        header_rows = 1

        if len(self.rows) <= header_rows:
            return  # Nothing to sort

        # Extract sortable rows
        data_rows = self.rows[header_rows:]

        # Sort by the specified column
        def get_sort_key(row: List[TableCell]) -> tuple:
            """Extract sort key with type-aware sorting."""
            type_multiplier = -1 if sort_order == SortOrder.DESC else 1
            if column_index >= len(row):
                return (3 * type_multiplier, "")  # Priority 3 for missing values

            cell = row[column_index]
            value = None
            if "value" in cell.values:
                value = cell.values["value"]
            elif "max_value" in cell.values:
                value = cell.values["max_value"]
            else:
                value = str(cell.values)

            if value is None:
                return (3 * type_multiplier, "")  # Priority 3 for None values
            elif isinstance(value, (int, float)):
                return (0, value)  # Priority 0 for numbers (sorted first)
            elif isinstance(value, str):
                return (1 * type_multiplier, value)  # Priority 1 for strings
            else:
                return (2 * type_multiplier, str(value))  # Priority 2 for other types

        # Sort the data rows
        sorted_data = sorted(data_rows, key=get_sort_key, reverse=(sort_order == SortOrder.DESC))

        # Reconstruct the rows with header(s) + sorted data
        self.rows = self.rows[:header_rows] + sorted_data
        self.sorted_by = (column_id, sort_order)
