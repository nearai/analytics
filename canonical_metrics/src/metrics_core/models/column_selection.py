from dataclasses import dataclass, field
from enum import Enum
from functools import cached_property
from typing import List, Optional


class TableColumnUnit(Enum):
    """Unit of a table column."""

    TIMESTAMP = "timestamp"
    NUMERICAL = "numerical"
    STRING = "string"


@dataclass
class TableColumn:
    """Column definition for the table."""

    column_id: str  # Column id, e.g. "/metrics/api_calls/env_init/count"
    name: str  # Display name such as "api_calls/env_init/count"
    description: Optional[str] = None
    unit: Optional[TableColumnUnit] = None

    def to_dict(self):  # noqa: D102
        return {
            "column_id": self.column_id,
            "name": self.name,
            "description": self.description,
            "unit": self.unit.value if self.unit else None,
        }


class SelectionState(Enum):
    """State of column selection in the tree."""

    # All columns in this category selected. Subfields such as `min_value` or `max_value` should be added explicitly.
    ALL = "all"
    # No columns in this category selected.
    NONE = "none"
    # Some columns selected (mixed state).
    PARTIAL = "partial"


@dataclass
class ColumnNode:
    """Represents a node in the column tree."""

    # Sorted ids, like "/metrics/api_calls/", "/metadata/time_end_utc", or "/metadata/time_end_utc/max_value"
    column_node_id: str
    # Leaf/node name such as "api_calls/"
    name: str
    selection_state: SelectionState = SelectionState.NONE
    children: List["ColumnNode"] = field(default_factory=list)
    description: Optional[str] = None

    def to_dict(self):  # noqa: D102
        return {
            "column_node_id": self.column_node_id,
            "name": self.name,
            "selection_state": self.selection_state.value,
            "children": [child.to_dict() for child in self.children],
            "description": self.description,
        }

    @cached_property
    def is_leaf(self) -> bool:  # noqa: D102
        return not self.column_node_id.endswith("/")

    def find_node_by_id(self, node_id: str) -> Optional["ColumnNode"]:
        """Find a node by its ID."""
        if self.column_node_id == node_id:
            return self

        if len(self.children) == 0:
            return None

        candidate = None
        for child in self.children:
            if child.column_node_id == node_id:
                return child
            elif child.column_node_id < node_id:
                candidate = child
            else:
                break
        if candidate:
            return candidate.find_node_by_id(node_id)
        return None

    def _update_selection_state(self) -> None:
        """Update selection state based on children's states."""
        if not self.children:
            # No children, keep current state
            return
        if self.is_leaf and self.selection_state == SelectionState.ALL:
            # For leaf nodes with ALL state, keep ALL regardless of subfield states
            return

        # Collect states to consider
        states = [child.selection_state for child in self.children]
        # For leaf nodes, also consider their own state along with children
        if self.is_leaf:
            states.append(self.selection_state)

        if all(state == SelectionState.ALL for state in states):
            self.selection_state = SelectionState.ALL
        elif all(state == SelectionState.NONE for state in states):
            self.selection_state = SelectionState.NONE
        else:
            self.selection_state = SelectionState.PARTIAL

    def _propagate_selection_states(self) -> None:
        """Propagate selection states from leaves up to root."""
        # First, recursively update all children
        for child in self.children:
            child._propagate_selection_states()

        # Then update this node's state based on children
        self._update_selection_state()

    def add_selection(self, column_node_ids: List[str]) -> None:
        """Add selection.

        Args:
        ----
            column_node_ids: column node ids to add

        """
        for node_id in column_node_ids:
            node = self.find_node_by_id(node_id)
            if node:
                node._select()

        # Update parent states from bottom up
        self._propagate_selection_states()

    def remove_selection(self, column_node_ids: List[str]) -> None:
        """Remove selection.

        Args:
        ----
            column_node_ids: column node ids to remove

        """
        for node_id in column_node_ids:
            node = self.find_node_by_id(node_id)
            if node:
                node._deselect()

        # Update parent states from bottom up
        self._propagate_selection_states()

    def _select(self) -> None:
        """Select this node and propagate selection from up to bottom."""
        if self.selection_state == SelectionState.ALL:
            return
        self.selection_state = SelectionState.ALL
        if self.is_leaf:
            # Do not propagate to subfields.
            return
        for child in self.children:
            child._select()

    def _deselect(self) -> None:
        """Deselect this node and propagate selection from up to bottom."""
        if self.selection_state == SelectionState.NONE:
            return
        self.selection_state = SelectionState.NONE
        # As opposed to _select, propagate to subfields as well.
        for child in self.children:
            child._deselect()

    def get_selection(self) -> List[TableColumn]:
        """Return partially filled list of selected table columns.

        Populates `column_id`, `name`, and `description`.
        Does not populate `unit`.
        """
        selected_columns = []

        def collect_selected_leaves(node: ColumnNode) -> None:
            if node.selection_state == SelectionState.NONE:
                return
            if node.is_leaf and node.selection_state == SelectionState.ALL:
                display_name = node.column_node_id
                # Remove "/metadata/" or "/metrics/" prefix
                metadata_prefix = "/metadata/"
                metrics_prefix = "/metrics/"
                if display_name.startswith(metadata_prefix):
                    display_name = display_name[len(metadata_prefix) :]
                elif display_name.startswith(metrics_prefix):
                    display_name = display_name[len(metrics_prefix) :]

                column = TableColumn(
                    column_id=node.column_node_id,
                    name=display_name,
                    description=node.description,
                    unit=None,
                )
                selected_columns.append(column)

            # Recursively check children
            for child in node.children:
                collect_selected_leaves(child)

        collect_selected_leaves(self)

        return selected_columns
