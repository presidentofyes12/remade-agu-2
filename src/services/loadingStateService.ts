import { 
  LoadingStateManager, 
  LoadingStateInfo, 
  LoadingStateEvents,
  LoadingOperation,
  LoadingState,
  LoadingStateConfig
} from '../types/loadingStates';
import { NotificationService } from './notificationService';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';

export class LoadingStateService implements LoadingStateManager {
  private static instance: LoadingStateService;
  private notificationService: NotificationService;
  private config: LoadingStateConfig;
  private eventListeners: Map<keyof LoadingStateEvents, Set<(event: LoadingStateEvents[keyof LoadingStateEvents]) => void>>;
  private operationStates: Map<LoadingOperation, LoadingStateInfo>;
  private progressIntervals: Map<LoadingOperation, NodeJS.Timeout>;
  private timeoutIntervals: Map<LoadingOperation, NodeJS.Timeout>;

  private constructor(
    notificationService: NotificationService,
    config: LoadingStateConfig
  ) {
    this.notificationService = notificationService;
    this.config = config;
    this.eventListeners = new Map();
    this.operationStates = new Map();
    this.progressIntervals = new Map();
    this.timeoutIntervals = new Map();
  }

  public static getInstance(
    notificationService: NotificationService,
    config: LoadingStateConfig
  ): LoadingStateService {
    if (!LoadingStateService.instance) {
      LoadingStateService.instance = new LoadingStateService(
        notificationService,
        config
      );
    }
    return LoadingStateService.instance;
  }

  public startOperation(
    operation: LoadingOperation,
    metadata: Record<string, any> = {}
  ): void {
    try {
      // Clear any existing state
      this.clearOperationState(operation);

      // Create new state
      const startTime = Date.now();
      const estimatedEndTime = startTime + this.config.estimatedDurations[operation];
      const state: LoadingStateInfo = {
        operation,
        state: 'initializing',
        progress: 0,
        startTime,
        estimatedEndTime,
        metadata
      };

      // Store state
      this.operationStates.set(operation, state);

      // Start progress tracking
      this.startProgressTracking(operation);

      // Set timeout
      this.setOperationTimeout(operation);

      // Emit state change event
      this.emitEvent('StateChanged', {
        operation,
        previousState: 'idle',
        newState: 'initializing',
        timestamp: startTime
      });

      // Update to loading state after a short delay
      setTimeout(() => {
        this.updateOperationState(operation, 'loading');
      }, 100);
    } catch (error) {
      errorHandler.handleError(error);
      this.completeOperation(operation, false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  public updateProgress(
    operation: LoadingOperation,
    progress: number
  ): void {
    try {
      const state = this.operationStates.get(operation);
      if (!state) {
        throw new Error(`No active operation found for ${operation}`);
      }

      // Ensure progress is between 0 and 100
      const normalizedProgress = Math.max(0, Math.min(100, progress));

      // Update state
      state.progress = normalizedProgress;
      this.operationStates.set(operation, state);

      // Emit progress update event
      this.emitEvent('ProgressUpdated', {
        operation,
        progress: normalizedProgress,
        timestamp: Date.now()
      });

      // If progress is 100%, complete the operation
      if (normalizedProgress === 100) {
        this.completeOperation(operation, true);
      }
    } catch (error) {
      errorHandler.handleError(error);
    }
  }

  public completeOperation(
    operation: LoadingOperation,
    success: boolean,
    error?: string
  ): void {
    try {
      const state = this.operationStates.get(operation);
      if (!state) {
        throw new Error(`No active operation found for ${operation}`);
      }

      // Clear intervals
      this.clearOperationState(operation);

      // Update state
      const newState: LoadingState = success ? 'success' : 'error';
      state.state = newState;
      state.progress = success ? 100 : 0;
      if (error) {
        state.error = error;
      }
      this.operationStates.set(operation, state);

      // Emit events
      this.emitEvent('StateChanged', {
        operation,
        previousState: state.state,
        newState,
        timestamp: Date.now()
      });

      this.emitEvent('OperationCompleted', {
        operation,
        success,
        timestamp: Date.now()
      });

      // Send notification
      this.notifyOperationCompletion(operation, success, error);
    } catch (error) {
      errorHandler.handleError(error);
    }
  }

  public getOperationState(operation: LoadingOperation): LoadingStateInfo | undefined {
    return this.operationStates.get(operation);
  }

  public getActiveOperations(): LoadingOperation[] {
    return Array.from(this.operationStates.keys()).filter(
      operation => {
        const state = this.operationStates.get(operation);
        return state && state.state !== 'success' && state.state !== 'error';
      }
    );
  }

  public getOperationProgress(operation: LoadingOperation): number {
    return this.operationStates.get(operation)?.progress ?? 0;
  }

  public on<K extends keyof LoadingStateEvents>(
    event: K,
    listener: (event: LoadingStateEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: LoadingStateEvents[keyof LoadingStateEvents]) => void);
  }

  public off<K extends keyof LoadingStateEvents>(
    event: K,
    listener: (event: LoadingStateEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: LoadingStateEvents[keyof LoadingStateEvents]) => void);
  }

  private startProgressTracking(operation: LoadingOperation): void {
    const interval = setInterval(() => {
      const state = this.operationStates.get(operation);
      if (!state || state.state === 'success' || state.state === 'error') {
        clearInterval(interval);
        this.progressIntervals.delete(operation);
        return;
      }

      // Calculate estimated progress based on time elapsed
      const elapsed = Date.now() - state.startTime;
      const estimatedDuration = this.config.estimatedDurations[operation];
      const estimatedProgress = Math.min(95, (elapsed / estimatedDuration) * 100);

      // Update progress if it's less than the estimated progress
      if (state.progress < estimatedProgress) {
        this.updateProgress(operation, estimatedProgress);
      }
    }, this.config.progressUpdateInterval);

    this.progressIntervals.set(operation, interval);
  }

  private setOperationTimeout(operation: LoadingOperation): void {
    const timeout = setTimeout(() => {
      const state = this.operationStates.get(operation);
      if (state && state.state !== 'success' && state.state !== 'error') {
        this.completeOperation(
          operation,
          false,
          `Operation timed out after ${this.config.defaultTimeout}ms`
        );
      }
    }, this.config.defaultTimeout);

    this.timeoutIntervals.set(operation, timeout);
  }

  private clearOperationState(operation: LoadingOperation): void {
    // Clear progress interval
    const progressInterval = this.progressIntervals.get(operation);
    if (progressInterval) {
      clearInterval(progressInterval);
      this.progressIntervals.delete(operation);
    }

    // Clear timeout interval
    const timeoutInterval = this.timeoutIntervals.get(operation);
    if (timeoutInterval) {
      clearTimeout(timeoutInterval);
      this.timeoutIntervals.delete(operation);
    }
  }

  private updateOperationState(
    operation: LoadingOperation,
    newState: LoadingState
  ): void {
    const state = this.operationStates.get(operation);
    if (!state) {
      throw new Error(`No active operation found for ${operation}`);
    }

    const previousState = state.state;
    state.state = newState;
    this.operationStates.set(operation, state);

    this.emitEvent('StateChanged', {
      operation,
      previousState,
      newState,
      timestamp: Date.now()
    });
  }

  private async notifyOperationCompletion(
    operation: LoadingOperation,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const title = `${operation.charAt(0).toUpperCase() + operation.slice(1)} ${success ? 'Completed' : 'Failed'}`;
      const message = success
        ? `The ${operation} operation has completed successfully.`
        : `The ${operation} operation failed: ${error}`;

      await this.notificationService.createNotification(
        'systemAlert',
        success ? 'medium' : 'high',
        title,
        message,
        { operation, success, error }
      );
    } catch (error) {
      errorHandler.handleError(error);
      // Don't throw here as this is a non-critical operation
    }
  }

  private emitEvent<K extends keyof LoadingStateEvents>(
    event: K,
    data: LoadingStateEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  public cleanup(): void {
    // Clear all intervals
    this.progressIntervals.forEach(interval => clearInterval(interval));
    this.progressIntervals.clear();

    this.timeoutIntervals.forEach(interval => clearTimeout(interval));
    this.timeoutIntervals.clear();

    // Clear all states
    this.operationStates.clear();
  }
} 