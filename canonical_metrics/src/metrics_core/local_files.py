"""Utilities to work with local files."""

import csv
import json
import shutil
from pathlib import Path
from typing import Any, Dict, List

from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.models.table import Table, TableCell


def load_canonical_metrics_from_disk(logs_entry_path: Path) -> CanonicalMetricsEntry:
    """Load metrics.json file from `logs_entry_path`."""
    name = logs_entry_path.name
    metrics_json = logs_entry_path / "metrics.json"
    with open(metrics_json, "r", encoding="utf-8") as f:
        data: Dict[str, Any] = json.load(f)
        return CanonicalMetricsEntry(name=name, metadata=data.get("metadata", {}), metrics=data.get("metrics", {}))


def save_canonical_metrics_to_disk(original_path: Path, new_path: Path, metrics: CanonicalMetricsEntry):
    """Save metrics data to `metrics.json` and copy log files from `original_path` to `new_path`."""
    new_path.mkdir(parents=True, exist_ok=True)
    metrics_json = new_path / "metrics.json"
    with open(metrics_json, "w", encoding="utf-8") as f:
        json.dump(metrics.to_dict(), f, indent=2, ensure_ascii=False)
        f.write("\n")
    if original_path == new_path:
        return
    files: List[Dict[str, Any]] = metrics.metadata.get("files", [])
    for file in files:
        filename = file.get("filename", "")
        if not filename:
            print("Error: no 'filename' field in file value.")
            continue
        file_path = original_path / filename
        if not file_path.exists():
            print(f"Error: file {file_path} not exists.")
            continue
        dest_file = new_path / filename
        shutil.copy2(file_path, dest_file)


def load_logs_list_from_disk(logs_dir: Path) -> List[CanonicalMetricsEntry]:
    """Load all metric entries from subdirectories of logs_dir.

    Each subdirectory should contain a metrics.json file.
    Returns a list of CanonicalMetricsEntry objects.
    """
    result: List[CanonicalMetricsEntry] = []

    # Ensure logs_dir exists
    if not logs_dir.exists() or not logs_dir.is_dir():
        print(f"Error: logs directory {logs_dir} does not exist or is not a directory.")
        return result

    # Iterate through all subdirectories
    for entry_path in logs_dir.iterdir():
        if not entry_path.is_dir():
            continue

        # Check if this directory has a metrics.json file
        metrics_json = entry_path / "metrics.json"
        if not metrics_json.exists():
            print(f"Warning: no metrics.json found in {entry_path}")
            continue

        try:
            entry = load_canonical_metrics_from_disk(entry_path)
            result.append(entry)
        except Exception as e:
            print(f"Error loading metrics from {entry_path}: {e}")

    return result


def save_logs_list_to_disk(original_logs_dir: Path, new_logs_dir: Path, logs: List[CanonicalMetricsEntry]):
    """Save multiple CanonicalMetricsEntry objects to disk.

    For each entry in logs:
    - Creates a subdirectory in new_logs_dir named after the entry's name
    - Saves the entry's metrics.json to this subdirectory
    - Copies associated files from original_logs_dir/entry_name to new_logs_dir/entry_name
    """
    # Ensure new_logs_dir exists
    new_logs_dir.mkdir(parents=True, exist_ok=True)

    for entry in logs:
        # Create paths for original and new directories
        original_entry_path = original_logs_dir / entry.name
        new_entry_path = new_logs_dir / entry.name

        # Save this entry
        try:
            save_canonical_metrics_to_disk(original_entry_path, new_entry_path, entry)
        except Exception as e:
            print(f"Error saving metrics for {entry.name}: {e}")


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
        for row in table.rows:
            csv_row = []

            for cell_idx, cell in enumerate(row):
                if cell_idx == 0:
                    # Row name (first column)
                    csv_row.append(format_row_name(cell))
                else:
                    # Data cells
                    csv_row.append(format_cell_values(cell))

            writer.writerow(csv_row)
