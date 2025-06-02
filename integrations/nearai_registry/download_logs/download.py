import argparse
import json
from pathlib import Path
import shutil
from nearai.registry import Registry
from nearai.openapi_client import EntryInformation


def convert_nearai_logs_to_canonical(
    entry_info: EntryInformation, from_path: Path, to_path: Path
):
    """Convert nearai logs to canonical format"""

    # Create output directory
    to_path.mkdir(parents=True, exist_ok=True)

    # Load metrics.json
    metrics_file = from_path / "metrics.json"
    if not metrics_file.exists():
        print(f"Error: metrics.json not found in {from_path}")
        return

    with open(metrics_file, "r") as f:
        data = json.load(f)

    # Process metadata
    metadata = data.get("metadata", {})

    # Remove "model" if empty
    if not metadata.get("model"):
        metadata.pop("model", None)

    # Set "model_provider": "fireworks" if empty
    if not metadata.get("model_provider"):
        metadata["model_provider"] = "fireworks"

    # Remove "model_temperature" if empty or null
    if not metadata.get("model_temperature"):
        metadata.pop("model_temperature", None)

    # Remove "model_max_tokens" if empty or null
    if not metadata.get("model_max_tokens"):
        metadata.pop("model_max_tokens", None)

    # Remove "local" field
    local = metadata.pop("local", None)

    # Determine runner
    if local:
        metadata["runner"] = "local"
    elif metadata.get("framework"):
        metadata["runner"] = metadata.get("framework")
    else:
        metadata["runner"] = "minimal"

    # Set framework
    metadata["framework"] = "nearai"

    # Rename "agent_namespace" -> "author"
    if "agent_namespace" in metadata:
        metadata["author"] = metadata.pop("agent_namespace")

    # Add "user" as entry_info.namespace
    metadata["user"] = entry_info.namespace

    # Copy other files and build files array
    files_list = []
    for file_path in from_path.iterdir():
        if file_path.name == "metrics.json":
            continue  # Skip metrics.json
        if file_path.name == "metadata.json":
            continue  # Ignore metadata.json

        if file_path.is_file():
            # Copy file to destination
            dest_file = to_path / file_path.name
            shutil.copy2(file_path, dest_file)

            # Add to files list
            description = ""
            if file_path.name == "system_log.txt":
                description = "System output log"
            elif file_path.name == "agent_log.txt":
                description = "Agent output log"
            elif file_path.name == "chat_history_log.txt":
                description = "Chat history log"
            else:
                description = f"Log file: {file_path.name}"

            files_list.append({"filename": file_path.name, "description": description})

    # Add files array to metadata
    if files_list:
        metadata["files"] = files_list

    # Sort metadata
    metadata = dict(sorted(metadata.items()))

    # Process metrics - sort them
    metrics = data.get("metrics", {})
    metrics = dict(sorted(metrics.items()))

    # Create final output
    output_data = {"metadata": metadata, "metrics": metrics}

    # Write metrics.json
    output_file = to_path / "metrics.json"
    with open(output_file, "w") as f:
        json.dump(output_data, f, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Download and convert nearai registry logs"
    )
    parser.add_argument(
        "--namespaces",
        type=str,
        default="",
        help="Comma-separated list of namespaces to filter",
    )
    parser.add_argument(
        "--limit", type=int, default=200, help="Maximum number of entries to download"
    )

    args = parser.parse_args()

    registry = Registry()

    limit = args.limit
    namespaces_str = args.namespaces
    namespaces_list = (
        [ns.strip() for ns in namespaces_str.split(",") if ns.strip()]
        if namespaces_str
        else []
    )

    # If only one namespace is given, use it in the registry query
    namespace_filter = namespaces_list[0] if len(namespaces_list) == 1 else ""

    entries = registry.list(
        namespace=namespace_filter,
        category="logs",
        tags="",
        total=limit,
        offset=0,
        show_all=False,
        show_latest_version=True,
    )

    if len(entries) >= limit:
        print(
            f"There are more than {limit} logs entries. Downloading {limit} most recent ones.."
        )

    # Filter entries by namespaces if multiple namespaces are given
    if len(namespaces_list) > 1:
        entries = [entry for entry in entries if entry.namespace in namespaces_list]

    # Create logs directory
    logs_dir = Path("~/.nearai/logs")
    logs_dir.mkdir(exist_ok=True)

    for entry in entries:
        entry_name = f"{entry.namespace}/{entry.name}/{entry.version}"
        print(f"Downloading {entry_name} ..")

        try:
            nearai_logs = registry.download(
                entry_location=entry_name,
                force=False,
                show_progress=False,
                verbose=False,
            )

            canonical_logs = logs_dir / entry.name

            convert_nearai_logs_to_canonical(
                entry_info=entry, from_path=nearai_logs, to_path=canonical_logs
            )

        except Exception as e:
            print(f"Error processing {entry_name}: {e}")
            continue


if __name__ == "__main__":
    main()
