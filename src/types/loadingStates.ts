import { TransactionType, TransactionStatus } from './transactionTracking';

export type LoadingState = 
  | 'idle'
  | 'initializing'
  | 'loading'
  | 'processing'
  | 'success'
  | 'error';

export type LoadingOperation = 
  | 'transaction'
  | 'keyRotation'
  | 'backup'
  | 'multiSig'
  | 'contractInteraction'
  | 'dataFetch';

export interface LoadingStateInfo {
  operation: LoadingOperation;
  state: LoadingState;
  progress: number;
  startTime: number;
  estimatedEndTime?: number;
  error?: string;
  metadata: {
    [key: string]: any;
  };
}

export interface LoadingStateEvents {
  StateChanged: {
    operation: LoadingOperation;
    previousState: LoadingState;
    newState: LoadingState;
    timestamp: number;
  };
  ProgressUpdated: {
    operation: LoadingOperation;
    progress: number;
    timestamp: number;
  };
  OperationCompleted: {
    operation: LoadingOperation;
    success: boolean;
    timestamp: number;
  };
}

export interface LoadingStateConfig {
  defaultTimeout: number; // In milliseconds
  progressUpdateInterval: number; // In milliseconds
  maxRetries: number;
  retryDelay: number; // In milliseconds
  estimatedDurations: {
    [key in LoadingOperation]: number; // In milliseconds
  };
}

export interface LoadingStateManager {
  // State Management
  startOperation(
    operation: LoadingOperation,
    metadata?: Record<string, any>
  ): void;
  
  updateProgress(
    operation: LoadingOperation,
    progress: number
  ): void;
  
  completeOperation(
    operation: LoadingOperation,
    success: boolean,
    error?: string
  ): void;
  
  // Query Functions
  getOperationState(operation: LoadingOperation): LoadingStateInfo | undefined;
  getActiveOperations(): LoadingOperation[];
  getOperationProgress(operation: LoadingOperation): number;
  
  // Event Listeners
  on<K extends keyof LoadingStateEvents>(
    event: K,
    listener: (event: LoadingStateEvents[K]) => void
  ): void;
  
  off<K extends keyof LoadingStateEvents>(
    event: K,
    listener: (event: LoadingStateEvents[K]) => void
  ): void;
} 