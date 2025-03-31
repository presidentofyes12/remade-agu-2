import { retryMechanism } from '../retryMechanism';
import { ethers } from 'ethers';

jest.useFakeTimers();

describe('RetryMechanism', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await retryMechanism.executeWithRetry(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on network error', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockResolvedValueOnce('success');

      const resultPromise = retryMechanism.executeWithRetry(operation);
      
      // Fast forward past the delay
      jest.advanceTimersByTime(1000);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max attempts', async () => {
      const error = new Error('NETWORK_ERROR');
      const operation = jest.fn().mockRejectedValue(error);

      const resultPromise = retryMechanism.executeWithRetry(operation);
      
      // Fast forward past all delays
      jest.advanceTimersByTime(1000 + 2000 + 4000);
      
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable error', async () => {
      const error = new Error('INVALID_INPUT');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await retryMechanism.executeWithRetry(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect custom retry configuration', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
        .mockResolvedValueOnce('success');

      const customConfig = {
        maxAttempts: 5,
        baseDelay: 500,
        maxDelay: 5000,
        backoffFactor: 1.5,
        retryableErrors: ['NETWORK_ERROR']
      };

      const resultPromise = retryMechanism.executeWithRetry(operation, customConfig);
      
      // Fast forward past the delay
      jest.advanceTimersByTime(500);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should handle ethers-specific errors', async () => {
      const ethersError = new Error('NONCE_EXPIRED');
      (ethersError as any).code = 'NONCE_EXPIRED';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(ethersError)
        .mockResolvedValueOnce('success');

      const resultPromise = retryMechanism.executeWithRetry(operation);
      
      // Fast forward past the delay
      jest.advanceTimersByTime(1000);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
}); 