from typing import Any, Dict, List, Set

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.models.canonical_metrics_entry import CanonicalMetricsEntry, MetadataFieldCategory, fetch_value
from metrics_cli.models.condition import Condition, ConditionOperator


class AggregateConversion(BaseConversion):  # noqa: F821
    """Aggregate entries."""

    def __init__(self, slices: List[Condition], nullify_absent_metrics=False):  # noqa: D107
        super().__init__()
        self.description = "Aggregate"
        self.slices = slices
        self.nullify_absent_metrics = nullify_absent_metrics

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
            new_entry = self._aggregate(key, entries)
            new_entry.metadata = dict(sorted(new_entry.metadata.items()))
            new_entry.metrics = dict(sorted(new_entry.metrics.items()))
            aggregated_entries.append(new_entry)

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
        metrics = self._aggregate_metrics(metrics_list)

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

    def _aggregate_metadata(self, data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        metadata: Dict[str, Any] = {}

        # Get all unique field names across all metadata entries
        all_fields: Set[str] = set()
        for data in data_list:
            all_fields.update(data.keys())

        for field_name in all_fields:
            if field_name == "files":
                continue

            # Check if all entries have the same value for this field
            first_value = data_list[0].get(field_name)
            same_in_all = True
            for data in data_list[1:]:
                if data.get(field_name) != first_value:
                    same_in_all = False
                    break
            if same_in_all:
                # If all values are the same, just store the value
                metadata[field_name] = first_value
                continue

            # Check if this field has category information and is UNIQUE or TIMESTAMP
            field_data = first_value
            if not isinstance(field_data, dict):
                continue
            field_category = field_data.get("category")
            field_value = field_data.get("value")
            if field_category == MetadataFieldCategory.TIMESTAMP.value or (
                field_category == MetadataFieldCategory.UNIQUE.value and isinstance(field_value, (int, float))
            ):
                aggregated_field = self._aggregate_metadata_field(field_name, data_list)
                if aggregated_field is not None:
                    metadata[field_name] = aggregated_field

        return metadata

    def _aggregate_metadata_field(self, field_name: str, data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate a metadata field by calculating min, max, and n_samples for numeric values."""
        field_info = data_list[0].get(field_name)
        assert isinstance(field_info, dict)
        field_info = field_info.copy()
        v = field_info.pop("value")
        min_value = v
        max_value = v
        n_samples = 0

        for data in data_list:
            v = fetch_value(data, field_name)
            if not v:
                continue
            n_samples += 1
            min_value = min(min_value, v)
            max_value = max(max_value, v)

        field_info["min_value"] = min_value
        field_info["max_value"] = max_value
        field_info["n_samples"] = n_samples
        return field_info

    def _aggregate_metrics(self, data_list: List[Dict[str, Dict[str, Any]]]) -> Dict[str, Dict[str, Any]]:
        metrics: Dict[str, Any] = {}
        n = len(data_list)
        for key, aggr_metric in data_list[0].items():
            v = aggr_metric.get("value")
            if not isinstance(v, (float, int)):
                continue
            num_value_present_in_all = True
            prune_in_all = True
            total = 0.0
            min_value = v
            max_value = v
            for data in data_list:
                metric = data.get(key, {})
                v = metric.get("value")
                if not isinstance(v, (float, int)):
                    if v is None and self.nullify_absent_metrics:
                        print(f"WARNING: Setting absent metric {key} = 0")
                        v = 0
                    else:
                        num_value_present_in_all = False
                        break
                total += v
                min_value = min(min_value, v)
                max_value = max(max_value, v)
                if prune_in_all and not metric.get("prune", False):
                    prune_in_all = False
            if not num_value_present_in_all:
                print(f"WARNING: Skipping metric {key} because it's not present in all grouped entries")
                continue

            # Create a copy of the first metric as the base for aggregated metric
            aggr_metric = data_list[0][key].copy()
            aggr_metric["value"] = total / n
            aggr_metric["min_value"] = min_value
            aggr_metric["max_value"] = max_value
            aggr_metric["n_samples"] = n
            if not prune_in_all:
                aggr_metric.pop("prune", None)
            metrics[key] = aggr_metric
        return metrics
