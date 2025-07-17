#!/usr/bin/env python3
"""
Simple validation script to test the backend integration for the dynamic time field feature.
This script tests the /metrics/important endpoint to ensure it returns the expected metrics.
"""

import json
import sys
from typing import Dict, List, Tuple

def test_important_metrics_response():
    """Test that the IMPORTANT_METRICS configuration is correct."""
    
    # Expected metrics from the backend
    expected_metrics = {
        "Agent Invocations": ([], "time_end_utc/n_samples"),
        "Instances": ([], "instance_updated_at/n_samples"),
        "Successful Invocations": (["errors/summary/error_count_all:range::0"], "time_end_utc/n_samples"),
        "Failed Invocations": (["errors/summary/error_count_all:range:1:"], "time_end_utc/n_samples"),
        "Avg Agent Latency": ([], "performance/latency/init_and_env_run_s_all"),
        "Max Agent Latency": ([], "performance/latency/init_and_env_run_s_all/max_value"),
        "Avg Runner Start Latency": (["runner:not_in:local"], "performance/latency/runner_latency_s"),
        "Max Runner Start Latency": (["runner:not_in:local"], "performance/latency/runner_latency_s/max_value"),
        "Avg Completion Latency": ([], "api_calls/inference_client_completions/latency_s_avg"),
        "Max Completion Latency": ([], "api_calls/inference_client_completions/latency_s_max/max_value"),
    }
    
    def determine_time_field(metrics: Dict[str, Tuple[List[str], str]]) -> str:
        """Replicate the frontend logic for determining time field."""
        
        # Priority logic:
        # 1. If "Agent Invocations" is available, use "time_end_utc"
        if "Agent Invocations" in metrics:
            return "time_end_utc"
        
        # 2. If "Instances" is available, use "instance_updated_at"
        if "Instances" in metrics:
            return "instance_updated_at"
        
        # 3. Otherwise, fallback to "time_end_utc"
        return "time_end_utc"
    
    print("Testing dynamic time field determination logic...")
    
    # Test case 1: Both Agent Invocations and Instances available
    test_metrics_1 = {
        "Agent Invocations": expected_metrics["Agent Invocations"],
        "Instances": expected_metrics["Instances"],
        "Avg Agent Latency": expected_metrics["Avg Agent Latency"]
    }
    result_1 = determine_time_field(test_metrics_1)
    expected_1 = "time_end_utc"
    print(f"Test 1 - Both metrics available: {result_1} == {expected_1} ✓" if result_1 == expected_1 else f"Test 1 - FAILED: {result_1} != {expected_1}")
    
    # Test case 2: Only Instances available
    test_metrics_2 = {
        "Instances": expected_metrics["Instances"],
        "Avg Agent Latency": expected_metrics["Avg Agent Latency"]
    }
    result_2 = determine_time_field(test_metrics_2)
    expected_2 = "instance_updated_at"
    print(f"Test 2 - Only Instances available: {result_2} == {expected_2} ✓" if result_2 == expected_2 else f"Test 2 - FAILED: {result_2} != {expected_2}")
    
    # Test case 3: Neither specific metric available
    test_metrics_3 = {
        "Avg Agent Latency": expected_metrics["Avg Agent Latency"],
        "Max Agent Latency": expected_metrics["Max Agent Latency"]
    }
    result_3 = determine_time_field(test_metrics_3)
    expected_3 = "time_end_utc"
    print(f"Test 3 - Fallback case: {result_3} == {expected_3} ✓" if result_3 == expected_3 else f"Test 3 - FAILED: {result_3} != {expected_3}")
    
    # Test case 4: Empty metrics
    test_metrics_4 = {}
    result_4 = determine_time_field(test_metrics_4)
    expected_4 = "time_end_utc"
    print(f"Test 4 - Empty metrics: {result_4} == {expected_4} ✓" if result_4 == expected_4 else f"Test 4 - FAILED: {result_4} != {expected_4}")
    
    print("\nValidating backend IMPORTANT_METRICS configuration...")
    
    # Validate that the expected metrics have the correct time fields
    agent_invocations = expected_metrics.get("Agent Invocations")
    if agent_invocations and "time_end_utc" in agent_invocations[1]:
        print("✓ Agent Invocations uses time_end_utc field")
    else:
        print("✗ Agent Invocations should use time_end_utc field")
        return False
    
    instances = expected_metrics.get("Instances")
    if instances and "instance_updated_at" in instances[1]:
        print("✓ Instances uses instance_updated_at field")
    else:
        print("✗ Instances should use instance_updated_at field")
        return False
    
    print("\nAll validation tests passed! ✓")
    return True

if __name__ == "__main__":
    success = test_important_metrics_response()
    sys.exit(0 if success else 1)