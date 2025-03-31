import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { LoadingStateProvider, useLoadingState } from '../LoadingStateContext';
import { LoadingStateService } from '../../services/loadingStateService';
import { NotificationService } from '../../services/notificationService';
import { LoadingOperation, LoadingStateEvents } from '../../types/loadingStates';

jest.mock('../../services/loadingStateService');

describe('LoadingStateContext', () => {
  let mockLoadingStateService: jest.Mocked<LoadingStateService>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockConfig: {
    defaultTimeout: number;
    progressUpdateInterval: number;
    maxRetries: number;
    retryDelay: number;
    estimatedDurations: {
      [key in LoadingOperation]: number;
    };
  };

  beforeEach(() => {
    mockNotificationService = {
      createNotification: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<NotificationService>;

    mockConfig = {
      defaultTimeout: 30000,
      progressUpdateInterval: 1000,
      maxRetries: 3,
      retryDelay: 1000,
      estimatedDurations: {
        transaction: 15000,
        keyRotation: 20000,
        backup: 25000,
        multiSig: 30000,
        contractInteraction: 10000,
        dataFetch: 5000
      }
    };

    mockLoadingStateService = {
      getInstance: jest.fn().mockReturnThis(),
      on: jest.fn(),
      off: jest.fn(),
      getOperationState: jest.fn(),
      getOperationProgress: jest.fn(),
      getActiveOperations: jest.fn()
    } as unknown as jest.Mocked<LoadingStateService>;

    (LoadingStateService.getInstance as jest.Mock).mockReturnValue(mockLoadingStateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('provides loading state service instance', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    const { result } = renderHook(() => useLoadingState(), { wrapper });

    expect(result.current.loadingStateService).toBe(mockLoadingStateService);
  });

  it('tracks active operations', () => {
    const activeOperations: LoadingOperation[] = ['transaction', 'keyRotation'];
    mockLoadingStateService.getActiveOperations.mockReturnValue(activeOperations);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    const { result } = renderHook(() => useLoadingState(), { wrapper });

    expect(result.current.activeOperations).toEqual(activeOperations);
  });

  it('updates active operations on state change', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    const { result } = renderHook(() => useLoadingState(), { wrapper });

    // Simulate state change event
    act(() => {
      const stateChangeCallback = mockLoadingStateService.on.mock.calls.find(
        call => call[0] === 'StateChanged'
      )?.[1];
      stateChangeCallback?.({
        operation: 'transaction',
        previousState: 'idle',
        newState: 'loading',
        timestamp: Date.now()
      } as LoadingStateEvents['StateChanged']);
    });

    expect(result.current.activeOperations).toContain('transaction');

    // Simulate operation completion
    act(() => {
      const stateChangeCallback = mockLoadingStateService.on.mock.calls.find(
        call => call[0] === 'StateChanged'
      )?.[1];
      stateChangeCallback?.({
        operation: 'transaction',
        previousState: 'loading',
        newState: 'success',
        timestamp: Date.now()
      } as LoadingStateEvents['StateChanged']);
    });

    expect(result.current.activeOperations).not.toContain('transaction');
  });

  it('provides operation state getter', () => {
    const operation: LoadingOperation = 'transaction';
    const mockState = {
      operation,
      state: 'loading' as const,
      progress: 50,
      startTime: Date.now(),
      metadata: {}
    };

    mockLoadingStateService.getOperationState.mockReturnValue(mockState);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    const { result } = renderHook(() => useLoadingState(), { wrapper });

    expect(result.current.getOperationState(operation)).toEqual(mockState);
  });

  it('provides operation progress getter', () => {
    const operation: LoadingOperation = 'transaction';
    const mockProgress = 75;

    mockLoadingStateService.getOperationProgress.mockReturnValue(mockProgress);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    const { result } = renderHook(() => useLoadingState(), { wrapper });

    expect(result.current.getOperationProgress(operation)).toBe(mockProgress);
  });

  it('provides event subscription methods', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    const { result } = renderHook(() => useLoadingState(), { wrapper });

    const listener = jest.fn();

    result.current.on('StateChanged', listener);
    expect(mockLoadingStateService.on).toHaveBeenCalledWith('StateChanged', listener);

    result.current.off('StateChanged', listener);
    expect(mockLoadingStateService.off).toHaveBeenCalledWith('StateChanged', listener);
  });

  it('cleans up event listeners on unmount', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    const { unmount } = renderHook(() => useLoadingState(), { wrapper });

    unmount();

    expect(mockLoadingStateService.off).toHaveBeenCalled();
  });
}); 