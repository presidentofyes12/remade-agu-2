import { errorHandler, ErrorContext } from '../utils/errorHandler';

/**
 * Dedicated error handler for the AdminTokenDistributionService
 * Provides proper error formatting and handling for the service
 */
export function handleAdminTokenError(message: string, error: unknown): void {
  // Create a properly formatted error object
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  // Create a properly typed error context matching the expected interface
  const errorContext: ErrorContext = {
    operation: 'AdminTokenDistribution',
    timestamp: Date.now(),
    additionalInfo: {
      source: 'AdminTokenDistributionService',
      details: message,
      originalError: errorObj
    }
  };
  
  // Call the error handler with the properly formatted context
  errorHandler.handleError(errorObj, errorContext);
} 