"""Main CLI interface using Click."""

from pathlib import Path
from typing import List

import click

from metrics_cli.conversions.aggregate import AggregateConversion
from metrics_cli.conversions.base import BaseConversion, ChainConversion
from metrics_cli.conversions.determine_pruning import DeterminePruningConversion
from metrics_cli.conversions.filter import FilterConversion
from metrics_cli.conversions.ms_to_s import MsToSConversion
from metrics_cli.conversions.prune import PruneConversion
from metrics_cli.conversions.rename import RenameConversion
from metrics_cli.conversions.round import RoundConversion
from metrics_cli.conversions.sort_by_timestamp import SortByTimestampConversion
from metrics_cli.local_files import load_logs_list_from_disk, save_logs_list_to_disk
from metrics_cli.models.condition import parse_conditions


@click.group()
@click.version_option()
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
@click.pass_context
def cli(ctx, verbose):
    """Metrics CLI - Process metrics logs."""
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose


def convert(from_path: Path, to_path: Path, converter: BaseConversion):
    entries = load_logs_list_from_disk(from_path)
    entries = converter.convert(entries)
    save_logs_list_to_disk(from_path, to_path, entries)


@cli.command()
@click.argument("from_path", type=click.Path(exists=True, path_type=Path))
@click.argument("to_path", type=click.Path(path_type=Path))
@click.pass_context
def rename(ctx, from_path: Path, to_path: Path):
    """Heuristic renaming of fields for better sorting and dashboards alignment."""
    verbose = ctx.obj.get("verbose", False)
    convert(from_path, to_path, RenameConversion(verbose=verbose))


@cli.command()
@click.argument("from_path", type=click.Path(exists=True, path_type=Path))
@click.argument("to_path", type=click.Path(path_type=Path))
@click.pass_context
def ms_to_s(ctx, from_path: Path, to_path: Path):
    """Convert millisecond fields to seconds."""
    verbose = ctx.obj.get("verbose", False)
    convert(from_path, to_path, MsToSConversion(verbose=verbose))


@cli.command()
@click.argument("from_path", type=click.Path(exists=True, path_type=Path))
@click.argument("to_path", type=click.Path(path_type=Path))
@click.option("--precision", "-p", type=int, default=2, help="Decimal places to round to")
def round(from_path: Path, to_path: Path, precision: int):
    """Round numeric values to specified precision."""
    convert(from_path, to_path, RoundConversion(precision=precision))


@cli.command()
@click.argument("from_path", type=click.Path(exists=True, path_type=Path))
@click.argument("to_path", type=click.Path(path_type=Path))
def determine_pruning(from_path: Path, to_path: Path):
    """Heuristics to determine pruning of metrics."""
    convert(from_path, to_path, DeterminePruningConversion())


@cli.command()
@click.argument("from_path", type=click.Path(exists=True, path_type=Path))
@click.argument("to_path", type=click.Path(path_type=Path))
@click.option("--filters", "-f", type=str, default="", help="Filters")
@click.option("--slices", "-s", type=str, default="", help="Slices")
@click.option(
    "--nullify_absent_metrics", "-n", type=bool, default=False, help="Treat absent metrics as 0, otherwise skip metric."
)
@click.option("--prune", "-p", type=bool, default=False, help="Prune metrics marked for pruning.")
@click.pass_context
def aggregate(
    ctx, from_path: Path, to_path: Path, filters: str, slices: str, nullify_absent_metrics: bool, prune: bool
):
    """Aggregate metrics."""
    verbose = ctx.obj.get("verbose", False)

    # Convert user input to conditions
    filter_conditions = parse_conditions(filters) if filters else []
    slice_conditions = parse_conditions(slices) if slices else []

    conversions: List[BaseConversion] = []
    if filter_conditions:
        conversions.append(FilterConversion(filter_conditions))
    conversions.append(SortByTimestampConversion())
    conversions.append(AggregateConversion(slice_conditions, nullify_absent_metrics=nullify_absent_metrics))
    conversions.append(SortByTimestampConversion(sort_field_name="time_end_utc_max"))
    if prune:
        conversions.append(PruneConversion(verbose=verbose))

    convert(from_path, to_path, ChainConversion(conversions))


def main():
    """Entry point for the CLI."""
    cli(obj={})


if __name__ == "__main__":
    main()
