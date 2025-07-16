"""Utilities to process agent hosting analytics data."""

import sys
from typing import Any, Dict, List

import requests

from metrics_core.conversions.sort_by_timestamp import SortByTimestampConversion
from metrics_core.models.canonical_metrics_entry import CanonicalMetricsEntry
from metrics_core.service_models.agent_hosting_models import AgentHostingAnalytics


def fetch_agent_hosting_analytics_data(agent_hosting_url: str, api_key: str, verbose: bool = False) -> Dict[str, Any]:
    """Fetch analytics data from the API."""
    headers = {"accept": "application/json", "Authorization": f"Bearer {api_key}"}

    url = agent_hosting_url + "/analytics/"

    if verbose:
        print(f"Fetching data from: {url}")

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        sys.exit(1)


def _process_env_vars_list(env_vars: List[Dict[str, Any]]) -> Dict[str, Any]:
    env_vars_dict: Dict[str, Any] = {}
    for var in env_vars:
        env_vars_dict[var["key"]] = var["value"]
    return env_vars_dict


def _process_env_vars(header: str, env_vars: Dict[str, any], verbose: bool) -> Dict[str, Any]:
    if isinstance(env_vars, list):
        env_vars = _process_env_vars_list(env_vars)
    lines: List[str] = []
    extracted_data: Dict[str, Any] = {}
    conflict = "CONFLICT"
    for key, value in env_vars.items():
        display_value = str(value)[:50] + "..." if len(str(value)) > 50 else str(value)
        if not display_value:
            continue
        key_lower = key.lower()
        if "key" in key_lower or "secret" in key_lower:
            continue

        if "model" in key_lower or "provider" in key_lower:
            lines.append(f"  {key}: {display_value}")
        else:
            continue

        # Determine priority: if both "model" and "provider" are present, prioritize the last word
        if "model" in key_lower and "provider" in key_lower:
            # Find positions of both words
            model_pos = key_lower.rfind("model")
            provider_pos = key_lower.rfind("provider")

            if provider_pos > model_pos:
                extract_key = "provider"
            else:
                extract_key = "model"
        elif "provider" in key_lower:
            extract_key = "provider"
        elif "model" in key_lower:
            extract_key = "model"
        else:
            continue

        # Check for conflicts
        if extract_key in extracted_data:
            if extracted_data[extract_key] != display_value:
                extracted_data[extract_key] = conflict
        else:
            extracted_data[extract_key] = display_value

    if not lines:
        return {}

    if verbose:
        print(header)
        print("env_vars:")
        for line in lines:
            print(line)

    # Remove conflict key-values from extracted_data
    extracted_data = {k: v for k, v in extracted_data.items() if v != conflict}
    return extracted_data


def _create_analytics_entry(
    organization: Dict[str, Any],
    agent: Dict[str, Any],
    build: Dict[str, Any],
    instance: Dict[str, Any],
    user_id: str,
    data_from_build_env_vars: Dict[str, Any],
    verbose: bool = False,
) -> CanonicalMetricsEntry:
    """Create a single analytics entry from the provided data."""
    # Extract metadata
    metadata = {
        "owner_organization": organization["name"],
        "agent_id": agent["id"],
        "agent_name": agent["name"],
        "agent_description": agent["description"],
        "agent_github_repo": agent["github_repo"],
        "agent_created_at": agent["created_at"],
        "agent_updated_at": agent["updated_at"],
        "agent_build_id": build["id"],
        "agent_build_url": build["build_url"],
        "agent_build_created_at": build["created_at"],
        "agent_build_updated_at": build["updated_at"],
        "agent_github_branch": build["github_branch"],
        "user_id": user_id,
        "instance_id": instance["id"],
        "cpu_limit": instance["cpu_limit"],
        "memory_limit": instance["memory_limit"],
        "cpu": instance["cpu"],
        "memory": instance["memory"],
        "instance_created_at": instance["created_at"],
        "instance_updated_at": instance["updated_at"],
        "user_org_id": instance["org_id"],
    }

    # Add deactivation date if present
    if instance.get("deactivation_date"):
        metadata["instance_deactivation_date"] = instance["deactivation_date"]

    data_from_instance_env_vars = _process_env_vars(
        f"\n--- Analytics Entry for {agent['name']}, instance {instance['id']} ---", instance["env_vars"], verbose
    )

    for key, value in data_from_build_env_vars.items():
        metadata[key] = value
    for key, value in data_from_instance_env_vars.items():
        metadata[key] = value

    # Create analytics entry
    entry = CanonicalMetricsEntry(name=instance["id"], metadata=dict(sorted(metadata.items())), metrics={})

    return entry


def process_agent_hosting_analytics_data(
    agent_hosting_analytics_data: Dict[str, Any], verbose: bool = False
) -> AgentHostingAnalytics:
    """Transform the raw agent hosting analytics data into structured analytics model."""
    entries = []

    data = agent_hosting_analytics_data

    # Process agent_developer_entries
    for dev_entry in data.get("agent_developer_entries", []):
        organization = dev_entry["organization"]
        agents = dev_entry["agents"]
        builds = dev_entry["builds"]

        # Create lookup for builds by agent_id
        builds_by_agent = {}
        for build in builds:
            agent_id = build["agent_id"]
            if agent_id not in builds_by_agent:
                builds_by_agent[agent_id] = []
            builds_by_agent[agent_id].append(build)

        # Process each agent
        for agent in agents:
            agent_builds = builds_by_agent.get(agent["id"], [])

            # For each build of this agent
            for build in agent_builds:
                data_from_build_env_vars = _process_env_vars(
                    f"\n--- Analytics Entry for {agent['name']}, build {build['id']} ---",
                    build.get("env_vars"),
                    verbose,
                )
                # Find instances using this build
                build_instances = _find_instances_for_build(data, build["id"])

                # Create analytics entry for each instance
                for instance, user_id in build_instances:
                    entry = _create_analytics_entry(
                        organization, agent, build, instance, user_id, data_from_build_env_vars, verbose
                    )
                    entries.append(entry)

    # Show logs if verbose
    if verbose:
        print("\n--- LOGS ---")
        for user_entry in data.get("user_entries", []):
            if user_entry.get("logs"):
                print(f"\nUser {user_entry['user_id']} logs:")
                for log in user_entry["logs"]:
                    print(f"  [{log['level'].upper()}] {log['event_code']}: {log['message']}")
                    print(f"    Time: {log['created_at']}")
                    if log.get("metadata"):
                        print(f"    Metadata: {log['metadata']}")

    entries = SortByTimestampConversion(sort_field_name="instance_updated_at").convert(entries)

    return AgentHostingAnalytics(entries=entries)


def _find_instances_for_build(data: Dict[str, Any], build_id: str) -> List[tuple]:
    """Find all instances that use a specific build."""
    instances = []

    for user_entry in data.get("user_entries", []):
        user_id = user_entry["user_id"]
        for instance in user_entry.get("instances", []):
            if instance["build_id"] == build_id:
                instances.append((instance, user_id))

    return instances
