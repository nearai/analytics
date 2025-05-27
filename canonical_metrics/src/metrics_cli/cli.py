"""Main CLI interface using Click."""

from pathlib import Path

import click

from metrics_cli.conversions.base import BaseConversion
from metrics_cli.conversions.determine_pruning import DeterminePruningConversion
from metrics_cli.conversions.ms_to_s import MsToSConversion
from metrics_cli.conversions.rename import RenameConversion
from metrics_cli.conversions.round import RoundConversion
from metrics_cli.local_files import load_logs_list_from_disk, save_logs_list_to_disk
from metrics_cli.transform_utils import (
    AggregationParams,
    MetricsTuneParams,
    PruneMode,
    create_aggregation,
    create_metrics_tuning,
)


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
@click.option("--rename", "-r", is_flag=True, default=False, help="Enable metric renaming")
@click.option("--ms-to-s", "-m", is_flag=True, default=False, help="Convert milliseconds to seconds")
@click.option("--round/--no-round", default=True, help="Enable/disable value rounding")
@click.option("--round-precision", "-p", type=int, default=2, help="Number of decimal places for rounding")
@click.option(
    "--determine-pruning/--no-determine-pruning", default=True, help="Enable/disable assignment of prune fields"
)
@click.pass_context
def tune(
    ctx,
    from_path: Path,
    to_path: Path,
    rename: bool,
    ms_to_s: bool,
    round: bool,
    round_precision: int,
    determine_pruning: bool,
):
    """Apply common metrics tuning operations (rename, convert units, round, determine pruning)."""
    verbose = ctx.obj.get("verbose", False)

    params = MetricsTuneParams(
        verbose=verbose,
        rename=rename,
        ms_to_s=ms_to_s,
        round=round,
        round_precision=round_precision,
        determine_pruning=determine_pruning,
    )

    converter = create_metrics_tuning(params)
    convert(from_path, to_path, converter)


@cli.command()
@click.argument("from_path", type=click.Path(exists=True, path_type=Path))
@click.argument("to_path", type=click.Path(path_type=Path))
@click.option("--filters", "-f", type=str, default="", help="Filter conditions (field:operator:values)")
@click.option(
    "--slices", "-s", type=str, default="", help="Slice conditions for grouping (field or field:operator:values)"
)
@click.option(
    "--nullify-absent-metrics/--no-nullify-absent-metrics",
    default=False,
    help="Treat absent metrics as 0, otherwise skip metric",
)
@click.option(
    "--prune",
    "-p",
    type=click.Choice(["none", "all", "column"]),
    default="none",
    help="Pruning mode: none (no pruning), all (individual), column (global)",
)
@click.pass_context
def aggregate(ctx, from_path: Path, to_path: Path, filters: str, slices: str, nullify_absent_metrics: bool, prune: str):
    """Aggregate metrics by grouping and averaging values."""
    verbose = ctx.obj.get("verbose", False)

    # Convert string to enum
    prune_mode_enum = PruneMode(prune)

    params = AggregationParams(
        verbose=verbose,
        prune_mode=prune_mode_enum,
        filters=filters,
        slices=slices,
        nullify_absent_metrics=nullify_absent_metrics,
    )

    converter = create_aggregation(params)
    convert(from_path, to_path, converter)


def main():
    """Entry point for the CLI."""
    cli(obj={})


if __name__ == "__main__":
    main()
