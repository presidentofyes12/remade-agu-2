import { ethers } from 'ethers';
import { ProposalService } from '../proposalService';
import { ProposalStatus } from '../../types/proposals';

jest.mock('ethers');

describe('ProposalService', () => {
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

  describe('Proposal Creation with Idea Attribution', () => {
    it('should register a new idea when creating an original proposal', async () => {
      const mockProposal = {
        id: BigInt(1),
        title: 'Test Proposal',
        description: 'Test Description',
        amount: BigInt(1000),
        recipient: '0x123',
        creator: '0x456',
        startTime: BigInt(Date.now()),
        endTime: BigInt(Date.now() + 86400000),
        executed: false,
        cancelled: false,
        votesFor: BigInt(0),
        votesAgainst: BigInt(0)
      };

      const mockIdea = {
        id: BigInt(1),
        title: 'Test Proposal',
        description: 'Test Description',
        creator: '0x456',
        hash: '0xabc',
        timestamp: BigInt(Date.now()),
        similarityScore: 0,
        royaltyRate: 1.8519,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      // Mock idea registration
      jest.spyOn(proposalService['ideaRegistryService'], 'registerIdea')
        .mockResolvedValue(mockIdea);

      // Mock proposal creation
      mockContract.createProposal.mockResolvedValue({ wait: jest.fn() });
      mockContract.getProposalCount.mockResolvedValue(BigInt(1));
      mockContract.getProposal.mockResolvedValue(mockProposal);

      const result = await proposalService.createProposal(
        'Test Proposal',
        'Test Description',
        BigInt(1000),
        '0x123',
        BigInt(86400000)
      );

      expect(result).toEqual(mockProposal);
      expect(proposalService['ideaRegistryService'].registerIdea)
        .toHaveBeenCalledWith(
          'Test Proposal',
          'Test Description',
          expect.any(String)
        );
    });

    it('should handle derivative proposals correctly', async () => {
      const mockProposal = {
        id: BigInt(2),
        title: 'Derivative Proposal',
        description: 'Derivative Description',
        amount: BigInt(1000),
        recipient: '0x123',
        creator: '0x456',
        startTime: BigInt(Date.now()),
        endTime: BigInt(Date.now() + 86400000),
        executed: false,
        cancelled: false,
        votesFor: BigInt(0),
        votesAgainst: BigInt(0)
      };

      const mockOriginalIdea = {
        id: BigInt(1),
        title: 'Original Idea',
        description: 'Original Description',
        creator: '0x789',
        hash: '0xdef',
        timestamp: BigInt(Date.now() - 86400000),
        similarityScore: 0.8,
        royaltyRate: 1.8519,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      const mockDerivativeIdea = {
        id: BigInt(2),
        title: 'Derivative Proposal',
        description: 'Derivative Description',
        creator: '0x456',
        hash: '0xabc',
        timestamp: BigInt(Date.now()),
        similarityScore: 0.8,
        royaltyRate: 1.8519,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      // Mock idea operations
      jest.spyOn(proposalService['ideaRegistryService'], 'registerIdea')
        .mockResolvedValue(mockDerivativeIdea);
      jest.spyOn(proposalService['ideaRegistryService'], 'getIdea')
        .mockResolvedValue(mockOriginalIdea);
      jest.spyOn(proposalService['ideaRegistryService'], 'calculateSimilarity')
        .mockResolvedValue(0.8);
      jest.spyOn(proposalService['ideaRegistryService'], 'calculateRoyaltyRate')
        .mockResolvedValue(1.5);
      jest.spyOn(proposalService['ideaRegistryService'], 'updateRoyaltyRate')
        .mockResolvedValue();

      // Mock proposal creation
      mockContract.createProposal.mockResolvedValue({ wait: jest.fn() });
      mockContract.getProposalCount.mockResolvedValue(BigInt(2));
      mockContract.getProposal.mockResolvedValue(mockProposal);

      const result = await proposalService.createProposal(
        'Derivative Proposal',
        'Derivative Description',
        BigInt(1000),
        '0x123',
        BigInt(86400000),
        BigInt(1)
      );

      expect(result).toEqual(mockProposal);
      expect(proposalService['ideaRegistryService'].calculateSimilarity)
        .toHaveBeenCalledWith(BigInt(1), BigInt(2));
      expect(proposalService['ideaRegistryService'].updateRoyaltyRate)
        .toHaveBeenCalledWith(BigInt(1), 1.5);
    });

    it('should handle idea registration errors gracefully', async () => {
      // Mock idea registration error
      jest.spyOn(proposalService['ideaRegistryService'], 'registerIdea')
        .mockRejectedValue(new Error('Registration failed'));

      // Mock proposal creation
      mockContract.createProposal.mockResolvedValue({ wait: jest.fn() });
      mockContract.getProposalCount.mockResolvedValue(BigInt(1));
      mockContract.getProposal.mockResolvedValue({
        id: BigInt(1),
        title: 'Test Proposal',
        description: 'Test Description',
        amount: BigInt(1000),
        recipient: '0x123',
        creator: '0x456',
        startTime: BigInt(Date.now()),
        endTime: BigInt(Date.now() + 86400000),
        executed: false,
        cancelled: false,
        votesFor: BigInt(0),
        votesAgainst: BigInt(0)
      });

      await expect(proposalService.createProposal(
        'Test Proposal',
        'Test Description',
        BigInt(1000),
        '0x123',
        BigInt(86400000)
      )).rejects.toThrow('Registration failed');
    });
  });

  // ... existing tests ...
}); 