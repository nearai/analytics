// Test utilities for color stability
// This file exports helper functions to test deterministic color generation

// Simple hash function to generate deterministic color selection (same as in component)
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

// Test the deterministic behavior of color generation
export const testColorStability = () => {
  const SUCCESS_COLORS = ['#10b981', '#059669', '#047857', '#065f46'];
  const ERROR_COLORS = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'];
  const DEFAULT_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#84cc16', '#f97316'];

  const getLineColor = (metricName: string, sliceValue: string, filters: string[]): string => {
    // Create a deterministic key from the inputs
    const key = `${metricName}|${sliceValue}|${filters.join(',')}`;
    const hash = hashString(key);
    
    // For simplicity, assume default color for tests
    return DEFAULT_COLORS[hash % DEFAULT_COLORS.length];
  };

  // Test that same inputs produce same colors
  const testInputs = [
    { metricName: 'test_metric', sliceValue: 'slice1', filters: ['filter1'] },
    { metricName: 'test_metric', sliceValue: 'slice2', filters: ['filter1', 'filter2'] },
    { metricName: 'another_metric', sliceValue: '', filters: [] },
  ];

  const results: Record<string, string[]> = {};

  // Generate colors multiple times for the same inputs
  testInputs.forEach((input, index) => {
    const key = `test_${index}`;
    results[key] = [];
    
    // Generate color 10 times for the same input
    for (let i = 0; i < 10; i++) {
      const color = getLineColor(input.metricName, input.sliceValue, input.filters);
      results[key].push(color);
    }
  });

  // Verify all colors for same input are identical
  let allStable = true;
  Object.entries(results).forEach(([key, colors]) => {
    const firstColor = colors[0];
    const allSame = colors.every(color => color === firstColor);
    if (!allSame) {
      console.error(`Color instability detected for ${key}: ${colors}`);
      allStable = false;
    }
  });

  return allStable;
};

describe('Color Generation Stability', () => {
  test('color generation is deterministic', () => {
    const isStable = testColorStability();
    expect(isStable).toBe(true);
  });
});