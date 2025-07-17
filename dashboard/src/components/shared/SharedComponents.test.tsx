import { determineTimeField, getDynamicTimeFilter } from './SharedComponents';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Dynamic Time Field Support', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  describe('determineTimeField', () => {
    it('should return time_end_utc when Agent Invocations is available', async () => {
      const mockResponse = {
        'Agent Invocations': [[], 'time_end_utc/n_samples'],
        'Instances': [[], 'instance_updated_at/n_samples']
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await determineTimeField('http://localhost:8000');
      expect(result).toBe('time_end_utc');
    });

    it('should return instance_updated_at when only Instances is available', async () => {
      const mockResponse = {
        'Instances': [[], 'instance_updated_at/n_samples']
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await determineTimeField('http://localhost:8000');
      expect(result).toBe('instance_updated_at');
    });

    it('should fallback to time_end_utc when no specific metrics are available', async () => {
      const mockResponse = {
        'Some Other Metric': [[], 'other_field/n_samples']
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await determineTimeField('http://localhost:8000');
      expect(result).toBe('time_end_utc');
    });

    it('should fallback to time_end_utc on error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await determineTimeField('http://localhost:8000');
      expect(result).toBe('time_end_utc');
    });
  });

  describe('getDynamicTimeFilter', () => {
    it('should create filter with time_end_utc when Agent Invocations is available', async () => {
      const mockResponse = {
        'Agent Invocations': [[], 'time_end_utc/n_samples']
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await getDynamicTimeFilter('1 day', 'http://localhost:8000');
      expect(result).toMatch(/^time_end_utc:range:\(.+\):$/);
    });

    it('should create filter with instance_updated_at when only Instances is available', async () => {
      const mockResponse = {
        'Instances': [[], 'instance_updated_at/n_samples']
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await getDynamicTimeFilter('1 day', 'http://localhost:8000');
      expect(result).toMatch(/^instance_updated_at:range:\(.+\):$/);
    });

    it('should return empty string for invalid time periods', async () => {
      const result = await getDynamicTimeFilter('invalid period', 'http://localhost:8000');
      expect(result).toBe('');
    });
  });
});