import React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingOverlay } from '../LoadingOverlay';
import { LoadingStateProvider } from '../../contexts/LoadingStateContext';
import { NotificationService } from '../../services/notificationService';
import { LoadingOperation } from '../../types/loadingStates';

jest.mock('../../services/loadingStateService');

describe('LoadingOverlay', () => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when there are no active operations', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    render(<LoadingOverlay />, { wrapper });
    expect(screen.queryByText('Processing Operations')).not.toBeInTheDocument();
  });

  it('renders overlay with active operations', () => {
    const activeOperations: LoadingOperation[] = ['transaction', 'keyRotation'];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    // Mock the useLoadingState hook
    jest.spyOn(require('../../contexts/LoadingStateContext'), 'useLoadingState').mockReturnValue({
      activeOperations
    });

    render(<LoadingOverlay />, { wrapper });

    expect(screen.getByText('Processing Operations')).toBeInTheDocument();
    expect(screen.getByText('Transaction')).toBeInTheDocument();
    expect(screen.getByText('Key Rotation')).toBeInTheDocument();
  });

  it('renders loading indicators for each active operation', () => {
    const activeOperations: LoadingOperation[] = ['transaction', 'keyRotation'];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    // Mock the useLoadingState hook
    jest.spyOn(require('../../contexts/LoadingStateContext'), 'useLoadingState').mockReturnValue({
      activeOperations
    });

    render(<LoadingOverlay />, { wrapper });

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2);
  });

  it('displays correct operation labels', () => {
    const activeOperations: LoadingOperation[] = [
      'transaction',
      'keyRotation',
      'backup',
      'multiSig',
      'contractInteraction',
      'dataFetch'
    ];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    // Mock the useLoadingState hook
    jest.spyOn(require('../../contexts/LoadingStateContext'), 'useLoadingState').mockReturnValue({
      activeOperations
    });

    render(<LoadingOverlay />, { wrapper });

    expect(screen.getByText('Transaction')).toBeInTheDocument();
    expect(screen.getByText('Key Rotation')).toBeInTheDocument();
    expect(screen.getByText('Backup')).toBeInTheDocument();
    expect(screen.getByText('Multi-Signature')).toBeInTheDocument();
    expect(screen.getByText('Contract Interaction')).toBeInTheDocument();
    expect(screen.getByText('Data Fetch')).toBeInTheDocument();
  });

  it('renders with correct styling', () => {
    const activeOperations: LoadingOperation[] = ['transaction'];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingStateProvider
        notificationService={mockNotificationService}
        config={mockConfig}
      >
        {children}
      </LoadingStateProvider>
    );

    // Mock the useLoadingState hook
    jest.spyOn(require('../../contexts/LoadingStateContext'), 'useLoadingState').mockReturnValue({
      activeOperations
    });

    render(<LoadingOverlay />, { wrapper });

    // Check for backdrop
    const backdrop = screen.getByRole('presentation');
    expect(backdrop).toHaveStyle({
      backgroundColor: 'rgba(0, 0, 0, 0.5)'
    });

    // Check for container
    const container = screen.getByRole('dialog');
    expect(container).toHaveStyle({
      backgroundColor: 'background.paper',
      borderRadius: 'borderRadius',
      padding: '24px'
    });
  });
}); 