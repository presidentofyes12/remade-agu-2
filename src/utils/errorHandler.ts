import { WalletError } from '../services/wallet/WalletConnector';

export interface ErrorWithCode extends Error {
  code?: number;
  data?: any;
}

export interface ErrorContext {
  operation: string;
  timestamp: number;
  additionalInfo?: Record<string, any>;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: Set<(error: ErrorWithCode, context: ErrorContext) => void> = new Set();

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleError(error: unknown, context: ErrorContext): ErrorWithCode {
    const normalizedError = this.normalizeError(error);
    const errorWithContext = this.addContext(normalizedError, context);
    
    // Log the error
    console.error(`Error in ${context.operation}:`, errorWithContext);
    
    // Notify listeners
    this.notifyListeners(errorWithContext, context);
    
    return errorWithContext;
  }

  public addErrorListener(listener: (error: ErrorWithCode, context: ErrorContext) => void): void {
    this.errorListeners.add(listener);
  }

  public removeErrorListener(listener: (error: ErrorWithCode, context: ErrorContext) => void): void {
    this.errorListeners.delete(listener);
  }

  private normalizeError(error: unknown): ErrorWithCode {
    if (error instanceof Error) {
      return error as ErrorWithCode;
    }

    if (typeof error === 'string') {
      return new Error(error) as ErrorWithCode;
    }

    if (error && typeof error === 'object') {
      const normalizedError = new Error('Unknown error occurred') as ErrorWithCode;
      normalizedError.code = (error as any).code;
      normalizedError.data = (error as any).data;
      return normalizedError;
    }

    return new Error('Unknown error occurred') as ErrorWithCode;
  }

  private addContext(error: ErrorWithCode, context: ErrorContext): ErrorWithCode {
    const errorWithContext = error as ErrorWithCode & { context?: ErrorContext };
    errorWithContext.context = context;
    return errorWithContext;
  }

  private notifyListeners(error: ErrorWithCode, context: ErrorContext): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error, context);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  public isWalletError(error: unknown): error is WalletError {
    return error instanceof Error && 'code' in error && typeof (error as any).code === 'number';
  }

  public isNetworkError(error: unknown): boolean {
    return this.isWalletError(error) && (error as any).code === -32002;
  }

  public isUserRejectedError(error: unknown): boolean {
    return this.isWalletError(error) && (error as any).code === 4001;
  }

  public isTransactionError(error: unknown): boolean {
    return this.isWalletError(error) && (error as any).code === -32603;
  }
}

export const errorHandler = ErrorHandler.getInstance(); 