from typing import Any, Dict, List, Optional, Set

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.models.canonical_metrics_entry import CanonicalMetricsEntry, fetch_value
from metrics_cli.models.condition import Condition, ConditionOperator


class AggregateConversion(BaseConversion):  # noqa: F821
    """Aggregate entries."""

    def __init__(self, slices: List[Condition], max_fields: Optional[Set[str]] = None):  # noqa: D107
        super().__init__()
        if max_fields is None:
            max_fields = set()
        max_fields.add("time_end_utc")
        max_fields.add("time_end_local")
        self.description = "Aggregate"
        self.slices = slices
        self.max_fields = max_fields

    def convert(self, data: List[CanonicalMetricsEntry]) -> List[CanonicalMetricsEntry]:
        """Aggregate entries grouping around `this.slices`.

        Args:
        ----
            data: sorted entries

        Returns:
        -------
            unsorted grouped entries

        """
        groups: Dict[tuple, List[CanonicalMetricsEntry]] = {}

        for entry in data:
            key_values: List[Any] = []

            for slice_condition in self.slices:
                v = entry.fetch_value(slice_condition.field_name)
                if slice_condition.operator != ConditionOperator.SLICE:
                    v = slice_condition.check(entry)
                key_values.append(v)

            key = tuple(key_values)

            if key not in groups:
                groups[key] = [entry]
            else:
                groups[key].append(entry)

        aggregated_entries: List[CanonicalMetricsEntry] = []
        for key, entries in groups.items():
            aggregated_entries.append(self._aggregate(key, entries))

        return aggregated_entries

    def _aggregate(self, key: tuple, data: List[CanonicalMetricsEntry]) -> CanonicalMetricsEntry:  # noqa: D102
        name = self._create_new_entry_name(key)
        print(f"New aggregated group name: {name}")

        metadata_list: List[Dict[str, Any]] = []
        metrics_list: List[Dict[str, Any]] = []
        for entry in data:
            metadata_list.append(entry.metadata)
            metrics_list.append(entry.metrics)

        metadata = self._aggregate_metadata(metadata_list)
        metadata = self._add_max_fields(metadata, metadata_list)
        metrics = self._aggregate_metrics(metrics_list)
        metrics = self._add_max_fields(metrics, metrics_list)

        return CanonicalMetricsEntry(name, metadata, metrics)

    def _create_new_entry_name(self, key: tuple) -> str:
        # Generate a name out of self.slices and key.
        # Key contains values for slice conditions and True/False for conditionals.
        # This name will be used to create a new folder in logs directory.
        name_parts = []

        for i, slice_condition in enumerate(self.slices):
            key_value = key[i]
            if slice_condition.operator == ConditionOperator.SLICE:
                field_name = slice_condition.field_name
                value_str = "none" if (key_value is None) else str(key_value)
                name_part = f"{field_name}_{value_str}"
            else:
                name_part = "" if key_value else "not_"
                name_part += str(slice_condition)
            name_part = name_part.replace("/", "_").replace(":", "_").replace(" ", "_")
            name_parts.append(f"{field_name}_{value_str}")

        return "_".join(name_parts) if name_parts else "aggregated"

    def _add_max_fields(self, result_data: Dict[str, Any], data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        for max_field in self.max_fields:
            v = fetch_value(data_list[0], max_field)
            new_field = f"{max_field}_max"
            if not v:
                # Only add it if it's present in the first entry.
                continue
            for entry in data_list[1:]:
                another_value = fetch_value(entry, max_field)
                if another_value:
                    # Calculate max - handle both string and numeric comparisons
                    try:
                        if isinstance(v, str) and isinstance(another_value, str):
                            # For timestamps and string values, use lexicographic comparison
                            v = max(v, another_value)
                        elif isinstance(v, (int, float)) and isinstance(another_value, (int, float)):
                            # For numeric values
                            v = max(v, another_value)
                        else:
                            # For mixed types, convert to string and compare
                            v = max(str(v), str(another_value))
                    except (TypeError, ValueError):
                        print(f"Error: comparisons fail for {new_field}: {v} against {another_value}")
                        # If comparison fails, keep the first value
                        pass
            result_data[new_field] = v
        return result_data

    def _aggregate_metadata(self, data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        metadata: Dict[str, Any] = {}
        for key, value in data_list[0].items():
            same = True
            for data in data_list[1:]:
                if data.get(key) != value:
                    same = False
                    break
            if same:
                metadata[key] = value
        return metadata

    def _aggregate_metrics(self, data_list: List[Dict[str, Dict[str, Any]]]) -> Dict[str, Dict[str, Any]]:
        metrics: Dict[str, Any] = {}
        n = len(data_list)
        for key, aggr_metric in data_list[0].items():
            num_value_present_in_all = True
            prune_in_all = True
            total = 0.0
            for data in data_list:
                metric = data.get(key, {})
                v = metric.get("value")
                if not isinstance(v, (float, int)):
                    num_value_present_in_all = False
                    break
                total += v
                if prune_in_all and not metric.get("prune", False):
                    prune_in_all = False
            if not num_value_present_in_all:
                print(f"WARNING: Skipping metric {key} because it's not present in all grouped entries")
                continue

            # Create a copy of the first metric as the base for aggregated metric
            aggr_metric = data_list[0][key].copy()
            aggr_metric["value"] = total / n
            if not prune_in_all:
                aggr_metric.pop("prune", None)
            metrics[key] = aggr_metric
        return metrics
