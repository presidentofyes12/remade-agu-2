import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VotingPowerManager } from '../VotingPowerManager';
import { VotingPowerService } from '../../services/votingPowerService';
import { LoadingStateService } from '../../services/loadingStateService';
import { Delegation } from '../../types/votingDelegation';

// Mock the services
jest.mock('../../services/votingPowerService');
jest.mock('../../services/loadingStateService');

describe('VotingPowerManager', () => {
  const mockLoadingStateService = {
    startOperation: jest.fn(),
    completeOperation: jest.fn()
  } as unknown as LoadingStateService;

  const mockVotingPowerService = {
    getCurrentUser: jest.fn().mockResolvedValue('0x123'),
    getActiveDelegations: jest.fn().mockResolvedValue([]),
    getAvailableVotingPower: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
    getEffectiveVotingPower: jest.fn().mockResolvedValue(BigInt(1000000000000000000)),
    createDelegation: jest.fn(),
    updateDelegation: jest.fn(),
    revokeDelegation: jest.fn(),
    getDelegation: jest.fn(),
    getDelegationsByDelegator: jest.fn(),
    getDelegationsByDelegate: jest.fn(),
    getDelegatedVotingPower: jest.fn(),
    validateDelegation: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  } as unknown as jest.Mocked<VotingPowerService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component with initial state', async () => {
    render(
      <VotingPowerManager
        loadingStateService={mockLoadingStateService}
        votingPowerService={mockVotingPowerService}
      />
    );

    // Check if the component renders with initial state
    expect(screen.getByText('Available Voting Power')).toBeInTheDocument();
    expect(screen.getByText('Effective Voting Power')).toBeInTheDocument();
    expect(screen.getByText('Active Delegations')).toBeInTheDocument();
    expect(screen.getByText('New Delegation')).toBeInTheDocument();
  });

  it('opens the delegation dialog when clicking New Delegation', async () => {
    render(
      <VotingPowerManager
        loadingStateService={mockLoadingStateService}
        votingPowerService={mockVotingPowerService}
      />
    );

    const newDelegationButton = screen.getByText('New Delegation');
    fireEvent.click(newDelegationButton);

    // Check if the dialog opens with the correct title
    expect(screen.getByText('New Delegation')).toBeInTheDocument();
  });

  it('creates a new delegation', async () => {
    render(
      <VotingPowerManager
        loadingStateService={mockLoadingStateService}
        votingPowerService={mockVotingPowerService}
      />
    );

    // Open the dialog
    const newDelegationButton = screen.getByText('New Delegation');
    fireEvent.click(newDelegationButton);

    // Fill in the form
    const delegateInput = screen.getByLabelText('Delegate Address');
    const amountInput = screen.getByLabelText('Amount');
    
    fireEvent.change(delegateInput, { target: { value: '0x456' } });
    fireEvent.change(amountInput, { target: { value: '1000000000000000000' } });

    // Submit the form
    const submitButton = screen.getByText('Create');
    fireEvent.click(submitButton);

    // Verify the service was called
    await waitFor(() => {
      expect(mockVotingPowerService.createDelegation).toHaveBeenCalledWith(
        '0x456',
        'partial',
        BigInt('1000000000000000000'),
        0,
        undefined
      );
    });
  });

  it('edits an existing delegation', async () => {
    const mockDelegation: Delegation = {
      id: '1',
      delegator: '0x123',
      delegate: '0x456',
      type: 'partial',
      amount: BigInt('1000000000000000000'),
      percentage: 0,
      startTime: Date.now(),
      endTime: null,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: []
      }
    };

    mockVotingPowerService.getActiveDelegations.mockResolvedValueOnce([mockDelegation]);

    render(
      <VotingPowerManager
        loadingStateService={mockLoadingStateService}
        votingPowerService={mockVotingPowerService}
      />
    );

    // Wait for the delegation to be loaded
    await waitFor(() => {
      expect(screen.getByText('Delegate: 0x456')).toBeInTheDocument();
    });

    // Click the edit button
    const editButton = screen.getByTestId('EditIcon');
    fireEvent.click(editButton);

    // Update the amount
    const amountInput = screen.getByLabelText('Amount');
    fireEvent.change(amountInput, { target: { value: '2000000000000000000' } });

    // Submit the form
    const submitButton = screen.getByText('Update');
    fireEvent.click(submitButton);

    // Verify the service was called
    await waitFor(() => {
      expect(mockVotingPowerService.updateDelegation).toHaveBeenCalledWith(
        '1',
        'partial',
        BigInt('2000000000000000000'),
        0
      );
    });
  });

  it('revokes a delegation', async () => {
    const mockDelegation: Delegation = {
      id: '1',
      delegator: '0x123',
      delegate: '0x456',
      type: 'partial',
      amount: BigInt('1000000000000000000'),
      percentage: 0,
      startTime: Date.now(),
      endTime: null,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: []
      }
    };

    mockVotingPowerService.getActiveDelegations.mockResolvedValueOnce([mockDelegation]);

    render(
      <VotingPowerManager
        loadingStateService={mockLoadingStateService}
        votingPowerService={mockVotingPowerService}
      />
    );

    // Wait for the delegation to be loaded
    await waitFor(() => {
      expect(screen.getByText('Delegate: 0x456')).toBeInTheDocument();
    });

    // Click the delete button
    const deleteButton = screen.getByTestId('DeleteIcon');
    fireEvent.click(deleteButton);

    // Verify the service was called
    await waitFor(() => {
      expect(mockVotingPowerService.revokeDelegation).toHaveBeenCalledWith('1');
    });
  });

  it('displays available and effective voting power', async () => {
    mockVotingPowerService.getAvailableVotingPower.mockResolvedValueOnce(BigInt('1000000000000000000'));
    mockVotingPowerService.getEffectiveVotingPower.mockResolvedValueOnce(BigInt('2000000000000000000'));

    render(
      <VotingPowerManager
        loadingStateService={mockLoadingStateService}
        votingPowerService={mockVotingPowerService}
      />
    );

    // Wait for the values to be loaded
    await waitFor(() => {
      expect(screen.getByText('1.0')).toBeInTheDocument(); // Available power
      expect(screen.getByText('2.0')).toBeInTheDocument(); // Effective power
    });
  });
}); 