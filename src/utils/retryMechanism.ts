import { errorHandler } from './errorHandler';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  shouldRetry?: (error: unknown) => boolean;
}

export interface RetryContext {
  attempt: number;
  lastError?: unknown;
  totalDelay: number;
}

export class RetryMechanism {
  private static instance: RetryMechanism;
  private defaultConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    shouldRetry: (error: unknown) => {
      // Don't retry on user rejection or network errors
      return !errorHandler.isUserRejectedError(error) && !errorHandler.isNetworkError(error);
    }
  };

  private constructor() {}

  public static getInstance(): RetryMechanism {
    if (!RetryMechanism.instance) {
      RetryMechanism.instance = new RetryMechanism();
    }
    return RetryMechanism.instance;
  }

  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<{ result: T }> {
    const result = await this.withRetry(operation, config);
    return { result };
  }

  public async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = this.mergeConfig(config);
    const context: RetryContext = {
      attempt: 0,
      totalDelay: 0
    };

    while (context.attempt < finalConfig.maxAttempts) {
      try {
        context.attempt++;
        return await operation();
      } catch (error) {
        context.lastError = error;
        
        if (context.attempt === finalConfig.maxAttempts || 
            (finalConfig.shouldRetry && !finalConfig.shouldRetry(error))) {
          throw this.createRetryError(error, context);
        }

        const delay = this.calculateDelay(context.attempt, finalConfig);
        context.totalDelay += delay;
        await this.delay(delay);
      }
    }

    throw new Error('Retry mechanism failed to execute operation');
  }

  private mergeConfig(config: Partial<RetryConfig>): RetryConfig {
    return {
      ...this.defaultConfig,
      ...config
    };
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.initialDelay * Math.pow(config.backoffFactor, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  private createRetryError(error: unknown, context: RetryContext): Error {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const retryError = new Error(`Operation failed after ${context.attempt} attempts: ${message}`);
    retryError.cause = error;
    return retryError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const retryMechanism = RetryMechanism.getInstance(); 