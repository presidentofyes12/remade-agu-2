import { retryMechanism } from './retryMechanism';

/**
 * Helper function to execute an operation with retry and handle the result consistently
 * @param operation The operation to execute
 * @param config Optional retry configuration
 * @returns The result of the operation
 * @throws Error if the operation fails
 */
export async function executeWithRetryAndHandle<T>(
  operation: () => Promise<T>,
  config: Parameters<typeof retryMechanism.executeWithRetry>[1] = {}
): Promise<T> {
  try {
    const { result } = await retryMechanism.executeWithRetry(operation, config);
    return result;
  } catch (error) {
    // The error is already properly formatted by the retry mechanism
    throw error;
  }
} 