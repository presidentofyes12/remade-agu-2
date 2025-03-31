import { ethers } from 'ethers';
import { ProposalService } from '../proposalService';
import { ProposalStatus } from '../../types/proposals';

jest.mock('ethers');

describe('ProposalService Event Handling', () => {
  let proposalService: ProposalService;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockSigner: jest.Mocked<ethers.Signer>;
  let mockContract: any;

  const mockAddresses = {
    token: '0x123',
    logic: '0x456',
    state: '0x789',
    view: '0xabc'
  };

  beforeEach(() => {
    // Reset singleton instance
    (ProposalService as any).instance = null;

    // Setup mocks
    mockProvider = {
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn()
    } as unknown as jest.Mocked<ethers.Provider>;

    mockSigner = {
      getAddress: jest.fn().mockResolvedValue('0x123'),
      signMessage: jest.fn(),
      signTransaction: jest.fn()
    } as unknown as jest.Mocked<ethers.Signer>;

    mockContract = {
      address: mockAddresses.logic,
      provider: mockProvider,
      signer: mockSigner,
      on: jest.fn(),
      off: jest.fn(),
      createProposal: jest.fn(),
      vote: jest.fn(),
      executeProposal: jest.fn(),
      cancelProposal: jest.fn(),
      getProposal: jest.fn(),
      getProposalCount: jest.fn()
    };

    // Initialize service
    proposalService = ProposalService.getInstance(
      mockAddresses.token,
      mockAddresses.logic,
      mockAddresses.state,
      mockAddresses.view,
      mockProvider,
      mockSigner
    );
  });

  describe('Event Registration', () => {
    it('should register event listeners on initialization', () => {
      expect(mockContract.on).toHaveBeenCalledTimes(4);
      expect(mockContract.on).toHaveBeenCalledWith('ProposalCreated', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('ProposalVoted', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('ProposalExecuted', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('ProposalCancelled', expect.any(Function));
    });

    it('should allow adding custom event listeners', () => {
      const callback = jest.fn();
      proposalService.on('ProposalCreated', callback);
      expect(proposalService['eventListeners'].get('ProposalCreated')?.has(callback)).toBe(true);
    });

    it('should allow removing event listeners', () => {
      const callback = jest.fn();
      proposalService.on('ProposalCreated', callback);
      proposalService.off('ProposalCreated', callback);
      expect(proposalService['eventListeners'].get('ProposalCreated')?.has(callback)).toBe(false);
    });
  });

  describe('Event Handling', () => {
    it('should handle ProposalCreated events correctly', () => {
      const mockEvent = {
        proposalId: BigInt(1),
        title: 'Test Proposal',
        creator: '0x123',
        timestamp: BigInt(Date.now())
      };

      const callback = jest.fn();
      proposalService.on('ProposalCreated', callback);

      // Simulate event
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalCreated'
      )[1];
      eventHandler(mockEvent);

      expect(callback).toHaveBeenCalledWith({
        proposalId: mockEvent.proposalId,
        timestamp: Number(mockEvent.timestamp),
        eventType: ProposalStatus.PENDING,
        data: {
          title: mockEvent.title,
          creator: mockEvent.creator
        }
      });
    });

    it('should handle ProposalVoted events correctly', () => {
      const mockEvent = {
        proposalId: BigInt(1),
        voter: '0x123',
        support: true,
        timestamp: BigInt(Date.now())
      };

      const callback = jest.fn();
      proposalService.on('ProposalVoted', callback);

      // Simulate event
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalVoted'
      )[1];
      eventHandler(mockEvent);

      expect(callback).toHaveBeenCalledWith({
        proposalId: mockEvent.proposalId,
        timestamp: Number(mockEvent.timestamp),
        eventType: ProposalStatus.ACTIVE,
        data: {
          voter: mockEvent.voter,
          support: mockEvent.support
        }
      });
    });

    it('should handle ProposalExecuted events correctly', async () => {
      const mockEvent = {
        proposalId: BigInt(1),
        executor: '0x123',
        timestamp: BigInt(Date.now())
      };

      const callback = jest.fn();
      proposalService.on('ProposalExecuted', callback);

      // Simulate event
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalExecuted'
      )[1];
      await eventHandler(mockEvent);

      expect(callback).toHaveBeenCalledWith({
        proposalId: mockEvent.proposalId,
        timestamp: Number(mockEvent.timestamp),
        eventType: ProposalStatus.EXECUTED,
        data: {
          executor: mockEvent.executor
        }
      });
    });

    it('should handle ProposalCancelled events correctly', () => {
      const mockEvent = {
        proposalId: BigInt(1),
        canceller: '0x123',
        timestamp: BigInt(Date.now())
      };

      const callback = jest.fn();
      proposalService.on('ProposalCancelled', callback);

      // Simulate event
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalCancelled'
      )[1];
      eventHandler(mockEvent);

      expect(callback).toHaveBeenCalledWith({
        proposalId: mockEvent.proposalId,
        timestamp: Number(mockEvent.timestamp),
        eventType: ProposalStatus.CANCELLED,
        data: {
          canceller: mockEvent.canceller
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in event handlers gracefully', async () => {
      const mockEvent = {
        proposalId: BigInt(1),
        executor: '0x123',
        timestamp: BigInt(Date.now())
      };

      // Mock error in admin token distribution
      const mockError = new Error('Distribution failed');
      jest.spyOn(proposalService['adminTokenService'], 'distributeRewards')
        .mockRejectedValue(mockError);

      const callback = jest.fn();
      proposalService.on('ProposalExecuted', callback);

      // Simulate event
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalExecuted'
      )[1];
      await eventHandler(mockEvent);

      // Verify error was handled but event was still processed
      expect(callback).toHaveBeenCalled();
    });
  });
}); 