#!/usr/bin/env node
/**
 * Demo script to show how the dynamic time field determination works.
 * This simulates the frontend logic without requiring a running backend.
 */

const mockImportantMetrics = {
  scenario1: {
    "Agent Invocations": [[], "time_end_utc/n_samples"],
    "Instances": [[], "instance_updated_at/n_samples"],
    "Avg Agent Latency": [[], "performance/latency/init_and_env_run_s_all"]
  },
  scenario2: {
    "Instances": [[], "instance_updated_at/n_samples"],
    "Avg Agent Latency": [[], "performance/latency/init_and_env_run_s_all"]
  },
  scenario3: {
    "Avg Agent Latency": [[], "performance/latency/init_and_env_run_s_all"],
    "Max Agent Latency": [[], "performance/latency/init_and_env_run_s_all/max_value"]
  },
  scenario4: {}
};

function determineTimeField(importantMetrics) {
  // Priority logic:
  // 1. If "Agent Invocations" is available, use "time_end_utc"
  if (importantMetrics['Agent Invocations']) {
    return 'time_end_utc';
  }
  
  // 2. If "Instances" is available, use "instance_updated_at"
  if (importantMetrics['Instances']) {
    return 'instance_updated_at';
  }
  
  // 3. Otherwise, fallback to "time_end_utc"
  return 'time_end_utc';
}

function createTimeFilter(timePeriod, timeField) {
  const now = new Date();
  const hours = parseTimePeriodToHours(timePeriod);
  
  if (hours !== null) {
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const isoString = cutoff.toISOString().replace(/\.\d{3}Z$/, '');
    return `${timeField}:range:(${isoString}):`;
  }
  
  return '';
}

function parseTimePeriodToHours(period) {
  const normalized = period.toLowerCase().trim();
  
  if (normalized.includes('hour')) {
    const match = normalized.match(/(\d+)\s*hour/);
    if (match) return parseInt(match[1]);
    if (normalized.endsWith('hour')) return 1;
  }
  
  if (normalized.includes('day')) {
    const match = normalized.match(/(\d+)\s*day/);
    if (match) return parseInt(match[1]) * 24;
    if (normalized.endsWith('day')) return 24;
  }
  
  if (normalized.includes('week')) {
    const match = normalized.match(/(\d+)\s*week/);
    if (match) return parseInt(match[1]) * 168;
    if (normalized.endsWith('week')) return 168;
  }
  
  return null;
}

console.log('🔍 Dynamic Time Field Determination Demo\n');

Object.entries(mockImportantMetrics).forEach(([scenarioName, metrics]) => {
  console.log(`📊 ${scenarioName.toUpperCase()}:`);
  console.log(`Available metrics: ${Object.keys(metrics).join(', ') || 'None'}`);
  
  const timeField = determineTimeField(metrics);
  console.log(`Determined time field: ${timeField}`);
  
  const exampleFilter = createTimeFilter('1 day', timeField);
  console.log(`Example time filter: ${exampleFilter}`);
  console.log('');
});

console.log('✅ All scenarios demonstrate the correct time field selection logic:');
console.log('   1. Agent Invocations available → time_end_utc');
console.log('   2. Only Instances available → instance_updated_at');  
console.log('   3. Neither available → time_end_utc (fallback)');
console.log('   4. No metrics → time_end_utc (fallback)');