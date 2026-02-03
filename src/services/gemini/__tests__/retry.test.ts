import { isRetryableError, getRetryDelayMs } from '../retry';

describe('gemini retry', () => {
  describe('isRetryableError', () => {
    it('returns true for 503, 429, 500', () => {
      expect(isRetryableError({ status: 503 })).toBe(true);
      expect(isRetryableError({ status: 429 })).toBe(true);
      expect(isRetryableError({ status: 500 })).toBe(true);
    });

    it('returns true for statusText Service Unavailable', () => {
      expect(isRetryableError({ statusText: 'Service Unavailable' })).toBe(true);
    });

    it('returns true when message contains overloaded or rate limit', () => {
      expect(isRetryableError({ message: 'Service overloaded' })).toBe(true);
      expect(isRetryableError({ message: 'rate limit exceeded' })).toBe(true);
    });

    it('returns false for null/undefined', () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });

    it('returns false for other errors', () => {
      expect(isRetryableError({ status: 404 })).toBe(false);
      expect(isRetryableError({ message: 'Not found' })).toBe(false);
    });
  });

  describe('getRetryDelayMs', () => {
    it('returns increasing delay for decreasing attemptsLeft', () => {
      expect(getRetryDelayMs(3)).toBe(8000);
      expect(getRetryDelayMs(2)).toBe(16000);
      expect(getRetryDelayMs(1)).toBe(30000); // cap at 30s
    });

    it('uses formula 2^(6-attemptsLeft) * 1000, capped at 30000', () => {
      expect(getRetryDelayMs(6)).toBe(1000);
      expect(getRetryDelayMs(4)).toBe(4000);
      expect(getRetryDelayMs(0)).toBe(30000);
    });
  });
});
