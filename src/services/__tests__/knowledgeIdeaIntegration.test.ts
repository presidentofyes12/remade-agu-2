import { ethers } from 'ethers';
import { KnowledgeDomainService } from '../knowledgeDomain';
import { IdeaRegistryService } from '../ideaRegistry';

jest.mock('ethers');

describe('KnowledgeDomain and IdeaRegistry Integration', () => {
  let knowledgeDomainService: KnowledgeDomainService;
  let ideaRegistryService: IdeaRegistryService;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockSigner: jest.Mocked<ethers.Signer>;
  let mockContract: any;

  const mockAddresses = {
    logic: '0x456'
  };

  const mockKnowledgeConfig = {
    minRelevanceScore: 0,
    maxRelevanceScore: 1,
    minInnovationScore: 0,
    maxInnovationScore: 1,
    defaultContributionThreshold: BigInt(1000),
    analyticsUpdateInterval: 300000 // 5 minutes
  };

  const mockIdeaConfig = {
    minRoyaltyRate: 0.01,
    maxRoyaltyRate: 0.1,
    minSimilarityThreshold: 0.5,
    maxSimilarityThreshold: 1.0,
    analyticsUpdateInterval: 300000 // 5 minutes
  };

  beforeEach(() => {
    // Reset singleton instances
    (KnowledgeDomainService as any).instance = null;
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
      // Knowledge Domain methods
      registerDomain: jest.fn(),
      getDomain: jest.fn(),
      getDomainCount: jest.fn(),
      updateDomainScores: jest.fn(),
      mapProposalToDomain: jest.fn(),
      getDomainMappings: jest.fn(),
      getDomainAnalytics: jest.fn(),
      contributeToDomain: jest.fn(),
      // Idea Registry methods
      registerIdea: jest.fn(),
      getIdea: jest.fn(),
      getIdeaCount: jest.fn(),
      calculateSimilarity: jest.fn(),
      distributeRoyalties: jest.fn(),
      getRoyaltyRate: jest.fn(),
      updateRoyaltyRate: jest.fn()
    };

    // Initialize services
    knowledgeDomainService = KnowledgeDomainService.getInstance(
      mockAddresses.logic,
      mockKnowledgeConfig,
      mockProvider,
      mockSigner
    );

    ideaRegistryService = IdeaRegistryService.getInstance(
      mockAddresses.logic,
      mockIdeaConfig,
      mockProvider,
      mockSigner
    );
  });

  describe('Domain-Idea Mapping', () => {
    it('should register an idea and map it to a domain', async () => {
      // Setup mock domain
      const mockDomain = {
        id: BigInt(1),
        name: 'Test Domain',
        description: 'Test Description',
        parentId: null,
        relevanceScore: 0.5,
        innovationScore: 0.5,
        contributionThreshold: mockKnowledgeConfig.defaultContributionThreshold,
        totalContributions: BigInt(0),
        activeProposals: BigInt(0),
        timestamp: BigInt(Date.now())
      };

      // Setup mock idea
      const mockIdea = {
        id: BigInt(1),
        title: 'Test Idea',
        description: 'Test Description',
        creator: '0x123',
        hash: '0xabc',
        timestamp: BigInt(Date.now()),
        similarityScore: 0,
        royaltyRate: mockIdeaConfig.minRoyaltyRate,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      // Mock contract calls
      mockContract.registerDomain.mockResolvedValue({ wait: jest.fn() });
      mockContract.getDomainCount.mockResolvedValue(BigInt(1));
      mockContract.getDomain.mockResolvedValue(mockDomain);
      mockContract.registerIdea.mockResolvedValue({ wait: jest.fn() });
      mockContract.getIdeaCount.mockResolvedValue(BigInt(1));
      mockContract.getIdea.mockResolvedValue(mockIdea);
      mockContract.mapProposalToDomain.mockResolvedValue({ wait: jest.fn() });

      // Register domain
      const domain = await knowledgeDomainService.registerDomain(
        'Test Domain',
        'Test Description',
        null
      );

      // Register idea
      const idea = await ideaRegistryService.registerIdea(
        'Test Idea',
        'Test Description',
        '0xabc'
      );

      // Map idea to domain
      await knowledgeDomainService.mapProposalToDomain(
        idea.id,
        domain.id,
        true
      );

      expect(mockContract.mapProposalToDomain).toHaveBeenCalledWith(
        idea.id,
        domain.id,
        true
      );
    });

    it('should update domain scores when idea similarity changes', async () => {
      const mockDomain = {
        id: BigInt(1),
        name: 'Test Domain',
        description: 'Test Description',
        parentId: null,
        relevanceScore: 0.5,
        innovationScore: 0.5,
        contributionThreshold: mockKnowledgeConfig.defaultContributionThreshold,
        totalContributions: BigInt(0),
        activeProposals: BigInt(0),
        timestamp: BigInt(Date.now())
      };

      const mockIdea1 = {
        id: BigInt(1),
        title: 'Test Idea 1',
        description: 'Test Description 1',
        creator: '0x123',
        hash: '0xabc',
        timestamp: BigInt(Date.now()),
        similarityScore: 0.8,
        royaltyRate: mockIdeaConfig.minRoyaltyRate,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      const mockIdea2 = {
        id: BigInt(2),
        title: 'Test Idea 2',
        description: 'Test Description 2',
        creator: '0x456',
        hash: '0xdef',
        timestamp: BigInt(Date.now()),
        similarityScore: 0.9,
        royaltyRate: mockIdeaConfig.minRoyaltyRate,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      // Mock contract calls
      mockContract.getDomain.mockResolvedValue(mockDomain);
      mockContract.getIdea.mockImplementation((id: bigint) => {
        if (id === BigInt(1)) return mockIdea1;
        if (id === BigInt(2)) return mockIdea2;
        throw new Error('Idea not found');
      });
      mockContract.calculateSimilarity.mockResolvedValue(0.85);
      mockContract.updateDomainScores.mockResolvedValue({ wait: jest.fn() });

      // Calculate similarity between ideas
      const similarity = await ideaRegistryService.calculateSimilarity(
        mockIdea1.id,
        mockIdea2.id
      );

      // Update domain scores based on similarity
      await knowledgeDomainService.updateDomainScores(
        mockDomain.id,
        0.7, // New relevance score
        0.8  // New innovation score
      );

      expect(mockContract.updateDomainScores).toHaveBeenCalledWith(
        mockDomain.id,
        0.7,
        0.8
      );
    });
  });

  describe('Royalty Distribution with Domain Analytics', () => {
    it('should distribute royalties and update domain analytics', async () => {
      const mockDomain = {
        id: BigInt(1),
        name: 'Test Domain',
        description: 'Test Description',
        parentId: null,
        relevanceScore: 0.5,
        innovationScore: 0.5,
        contributionThreshold: mockKnowledgeConfig.defaultContributionThreshold,
        totalContributions: BigInt(0),
        activeProposals: BigInt(0),
        timestamp: BigInt(Date.now())
      };

      const mockIdea = {
        id: BigInt(1),
        title: 'Test Idea',
        description: 'Test Description',
        creator: '0x123',
        hash: '0xabc',
        timestamp: BigInt(Date.now()),
        similarityScore: 0.8,
        royaltyRate: 0.05,
        lastDistribution: 0,
        totalDistributed: BigInt(0)
      };

      const mockAnalytics = {
        domainId: BigInt(1),
        totalProposals: BigInt(10),
        activeProposals: BigInt(5),
        totalContributions: BigInt(1000),
        innovationScore: 0.7,
        growthRate: 0.1,
        crossDomainInnovations: BigInt(2)
      };

      // Mock contract calls
      mockContract.getDomain.mockResolvedValue(mockDomain);
      mockContract.getIdea.mockResolvedValue(mockIdea);
      mockContract.getDomainAnalytics.mockResolvedValue(mockAnalytics);
      mockContract.distributeRoyalties.mockResolvedValue({ wait: jest.fn() });

      // Distribute royalties
      await ideaRegistryService.distributeRoyalties(mockIdea.id);

      // Get updated analytics
      const analytics = await knowledgeDomainService.getDomainAnalytics(mockDomain.id);

      expect(mockContract.distributeRoyalties).toHaveBeenCalledWith(mockIdea.id);
      expect(mockContract.getDomainAnalytics).toHaveBeenCalledWith(mockDomain.id);
      expect(analytics).toEqual(mockAnalytics);
    });
  });

  describe('Event Handling Integration', () => {
    it('should handle domain and idea events together', () => {
      const domainCallback = jest.fn();
      const ideaCallback = jest.fn();

      // Register event listeners
      knowledgeDomainService.on('DomainRegistered', domainCallback);
      ideaRegistryService.on('IdeaRegistered', ideaCallback);

      // Simulate events
      const domainEvent = {
        domainId: BigInt(1),
        name: 'Test Domain',
        timestamp: BigInt(Date.now())
      };

      const ideaEvent = {
        ideaId: BigInt(1),
        title: 'Test Idea',
        timestamp: BigInt(Date.now())
      };

      // Trigger event handlers
      const domainHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'DomainRegistered'
      )[1];
      const ideaHandler = mockContract.on.mock.calls.find(
        call => call[0] === 'IdeaRegistered'
      )[1];

      domainHandler(domainEvent);
      ideaHandler(ideaEvent);

      expect(domainCallback).toHaveBeenCalledWith(domainEvent);
      expect(ideaCallback).toHaveBeenCalledWith(ideaEvent);
    });
  });
}); 