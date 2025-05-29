"""Main CLI interface using Click."""

import csv
from pathlib import Path

import click

from metrics_cli.conversions.aggregate import AggregateAbsentMetricsStrategy
from metrics_cli.conversions.base import BaseConversion
from metrics_cli.conversions.determine_pruning import DeterminePruningConversion
from metrics_cli.conversions.ms_to_s import MsToSConversion
from metrics_cli.conversions.rename import RenameConversion
from metrics_cli.conversions.round import RoundConversion
from metrics_cli.local_files import load_logs_list_from_disk, save_logs_list_to_disk
from metrics_cli.models.condition import parse_conditions
from metrics_cli.models.table import Table, TableCell
from metrics_cli.transform_utils import (
    AggregationParams,
    MetricsTuneParams,
    PruneMode,
    TableCreationParams,
    create_aggregation,
    create_metrics_tuning,
    create_table,
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
    "--absent-metrics-strategy",
    type=click.Choice(["nullify", "accept_subset", "all_or_nothing"]),
    default="all_or_nothing",
    help="How to deal with absent metrics: nullify (if not recorded means 0), accept_subset (e.g., for new metric), all_or_nothing (safest; includes only if present in all)",  # noqa: E501
)
@click.option(
    "--prune",
    "-p",
    type=click.Choice(["none", "all", "column"]),
    default="none",
    help="Pruning mode: none (no pruning), all (individual), column (global)",
)
@click.pass_context
def aggregate(ctx, from_path: Path, to_path: Path, filters: str, slices: str, absent_metrics_strategy: str, prune: str):
    """Aggregate metrics by grouping and averaging values."""
    verbose = ctx.obj.get("verbose", False)

    # Convert strings to enum
    absent_metrics_strategy_enum = AggregateAbsentMetricsStrategy(absent_metrics_strategy)
    prune_mode_enum = PruneMode(prune)

    # Convert user input to conditions
    filter_conditions = parse_conditions(filters) if filters else []
    slice_conditions = parse_conditions(slices) if slices else []

    params = AggregationParams(
        filters=filter_conditions,
        slices=slice_conditions,
        verbose=verbose,
        prune_mode=prune_mode_enum,
        absent_metrics_strategy=absent_metrics_strategy_enum,
    )

    converter = create_aggregation(params)
    convert(from_path, to_path, converter)


def format_column_name(cell: TableCell) -> str:
    return str(cell.values["name"])


def format_row_name(cell: TableCell) -> str:
    """Format row name from cell values."""
    items = []
    for k, v in cell.values.items():
        if v is not None and v != "":  # Skip empty/None values
            items.append(f"{k}: {v}")
    return "\n".join(items)


def format_cell_values(cell: TableCell) -> str:
    text = ""
    v = cell.values.get("value")
    if v is not None:
        text = str(v)
    min_v = cell.values.get("min_value")
    max_v = cell.values.get("max_value")
    if min_v is not None and max_v is not None:
        range = f"[{min_v}, {max_v}]"
        if not text:
            text = range
        else:
            text = f"{text} {range}"
    return text


def write_table_to_csv(table: Table, file_path: Path) -> None:
    """Write table rows to CSV file using the formatting functions."""
    with open(file_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile, quoting=csv.QUOTE_MINIMAL)

        # Process each row
        for row_idx, row in enumerate(table.rows):
            csv_row = []

            for cell_idx, cell in enumerate(row):
                if row_idx == 0:  # Header row
                    if cell_idx == 0:
                        # First cell in header row (empty corner)
                        csv_row.append("")
                    else:
                        # Column headers
                        csv_row.append(format_column_name(cell))
                else:  # Data rows
                    if cell_idx == 0:
                        # Row name (first column)
                        csv_row.append(format_row_name(cell))
                    else:
                        # Data cells
                        csv_row.append(format_cell_values(cell))

            writer.writerow(csv_row)


@cli.command()
@click.argument("from_path", type=click.Path(exists=True, path_type=Path))
@click.argument("to_path", type=click.Path(path_type=Path))
@click.option("--filters", "-f", type=str, default="", help="Filter conditions (field:operator:values)")
@click.option(
    "--slices", "-s", type=str, default="", help="Slice conditions for grouping (field or field:operator:values)"
)
@click.option(
    "--absent-metrics-strategy",
    type=click.Choice(["nullify", "accept_subset", "all_or_nothing"]),
    default="all_or_nothing",
    help="How to deal with absent metrics: nullify (if not recorded means 0), accept_subset (e.g., for new metric), all_or_nothing (safest; includes only if present in all)",  # noqa: E501
)
@click.option(
    "--prune",
    "-p",
    type=click.Choice(["none", "column"]),
    default="column",
    help="Pruning mode: none (no pruning), column (global)",
)
@click.pass_context
def table(ctx, from_path: Path, to_path: Path, filters: str, slices: str, absent_metrics_strategy: str, prune: str):
    """Create csv table."""
    verbose = ctx.obj.get("verbose", False)

    # Ensure output path has .csv extension
    if not to_path.suffix:
        to_path = to_path.with_suffix(".csv")
    elif to_path.suffix.lower() != ".csv":
        print(f"Warning: Output file has '{to_path.suffix}' extension, expected '.csv'")

    # Convert strings to enum
    absent_metrics_strategy_enum = AggregateAbsentMetricsStrategy(absent_metrics_strategy)
    prune_mode_enum = PruneMode(prune)

    params = TableCreationParams(
        filters=[filters] if filters else [],
        slices=[slices] if slices else [],
        column_selections=["/metadata/time_end_utc/max_value", "/metrics/"],
        prune_mode=prune_mode_enum,
        absent_metrics_strategy=absent_metrics_strategy_enum,
    )
    entries = load_logs_list_from_disk(from_path)
    table = create_table(entries, params, verbose=verbose)

    # Write table to CSV file
    try:
        write_table_to_csv(table, to_path)
        print(f"Table written to: {to_path}")
    except Exception as e:
        print(f"Failed to write CSV: {e}")
        return

    slice_recommendations = table.slice_recommendations
    if not slice_recommendations:
        return
    print("Slice recommendations:")
    for slice in slice_recommendations:
        print(f" - {slice}")


def main():
    """Entry point for the CLI."""
    cli(obj={})


if __name__ == "__main__":
    main()
