import { ethers } from 'ethers';
import { ProposalService } from '../proposalService';
import { AdminTokenDistributionService } from '../adminTokenDistribution';
import { ProposalStatus } from '../../types/proposals';

jest.mock('ethers');

describe('ProposalService and AdminTokenDistributionService Integration', () => {
  let proposalService: ProposalService;
  let adminTokenService: AdminTokenDistributionService;
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
    // Reset singleton instances
    (ProposalService as any).instance = null;
    (AdminTokenDistributionService as any).instance = null;

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

    // Initialize services
    proposalService = ProposalService.getInstance(
      mockAddresses.token,
      mockAddresses.logic,
      mockAddresses.state,
      mockAddresses.view,
      mockProvider,
      mockSigner
    );

    adminTokenService = AdminTokenDistributionService.getInstance(
      mockAddresses.token,
      mockAddresses.logic,
      mockAddresses.state,
      mockAddresses.view,
      {
        allocationPercentage: 7.407407407,
        distributionInterval: 86400000,
        weights: {
          relayUptime: 0.6,
          usersServed: 0.4,
          governanceActivity: 1.0
        }
      },
      mockProvider,
      mockSigner
    );
  });

  describe('Proposal Execution and Reward Distribution', () => {
    it('should distribute rewards after successful proposal execution', async () => {
      const mockEvent = {
        proposalId: BigInt(1),
        executor: '0x123',
        timestamp: BigInt(Date.now())
      };

      // Mock successful reward distribution
      jest.spyOn(adminTokenService, 'distributeRewards').mockResolvedValue();

      const callback = jest.fn();
      proposalService.on('ProposalExecuted', callback);

      // Simulate proposal execution event
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalExecuted'
      )[1];
      await eventHandler(mockEvent);

      // Verify reward distribution was called
      expect(adminTokenService.distributeRewards).toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
    });

    it('should handle failed reward distribution gracefully', async () => {
      const mockEvent = {
        proposalId: BigInt(1),
        executor: '0x123',
        timestamp: BigInt(Date.now())
      };

      // Mock failed reward distribution
      const mockError = new Error('Distribution failed');
      jest.spyOn(adminTokenService, 'distributeRewards')
        .mockRejectedValue(mockError);

      const callback = jest.fn();
      proposalService.on('ProposalExecuted', callback);

      // Simulate proposal execution event
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalExecuted'
      )[1];
      await eventHandler(mockEvent);

      // Verify event was still processed despite distribution failure
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Proposal Lifecycle and Reward Calculation', () => {
    it('should update governance activity metrics after proposal creation', async () => {
      const mockEvent = {
        proposalId: BigInt(1),
        title: 'Test Proposal',
        creator: '0x123',
        timestamp: BigInt(Date.now())
      };

      // Mock governance activity calculation
      jest.spyOn(adminTokenService, 'getGovernanceActivity')
        .mockResolvedValue(0.8);

      const callback = jest.fn();
      proposalService.on('ProposalCreated', callback);

      // Simulate proposal creation event
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalCreated'
      )[1];
      eventHandler(mockEvent);

      // Verify governance activity was updated
      expect(adminTokenService.getGovernanceActivity).toHaveBeenCalledWith('0x123');
      expect(callback).toHaveBeenCalled();
    });

    it('should update governance activity metrics after proposal voting', async () => {
      const mockEvent = {
        proposalId: BigInt(1),
        voter: '0x123',
        support: true,
        timestamp: BigInt(Date.now())
      };

      // Mock governance activity calculation
      jest.spyOn(adminTokenService, 'getGovernanceActivity')
        .mockResolvedValue(0.8);

      const callback = jest.fn();
      proposalService.on('ProposalVoted', callback);

      // Simulate proposal voting event
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalVoted'
      )[1];
      eventHandler(mockEvent);

      // Verify governance activity was updated
      expect(adminTokenService.getGovernanceActivity).toHaveBeenCalledWith('0x123');
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple proposal executions correctly', async () => {
      const mockEvents = [
        {
          proposalId: BigInt(1),
          executor: '0x123',
          timestamp: BigInt(Date.now())
        },
        {
          proposalId: BigInt(2),
          executor: '0x456',
          timestamp: BigInt(Date.now() + 1000)
        }
      ];

      // Mock successful reward distributions
      jest.spyOn(adminTokenService, 'distributeRewards').mockResolvedValue();

      const callback = jest.fn();
      proposalService.on('ProposalExecuted', callback);

      // Simulate multiple proposal execution events
      const eventHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'ProposalExecuted'
      )[1];
      
      await Promise.all(mockEvents.map(event => eventHandler(event)));

      // Verify reward distribution was called for each execution
      expect(adminTokenService.distributeRewards).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });
}); 