import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LoadingStateService } from '../loadingStateService';
import { NotificationService } from '../notificationService';
import { errorHandler } from '../../utils/errorHandler';
import { LoadingOperation, LoadingState, LoadingStateConfig } from '../../types/loadingStates';

// Mock dependencies
jest.mock('../../utils/errorHandler');
jest.mock('../notificationService');

// Test utilities
class LoadingStateTestFactory {
  static createDefaultConfig(): LoadingStateConfig {
    return {
      defaultTimeout: 30000,
      progressUpdateInterval: 1000,
      maxRetries: 3,
      retryDelay: 1000,
      estimatedDurations: {
        transaction: 30000,
        keyRotation: 60000,
        backup: 120000,
        multiSig: 90000,
        contractInteraction: 45000,
        dataFetch: 15000
      }
    };
  }

  static createMockNotificationService(): jest.Mocked<NotificationService> {
    return {
      createNotification: jest.fn(),
      markAsRead: jest.fn(),
      updatePreferences: jest.fn(),
      getPreferences: jest.fn(),
      getNotification: jest.fn(),
      getUnreadNotifications: jest.fn(),
      getNotificationsByType: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      cleanup: jest.fn()
    } as unknown as jest.Mocked<NotificationService>;
  }
}

describe('LoadingStateService', () => {
  let loadingStateService: LoadingStateService;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockConfig: LoadingStateConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize test data
    mockConfig = LoadingStateTestFactory.createDefaultConfig();
    mockNotificationService = LoadingStateTestFactory.createMockNotificationService();
    
    // Initialize service
    loadingStateService = LoadingStateService.getInstance(mockNotificationService, mockConfig);
  });

  describe('Initialization', () => {
    it('should maintain singleton instance', () => {
      const instance1 = LoadingStateService.getInstance(mockNotificationService, mockConfig);
      const instance2 = LoadingStateService.getInstance(mockNotificationService, mockConfig);
      expect(instance1).toBe(instance2);
    });
  });

  describe('Operation Management', () => {
    it('should start operation successfully', () => {
      const operation: LoadingOperation = 'transaction';
      const metadata = { txHash: '0x123' };

      loadingStateService.startOperation(operation, metadata);
      const state = loadingStateService.getOperationState(operation);

      expect(state).toBeDefined();
      expect(state?.operation).toBe(operation);
      expect(state?.state).toBe('loading');
      expect(state?.progress).toBe(0);
      expect(state?.metadata).toEqual(metadata);
    });

    it('should update operation progress', () => {
      const operation: LoadingOperation = 'transaction';
      loadingStateService.startOperation(operation);

      loadingStateService.updateProgress(operation, 50);
      const state = loadingStateService.getOperationState(operation);

      expect(state?.progress).toBe(50);
    });

    it('should normalize progress to be between 0 and 100', () => {
      const operation: LoadingOperation = 'transaction';
      loadingStateService.startOperation(operation);

      loadingStateService.updateProgress(operation, -10);
      expect(loadingStateService.getOperationProgress(operation)).toBe(0);

      loadingStateService.updateProgress(operation, 150);
      expect(loadingStateService.getOperationProgress(operation)).toBe(100);
    });

    it('should complete operation successfully', () => {
      const operation: LoadingOperation = 'transaction';
      loadingStateService.startOperation(operation);

      loadingStateService.completeOperation(operation, true);
      const state = loadingStateService.getOperationState(operation);

      expect(state?.state).toBe('success');
      expect(state?.progress).toBe(100);
      expect(mockNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should complete operation with error', () => {
      const operation: LoadingOperation = 'transaction';
      const error = 'Transaction failed';
      loadingStateService.startOperation(operation);

      loadingStateService.completeOperation(operation, false, error);
      const state = loadingStateService.getOperationState(operation);

      expect(state?.state).toBe('error');
      expect(state?.progress).toBe(0);
      expect(state?.error).toBe(error);
      expect(mockNotificationService.createNotification).toHaveBeenCalled();
    });
  });

  describe('State Queries', () => {
    it('should get active operations', () => {
      const operations: LoadingOperation[] = ['transaction', 'keyRotation'];
      operations.forEach(op => loadingStateService.startOperation(op));

      const activeOps = loadingStateService.getActiveOperations();
      expect(activeOps).toEqual(operations);

      loadingStateService.completeOperation('transaction', true);
      const remainingOps = loadingStateService.getActiveOperations();
      expect(remainingOps).toEqual(['keyRotation']);
    });

    it('should get operation progress', () => {
      const operation: LoadingOperation = 'transaction';
      loadingStateService.startOperation(operation);

      loadingStateService.updateProgress(operation, 75);
      expect(loadingStateService.getOperationProgress(operation)).toBe(75);
    });

    it('should return 0 progress for non-existent operation', () => {
      const operation: LoadingOperation = 'transaction';
      expect(loadingStateService.getOperationProgress(operation)).toBe(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit state change events', () => {
      const operation: LoadingOperation = 'transaction';
      const listener = jest.fn();
      loadingStateService.on('StateChanged', listener);

      loadingStateService.startOperation(operation);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        operation,
        previousState: 'idle',
        newState: 'initializing'
      }));
    });

    it('should emit progress update events', () => {
      const operation: LoadingOperation = 'transaction';
      const listener = jest.fn();
      loadingStateService.on('ProgressUpdated', listener);

      loadingStateService.startOperation(operation);
      loadingStateService.updateProgress(operation, 50);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        operation,
        progress: 50
      }));
    });

    it('should emit operation completion events', () => {
      const operation: LoadingOperation = 'transaction';
      const listener = jest.fn();
      loadingStateService.on('OperationCompleted', listener);

      loadingStateService.startOperation(operation);
      loadingStateService.completeOperation(operation, true);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        operation,
        success: true
      }));
    });

    it('should remove event listeners', () => {
      const operation: LoadingOperation = 'transaction';
      const listener = jest.fn();
      loadingStateService.on('StateChanged', listener);

      loadingStateService.startOperation(operation);
      expect(listener).toHaveBeenCalled();

      loadingStateService.off('StateChanged', listener);
      loadingStateService.startOperation('keyRotation');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle operation timeout', () => {
      const operation: LoadingOperation = 'transaction';
      const shortConfig = {
        ...mockConfig,
        defaultTimeout: 100
      };
      loadingStateService = LoadingStateService.getInstance(mockNotificationService, shortConfig);

      loadingStateService.startOperation(operation);

      // Wait for timeout
      return new Promise(resolve => {
        setTimeout(() => {
          const state = loadingStateService.getOperationState(operation);
          expect(state?.state).toBe('error');
          expect(state?.error).toContain('timeout');
          expect(errorHandler.handleError).toHaveBeenCalled();
          resolve(undefined);
        }, 150);
      });
    });

    it('should handle invalid operation updates', () => {
      const operation: LoadingOperation = 'transaction';
      expect(() => loadingStateService.updateProgress(operation, 50))
        .toThrow('No active operation found');
      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle invalid operation completion', () => {
      const operation: LoadingOperation = 'transaction';
      expect(() => loadingStateService.completeOperation(operation, true))
        .toThrow('No active operation found');
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      const operation: LoadingOperation = 'transaction';
      loadingStateService.startOperation(operation);

      loadingStateService.cleanup();
      const state = loadingStateService.getOperationState(operation);
      expect(state).toBeUndefined();
    });
  });
}); 