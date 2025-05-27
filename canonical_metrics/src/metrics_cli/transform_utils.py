"""Utilities to transform data."""

from enum import Enum
from typing import List

from metrics_cli.conversions.aggregate import AggregateConversion
from metrics_cli.conversions.base import BaseConversion, ChainConversion
from metrics_cli.conversions.categorize_metadata import CategorizeMetadataConversion
from metrics_cli.conversions.determine_pruning import DeterminePruningConversion
from metrics_cli.conversions.filter import FilterConversion
from metrics_cli.conversions.ms_to_s import MsToSConversion
from metrics_cli.conversions.prune import PruneConversion
from metrics_cli.conversions.rename import RenameConversion
from metrics_cli.conversions.round import RoundConversion
from metrics_cli.conversions.sort_by_timestamp import SortByTimestampConversion
from metrics_cli.models.condition import parse_conditions


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
        verbose: bool = False,
        prune_mode: PruneMode = PruneMode.NONE,
        categorize_metadata: bool = True,
        filters: str = "",
        slices: str = "",
        nullify_absent_metrics: bool = False,
    ):
        """Initialize aggregation parameters.

        Args:
        ----
            verbose: Enable verbose logging.
            prune_mode: How to prune metrics.
            categorize_metadata: Enable metadata categorization.
            filters: Filter conditions string.
            slices: Slice conditions string.
            nullify_absent_metrics: Handle absent metrics in aggregation by setting them to 0.

        """
        self.verbose = verbose
        self.prune_mode = prune_mode
        self.categorize_metadata = categorize_metadata
        self.filters = filters
        self.slices = slices
        self.nullify_absent_metrics = nullify_absent_metrics


def create_aggregation(params: AggregationParams) -> BaseConversion:
    """Create an aggregation conversion chain.

    Args:
    ----
        params: Configuration parameters for aggregation.

    Returns:
    -------
        A BaseConversion that applies the configured aggregation operations.

    """
    # Convert user input to conditions
    filter_conditions = parse_conditions(params.filters) if params.filters else []
    slice_conditions = parse_conditions(params.slices) if params.slices else []

    conversions: List[BaseConversion] = []

    if params.categorize_metadata:
        conversions.append(CategorizeMetadataConversion())

    if filter_conditions:
        conversions.append(FilterConversion(filter_conditions))

    # Sort by timestamp so that the most recent entries have priority in aggregation
    conversions.append(SortByTimestampConversion())

    # Apply aggregation with slice conditions
    conversions.append(AggregateConversion(slice_conditions, nullify_absent_metrics=params.nullify_absent_metrics))

    # Sort again by new timestamp - should be done in api, but meaningless when dealing with local files
    conversions.append(SortByTimestampConversion(sort_field_name="time_end_utc/max_value"))

    # Apply pruning based on mode
    if params.prune_mode == PruneMode.ALL:
        conversions.append(PruneConversion(verbose=params.verbose, prune_all_entries=True))
    elif params.prune_mode == PruneMode.COLUMN:
        conversions.append(PruneConversion(verbose=params.verbose, prune_all_entries=False))
    # PruneMode.NONE - no pruning conversion added

    return ChainConversion(conversions)
