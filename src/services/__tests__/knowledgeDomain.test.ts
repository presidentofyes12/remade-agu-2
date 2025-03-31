import { ethers } from 'ethers';
import { KnowledgeDomainService } from '../knowledgeDomain';

jest.mock('ethers');

describe('KnowledgeDomainService', () => {
  let knowledgeDomainService: KnowledgeDomainService;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockSigner: jest.Mocked<ethers.Signer>;
  let mockContract: any;

  const mockAddresses = {
    logic: '0x456'
  };

  const mockConfig = {
    minRelevanceScore: 0,
    maxRelevanceScore: 1,
    minInnovationScore: 0,
    maxInnovationScore: 1,
    defaultContributionThreshold: BigInt(1000),
    analyticsUpdateInterval: 300000 // 5 minutes
  };

  beforeEach(() => {
    // Reset singleton instance
    (KnowledgeDomainService as any).instance = null;

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
      registerDomain: jest.fn(),
      getDomain: jest.fn(),
      getDomainCount: jest.fn(),
      updateDomainScores: jest.fn(),
      mapProposalToDomain: jest.fn(),
      getDomainMappings: jest.fn(),
      getDomainAnalytics: jest.fn(),
      contributeToDomain: jest.fn()
    };

    // Initialize service
    knowledgeDomainService = KnowledgeDomainService.getInstance(
      mockAddresses.logic,
      mockConfig,
      mockProvider,
      mockSigner
    );
  });

  describe('Domain Registration', () => {
    it('should register a new domain successfully', async () => {
      const mockDomain = {
        id: BigInt(1),
        name: 'Test Domain',
        description: 'Test Description',
        parentId: null,
        relevanceScore: 0.5,
        innovationScore: 0.5,
        contributionThreshold: mockConfig.defaultContributionThreshold,
        totalContributions: BigInt(0),
        activeProposals: BigInt(0),
        timestamp: BigInt(Date.now())
      };

      mockContract.registerDomain.mockResolvedValue({ wait: jest.fn() });
      mockContract.getDomainCount.mockResolvedValue(BigInt(1));
      mockContract.getDomain.mockResolvedValue(mockDomain);

      const result = await knowledgeDomainService.registerDomain(
        'Test Domain',
        'Test Description',
        null
      );

      expect(result).toEqual(mockDomain);
      expect(mockContract.registerDomain).toHaveBeenCalledWith(
        'Test Domain',
        'Test Description',
        null,
        mockConfig.defaultContributionThreshold
      );
    });

    it('should register a subdomain successfully', async () => {
      const mockDomain = {
        id: BigInt(2),
        name: 'Test Subdomain',
        description: 'Test Description',
        parentId: BigInt(1),
        relevanceScore: 0.5,
        innovationScore: 0.5,
        contributionThreshold: mockConfig.defaultContributionThreshold,
        totalContributions: BigInt(0),
        activeProposals: BigInt(0),
        timestamp: BigInt(Date.now())
      };

      mockContract.registerDomain.mockResolvedValue({ wait: jest.fn() });
      mockContract.getDomainCount.mockResolvedValue(BigInt(2));
      mockContract.getDomain.mockResolvedValue(mockDomain);

      const result = await knowledgeDomainService.registerDomain(
        'Test Subdomain',
        'Test Description',
        BigInt(1)
      );

      expect(result).toEqual(mockDomain);
      expect(mockContract.registerDomain).toHaveBeenCalledWith(
        'Test Subdomain',
        'Test Description',
        BigInt(1),
        mockConfig.defaultContributionThreshold
      );
    });
  });

  describe('Domain Retrieval', () => {
    it('should retrieve a domain from cache if available', async () => {
      const mockDomain = {
        id: BigInt(1),
        name: 'Test Domain',
        description: 'Test Description',
        parentId: null,
        relevanceScore: 0.5,
        innovationScore: 0.5,
        contributionThreshold: mockConfig.defaultContributionThreshold,
        totalContributions: BigInt(0),
        activeProposals: BigInt(0),
        timestamp: BigInt(Date.now())
      };

      // First call - should hit the contract
      mockContract.getDomain.mockResolvedValue(mockDomain);
      await knowledgeDomainService.getDomain(BigInt(1));

      // Second call - should use cache
      mockContract.getDomain.mockClear();
      const result = await knowledgeDomainService.getDomain(BigInt(1));

      expect(result).toEqual(mockDomain);
      expect(mockContract.getDomain).not.toHaveBeenCalled();
    });

    it('should refresh cache after expiration', async () => {
      const mockDomain = {
        id: BigInt(1),
        name: 'Test Domain',
        description: 'Test Description',
        parentId: null,
        relevanceScore: 0.5,
        innovationScore: 0.5,
        contributionThreshold: mockConfig.defaultContributionThreshold,
        totalContributions: BigInt(0),
        activeProposals: BigInt(0),
        timestamp: BigInt(Date.now())
      };

      // First call
      mockContract.getDomain.mockResolvedValue(mockDomain);
      await knowledgeDomainService.getDomain(BigInt(1));

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 61000));

      // Second call - should hit the contract again
      const updatedDomain = { ...mockDomain, name: 'Updated Domain' };
      mockContract.getDomain.mockResolvedValue(updatedDomain);
      const result = await knowledgeDomainService.getDomain(BigInt(1));

      expect(result).toEqual(updatedDomain);
      expect(mockContract.getDomain).toHaveBeenCalledTimes(2);
    });
  });

  describe('Domain Scores', () => {
    it('should update domain scores successfully', async () => {
      mockContract.updateDomainScores.mockResolvedValue({ wait: jest.fn() });

      await knowledgeDomainService.updateDomainScores(
        BigInt(1),
        0.8,
        0.7
      );

      expect(mockContract.updateDomainScores).toHaveBeenCalledWith(
        BigInt(1),
        0.8,
        0.7
      );
    });

    it('should validate score ranges', async () => {
      await expect(knowledgeDomainService.updateDomainScores(
        BigInt(1),
        1.5, // Invalid relevance score
        0.7
      )).rejects.toThrow('Invalid relevance score');

      await expect(knowledgeDomainService.updateDomainScores(
        BigInt(1),
        0.8,
        1.5 // Invalid innovation score
      )).rejects.toThrow('Invalid innovation score');
    });
  });

  describe('Domain Mappings', () => {
    it('should map proposal to domain successfully', async () => {
      mockContract.mapProposalToDomain.mockResolvedValue({ wait: jest.fn() });

      await knowledgeDomainService.mapProposalToDomain(
        BigInt(1),
        BigInt(1),
        true
      );

      expect(mockContract.mapProposalToDomain).toHaveBeenCalledWith(
        BigInt(1),
        BigInt(1),
        true
      );
    });

    it('should retrieve domain mappings for a proposal', async () => {
      const mockMappings = [
        {
          domainId: BigInt(1),
          proposalId: BigInt(1),
          isPrimary: true,
          relevanceScore: 0.8,
          timestamp: BigInt(Date.now())
        }
      ];

      mockContract.getDomainMappings.mockResolvedValue(mockMappings);

      const result = await knowledgeDomainService.getDomainMappings(BigInt(1));

      expect(result).toEqual(mockMappings);
      expect(mockContract.getDomainMappings).toHaveBeenCalledWith(BigInt(1));
    });
  });

  describe('Domain Analytics', () => {
    it('should retrieve domain analytics from cache if available', async () => {
      const mockAnalytics = {
        domainId: BigInt(1),
        totalProposals: BigInt(10),
        activeProposals: BigInt(5),
        totalContributions: BigInt(1000),
        innovationScore: 0.7,
        growthRate: 0.1,
        crossDomainInnovations: BigInt(2)
      };

      // First call - should hit the contract
      mockContract.getDomainAnalytics.mockResolvedValue(mockAnalytics);
      await knowledgeDomainService.getDomainAnalytics(BigInt(1));

      // Second call - should use cache
      mockContract.getDomainAnalytics.mockClear();
      const result = await knowledgeDomainService.getDomainAnalytics(BigInt(1));

      expect(result).toEqual(mockAnalytics);
      expect(mockContract.getDomainAnalytics).not.toHaveBeenCalled();
    });

    it('should refresh analytics cache after expiration', async () => {
      const mockAnalytics = {
        domainId: BigInt(1),
        totalProposals: BigInt(10),
        activeProposals: BigInt(5),
        totalContributions: BigInt(1000),
        innovationScore: 0.7,
        growthRate: 0.1,
        crossDomainInnovations: BigInt(2)
      };

      // First call
      mockContract.getDomainAnalytics.mockResolvedValue(mockAnalytics);
      await knowledgeDomainService.getDomainAnalytics(BigInt(1));

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, mockConfig.analyticsUpdateInterval + 1000));

      // Second call - should hit the contract again
      const updatedAnalytics = { ...mockAnalytics, totalProposals: BigInt(11) };
      mockContract.getDomainAnalytics.mockResolvedValue(updatedAnalytics);
      const result = await knowledgeDomainService.getDomainAnalytics(BigInt(1));

      expect(result).toEqual(updatedAnalytics);
      expect(mockContract.getDomainAnalytics).toHaveBeenCalledTimes(2);
    });
  });

  describe('Domain Contributions', () => {
    it('should contribute to domain successfully', async () => {
      mockContract.contributeToDomain.mockResolvedValue({ wait: jest.fn() });

      await knowledgeDomainService.contributeToDomain(
        BigInt(1),
        BigInt(1000)
      );

      expect(mockContract.contributeToDomain).toHaveBeenCalledWith(
        BigInt(1),
        BigInt(1000)
      );
    });
  });

  describe('Event Handling', () => {
    it('should handle domain registration events', () => {
      const callback = jest.fn();
      knowledgeDomainService.on('DomainRegistered', callback);

      expect(mockContract.on).toHaveBeenCalledWith('DomainRegistered', expect.any(Function));
    });

    it('should handle domain update events', () => {
      const callback = jest.fn();
      knowledgeDomainService.on('DomainUpdated', callback);

      expect(mockContract.on).toHaveBeenCalledWith('DomainUpdated', expect.any(Function));
    });

    it('should handle domain mapping events', () => {
      const callback = jest.fn();
      knowledgeDomainService.on('DomainMapped', callback);

      expect(mockContract.on).toHaveBeenCalledWith('DomainMapped', expect.any(Function));
    });

    it('should handle domain contribution events', () => {
      const callback = jest.fn();
      knowledgeDomainService.on('DomainContribution', callback);

      expect(mockContract.on).toHaveBeenCalledWith('DomainContribution', expect.any(Function));
    });
  });
}); 