import { ethers } from 'ethers';
import { IdeaRegistryService } from '../ideaRegistry';

jest.mock('ethers');

describe('IdeaRegistryService', () => {
  let ideaRegistryService: IdeaRegistryService;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockSigner: jest.Mocked<ethers.Signer>;
  let mockContract: any;

  const mockAddresses = {
    logic: '0x456'
  };

  const mockConfig = {
    minRoyaltyRate: 0.01,
    maxRoyaltyRate: 0.1,
    minSimilarityThreshold: 0.5,
    maxSimilarityThreshold: 1.0,
    analyticsUpdateInterval: 300000 // 5 minutes
  };

  beforeEach(() => {
    // Reset singleton instance
    (IdeaRegistryService as any).instance = null;

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
      registerIdea: jest.fn(),
      getIdea: jest.fn(),
      getIdeaCount: jest.fn(),
      calculateSimilarity: jest.fn(),
      distributeRoyalties: jest.fn(),
      getRoyaltyRate: jest.fn(),
      updateRoyaltyRate: jest.fn()
    };

    // Initialize service
    ideaRegistryService = IdeaRegistryService.getInstance(
      mockAddresses.logic,
      mockConfig,
      mockProvider,
      mockSigner
    );
  });

  describe('Idea Registration', () => {
    it('should register a new idea successfully', async () => {
      const mockIdea = {
        id: BigInt(1),
        title: 'Test Idea',
        description: 'Test Description',
        creator: '0x123',
        hash: '0xabc',
        timestamp: BigInt(Date.now()),
        similarityScore: 0,
        royaltyRate: mockConfig.minRoyaltyRate,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      mockContract.registerIdea.mockResolvedValue({ wait: jest.fn() });
      mockContract.getIdeaCount.mockResolvedValue(BigInt(1));
      mockContract.getIdea.mockResolvedValue(mockIdea);

      const result = await ideaRegistryService.registerIdea(
        'Test Idea',
        'Test Description',
        '0xabc'
      );

      expect(result).toEqual(mockIdea);
      expect(mockContract.registerIdea).toHaveBeenCalledWith(
        'Test Idea',
        'Test Description',
        '0xabc'
      );
    });

    it('should handle registration errors gracefully', async () => {
      mockContract.registerIdea.mockRejectedValue(new Error('Registration failed'));

      await expect(ideaRegistryService.registerIdea(
        'Test Idea',
        'Test Description',
        '0xabc'
      )).rejects.toThrow('Registration failed');
    });
  });

  describe('Idea Retrieval', () => {
    it('should retrieve an idea from cache if available', async () => {
      const mockIdea = {
        id: BigInt(1),
        title: 'Test Idea',
        description: 'Test Description',
        creator: '0x123',
        hash: '0xabc',
        timestamp: BigInt(Date.now()),
        similarityScore: 0,
        royaltyRate: mockConfig.minRoyaltyRate,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      // First call - should hit the contract
      mockContract.getIdea.mockResolvedValue(mockIdea);
      await ideaRegistryService.getIdea(BigInt(1));

      // Second call - should use cache
      mockContract.getIdea.mockClear();
      const result = await ideaRegistryService.getIdea(BigInt(1));

      expect(result).toEqual(mockIdea);
      expect(mockContract.getIdea).not.toHaveBeenCalled();
    });

    it('should refresh cache after expiration', async () => {
      const mockIdea = {
        id: BigInt(1),
        title: 'Test Idea',
        description: 'Test Description',
        creator: '0x123',
        hash: '0xabc',
        timestamp: BigInt(Date.now()),
        similarityScore: 0,
        royaltyRate: mockConfig.minRoyaltyRate,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      // First call
      mockContract.getIdea.mockResolvedValue(mockIdea);
      await ideaRegistryService.getIdea(BigInt(1));

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 61000));

      // Second call - should hit the contract again
      const updatedIdea = { ...mockIdea, title: 'Updated Idea' };
      mockContract.getIdea.mockResolvedValue(updatedIdea);
      const result = await ideaRegistryService.getIdea(BigInt(1));

      expect(result).toEqual(updatedIdea);
      expect(mockContract.getIdea).toHaveBeenCalledTimes(2);
    });
  });

  describe('Similarity Calculation', () => {
    it('should calculate similarity between ideas', async () => {
      mockContract.calculateSimilarity.mockResolvedValue(0.8);

      const result = await ideaRegistryService.calculateSimilarity(
        BigInt(1),
        BigInt(2)
      );

      expect(result).toBe(0.8);
      expect(mockContract.calculateSimilarity).toHaveBeenCalledWith(
        BigInt(1),
        BigInt(2)
      );
    });

    it('should handle similarity calculation errors', async () => {
      mockContract.calculateSimilarity.mockRejectedValue(new Error('Calculation failed'));

      const similarity = await ideaRegistryService.calculateSimilarity(
        BigInt(1),
        BigInt(2)
      );

      expect(similarity).toBe(0);
    });
  });

  describe('Royalty Management', () => {
    it('should distribute royalties successfully', async () => {
      mockContract.distributeRoyalties.mockResolvedValue({ wait: jest.fn() });

      await ideaRegistryService.distributeRoyalties(BigInt(1));

      expect(mockContract.distributeRoyalties).toHaveBeenCalledWith(BigInt(1));
    });

    it('should get royalty rate', async () => {
      mockContract.getRoyaltyRate.mockResolvedValue(0.05);

      const result = await ideaRegistryService.getRoyaltyRate(BigInt(1));

      expect(result).toBe(0.05);
      expect(mockContract.getRoyaltyRate).toHaveBeenCalledWith(BigInt(1));
    });

    it('should update royalty rate successfully', async () => {
      mockContract.updateRoyaltyRate.mockResolvedValue({ wait: jest.fn() });

      await ideaRegistryService.updateRoyaltyRate(BigInt(1), 0.05);

      expect(mockContract.updateRoyaltyRate).toHaveBeenCalledWith(
        BigInt(1),
        0.05
      );
    });

    it('should validate royalty rate range', async () => {
      await expect(ideaRegistryService.updateRoyaltyRate(
        BigInt(1),
        0.15 // Invalid rate above max
      )).rejects.toThrow('Invalid royalty rate');

      await expect(ideaRegistryService.updateRoyaltyRate(
        BigInt(1),
        0.005 // Invalid rate below min
      )).rejects.toThrow('Invalid royalty rate');
    });
  });

  describe('Event Handling', () => {
    it('should handle idea registration events', () => {
      const callback = jest.fn();
      ideaRegistryService.on('IdeaRegistered', callback);

      expect(mockContract.on).toHaveBeenCalledWith('IdeaRegistered', expect.any(Function));
    });

    it('should handle idea reuse events', () => {
      const callback = jest.fn();
      ideaRegistryService.on('IdeaReused', callback);

      expect(mockContract.on).toHaveBeenCalledWith('IdeaReused', expect.any(Function));
    });

    it('should handle royalty distribution events', () => {
      const callback = jest.fn();
      ideaRegistryService.on('RoyaltyDistributed', callback);

      expect(mockContract.on).toHaveBeenCalledWith('RoyaltyDistributed', expect.any(Function));
    });
  });
}); 