import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { LoadingIndicator } from '../LoadingIndicator';
import { LoadingStateService } from '../../services/loadingStateService';
import { NotificationService } from '../../services/notificationService';
import { LoadingOperation, LoadingState } from '../../types/loadingStates';

jest.mock('../../services/loadingStateService');

describe('LoadingIndicator', () => {
  let mockLoadingStateService: jest.Mocked<LoadingStateService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockNotificationService = {
      createNotification: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<NotificationService>;

    mockLoadingStateService = {
      getInstance: jest.fn().mockReturnThis(),
      on: jest.fn(),
      off: jest.fn(),
      getOperationState: jest.fn(),
      getOperationProgress: jest.fn()
    } as unknown as jest.Mocked<LoadingStateService>;

    (LoadingStateService.getInstance as jest.Mock).mockReturnValue(mockLoadingStateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when state is idle', () => {
    mockLoadingStateService.getOperationState.mockReturnValue({
      operation: 'transaction',
      state: 'idle',
      progress: 0,
      startTime: Date.now(),
      metadata: {}
    });

    render(<LoadingIndicator operation="transaction" />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders circular progress indicator', () => {
    mockLoadingStateService.getOperationState.mockReturnValue({
      operation: 'transaction',
      state: 'loading',
      progress: 50,
      startTime: Date.now(),
      metadata: {}
    });

    render(<LoadingIndicator operation="transaction" variant="circular" />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('renders linear progress indicator', () => {
    mockLoadingStateService.getOperationState.mockReturnValue({
      operation: 'transaction',
      state: 'loading',
      progress: 75,
      startTime: Date.now(),
      metadata: {}
    });

    render(<LoadingIndicator operation="transaction" variant="linear" />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
  });

  it('displays progress percentage when showProgress is true', () => {
    mockLoadingStateService.getOperationState.mockReturnValue({
      operation: 'transaction',
      state: 'loading',
      progress: 60,
      startTime: Date.now(),
      metadata: {}
    });

    render(<LoadingIndicator operation="transaction" showProgress />);
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('does not display progress percentage when showProgress is false', () => {
    mockLoadingStateService.getOperationState.mockReturnValue({
      operation: 'transaction',
      state: 'loading',
      progress: 60,
      startTime: Date.now(),
      metadata: {}
    });

    render(<LoadingIndicator operation="transaction" showProgress={false} />);
    expect(screen.queryByText('60%')).not.toBeInTheDocument();
  });

  it('displays status text when showStatus is true', () => {
    mockLoadingStateService.getOperationState.mockReturnValue({
      operation: 'transaction',
      state: 'loading',
      progress: 0,
      startTime: Date.now(),
      metadata: {}
    });

    render(<LoadingIndicator operation="transaction" showStatus />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays error state correctly', () => {
    const errorMessage = 'Operation failed';
    mockLoadingStateService.getOperationState.mockReturnValue({
      operation: 'transaction',
      state: 'error',
      progress: 0,
      startTime: Date.now(),
      metadata: {},
      error: errorMessage
    });

    render(<LoadingIndicator operation="transaction" showStatus />);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('updates state and progress when events are received', () => {
    const operation: LoadingOperation = 'transaction';
    render(<LoadingIndicator operation={operation} />);

    // Simulate state change event
    act(() => {
      const stateChangeCallback = mockLoadingStateService.on.mock.calls.find(
        call => call[0] === 'StateChanged'
      )?.[1];
      stateChangeCallback?.({
        operation,
        previousState: 'idle',
        newState: 'loading',
        timestamp: Date.now()
      });
    });

    // Simulate progress update event
    act(() => {
      const progressCallback = mockLoadingStateService.on.mock.calls.find(
        call => call[0] === 'ProgressUpdated'
      )?.[1];
      progressCallback?.({
        operation,
        progress: 50,
        timestamp: Date.now()
      });
    });

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('cleans up event listeners on unmount', () => {
    const operation: LoadingOperation = 'transaction';
    const { unmount } = render(<LoadingIndicator operation={operation} />);

    unmount();

    expect(mockLoadingStateService.off).toHaveBeenCalledTimes(3); // StateChanged, ProgressUpdated, OperationCompleted
  });
}); 