import { IdeaRegistryService, IdeaState } from '../ideaRegistry';
import { KnowledgeDomainService, DomainState } from '../knowledgeDomain';
import { ethers } from 'ethers';

jest.mock('ethers');

describe('State Validation', () => {
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockSigner: jest.Mocked<ethers.Signer>;
  let ideaRegistryService: IdeaRegistryService;
  let knowledgeDomainService: KnowledgeDomainService;

  beforeEach(() => {
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

    ideaRegistryService = IdeaRegistryService.getInstance(
      '0x123',
      {
        minRoyaltyRate: 0.01,
        maxRoyaltyRate: 0.1,
        minSimilarityThreshold: 0.5,
        maxSimilarityThreshold: 1.0,
        analyticsUpdateInterval: 300000
      },
      mockProvider,
      mockSigner
    );

    knowledgeDomainService = KnowledgeDomainService.getInstance(
      '0x123',
      {
        minRelevanceScore: 0,
        maxRelevanceScore: 1,
        minInnovationScore: 0,
        maxInnovationScore: 1,
        defaultContributionThreshold: BigInt(1000),
        analyticsUpdateInterval: 300000
      },
      mockProvider,
      mockSigner
    );
  });

  describe('IdeaRegistryService State Validation', () => {
    const ideaId = BigInt(0);

    it('should prevent operations on non-registered ideas', async () => {
      await expect(ideaRegistryService.distributeRoyalties(ideaId))
        .rejects
        .toThrow('Idea 0 is not registered');

      await expect(ideaRegistryService.updateRoyaltyRate(ideaId, 0.05))
        .rejects
        .toThrow('Idea 0 is not registered');
    });

    it('should prevent concurrent operations on the same idea', async () => {
      // Mock the contract to simulate a long-running operation
      const mockTx = { wait: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))) };
      (ideaRegistryService as any).contract.distributeRoyalties.mockResolvedValueOnce(mockTx);

      // Start a distribution operation
      const distributePromise = ideaRegistryService.distributeRoyalties(ideaId);

      // Try to update the royalty rate while distribution is in progress
      await expect(ideaRegistryService.updateRoyaltyRate(ideaId, 0.05))
        .rejects
        .toThrow('Idea 0 is currently in DISTRIBUTING state and cannot be modified');

      await distributePromise;
    });

    it('should allow operations after previous operation completes', async () => {
      const mockTx = { wait: jest.fn().mockResolvedValue(undefined) };
      (ideaRegistryService as any).contract.distributeRoyalties.mockResolvedValueOnce(mockTx);

      // Complete a distribution operation
      await ideaRegistryService.distributeRoyalties(ideaId);

      // Should now be able to update royalty rate
      await expect(ideaRegistryService.updateRoyaltyRate(ideaId, 0.05))
        .resolves
        .not
        .toThrow();
    });
  });

  describe('KnowledgeDomainService State Validation', () => {
    const domainId = BigInt(0);

    it('should prevent operations on non-registered domains', async () => {
      await expect(knowledgeDomainService.updateDomainScores(domainId, 0.5, 0.5))
        .rejects
        .toThrow('Domain 0 is not registered');

      await expect(knowledgeDomainService.mapProposalToDomain(BigInt(1), domainId, true))
        .rejects
        .toThrow('Domain 0 is not registered');

      await expect(knowledgeDomainService.contributeToDomain(domainId, BigInt(100)))
        .rejects
        .toThrow('Domain 0 is not registered');
    });

    it('should prevent concurrent operations on the same domain', async () => {
      // Mock the contract to simulate a long-running operation
      const mockTx = { wait: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))) };
      (knowledgeDomainService as any).contract.updateDomainScores.mockResolvedValueOnce(mockTx);

      // Start an update operation
      const updatePromise = knowledgeDomainService.updateDomainScores(domainId, 0.5, 0.5);

      // Try to map a proposal while update is in progress
      await expect(knowledgeDomainService.mapProposalToDomain(BigInt(1), domainId, true))
        .rejects
        .toThrow('Domain 0 is currently in UPDATING state and cannot be modified');

      // Try to contribute while update is in progress
      await expect(knowledgeDomainService.contributeToDomain(domainId, BigInt(100)))
        .rejects
        .toThrow('Domain 0 is currently in UPDATING state and cannot be modified');

      await updatePromise;
    });

    it('should allow operations after previous operation completes', async () => {
      const mockTx = { wait: jest.fn().mockResolvedValue(undefined) };
      (knowledgeDomainService as any).contract.updateDomainScores.mockResolvedValueOnce(mockTx);

      // Complete an update operation
      await knowledgeDomainService.updateDomainScores(domainId, 0.5, 0.5);

      // Should now be able to map a proposal
      await expect(knowledgeDomainService.mapProposalToDomain(BigInt(1), domainId, true))
        .resolves
        .not
        .toThrow();

      // Should now be able to contribute
      await expect(knowledgeDomainService.contributeToDomain(domainId, BigInt(100)))
        .resolves
        .not
        .toThrow();
    });

    it('should handle errors and reset state', async () => {
      // Mock the contract to simulate an error
      (knowledgeDomainService as any).contract.updateDomainScores.mockRejectedValueOnce(new Error('Contract error'));

      // Attempt an operation that will fail
      await expect(knowledgeDomainService.updateDomainScores(domainId, 0.5, 0.5))
        .rejects
        .toThrow('Contract error');

      // Should be able to perform another operation after error
      await expect(knowledgeDomainService.mapProposalToDomain(BigInt(1), domainId, true))
        .resolves
        .not
        .toThrow();
    });
  });
}); 