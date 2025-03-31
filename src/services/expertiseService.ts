import { ethers } from 'ethers';
import { ExpertiseContract, ExpertiseProfile, EncryptedScore, BlindReview, ExpertiseProof, ExpertiseMatchingConfig, ExpertiseEvents } from '../types/expertise';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';
import { KnowledgeDomainService } from './knowledgeDomain';
import { ProposalService } from './proposalService';

export class ExpertiseService {
  private static instance: ExpertiseService;
  private contract: ExpertiseContract;
  private knowledgeDomainService: KnowledgeDomainService;
  private proposalService: ProposalService;
  private eventListeners: Map<keyof ExpertiseEvents, Set<(event: any) => void>>;
  private config: ExpertiseMatchingConfig;

  private constructor(
    logicAddress: string,
    stateAddress: string,
    viewAddress: string,
    config: ExpertiseMatchingConfig,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.config = config;
    this.eventListeners = new Map();
    
    // Initialize contracts
    this.contract = {
      address: logicAddress,
      provider,
      signer,
      createProfile: jest.fn(),
      updateExpertise: jest.fn(),
      getProfile: jest.fn(),
      submitReview: jest.fn(),
      getProposalReviews: jest.fn(),
      verifyExpertise: jest.fn(),
      getExpertiseScore: jest.fn(),
      checkRateLimit: jest.fn(),
      detectAnomalies: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as ExpertiseContract;

    // Initialize services
    this.knowledgeDomainService = KnowledgeDomainService.getInstance(
      logicAddress,
      {
        minRelevanceScore: 0,
        maxRelevanceScore: 1,
        minInnovationScore: 0,
        maxInnovationScore: 1,
        defaultContributionThreshold: BigInt(1000),
        analyticsUpdateInterval: 300000
      },
      provider,
      signer
    );

    this.proposalService = ProposalService.getInstance(
      process.env.REACT_APP_TOKEN_ADDRESS || '',
      logicAddress,
      stateAddress,
      viewAddress,
      provider,
      signer
    );

    this.setupEventListeners();
  }

  public static getInstance(
    logicAddress: string,
    stateAddress: string,
    viewAddress: string,
    config: ExpertiseMatchingConfig,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ): ExpertiseService {
    if (!ExpertiseService.instance) {
      ExpertiseService.instance = new ExpertiseService(
        logicAddress,
        stateAddress,
        viewAddress,
        config,
        provider,
        signer
      );
    }
    return ExpertiseService.instance;
  }

  private setupEventListeners(): void {
    // Handle profile creation
    this.contract.on('ProfileCreated', (event: ExpertiseEvents['ProfileCreated']) => {
      const listeners = this.eventListeners.get('ProfileCreated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle profile updates
    this.contract.on('ProfileUpdated', (event: ExpertiseEvents['ProfileUpdated']) => {
      const listeners = this.eventListeners.get('ProfileUpdated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle review submissions
    this.contract.on('ReviewSubmitted', (event: ExpertiseEvents['ReviewSubmitted']) => {
      const listeners = this.eventListeners.get('ReviewSubmitted');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle expertise verification
    this.contract.on('ExpertiseVerified', (event: ExpertiseEvents['ExpertiseVerified']) => {
      const listeners = this.eventListeners.get('ExpertiseVerified');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle anomaly detection
    this.contract.on('AnomalyDetected', (event: ExpertiseEvents['AnomalyDetected']) => {
      const listeners = this.eventListeners.get('AnomalyDetected');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });
  }

  public async createProfile(pseudonym: string): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.createProfile(pseudonym);
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async updateExpertise(
    pseudonym: string,
    domainId: bigint,
    score: number
  ): Promise<void> {
    try {
      // Encrypt the score
      const encryptedScore = await this.encryptScore(score, domainId);

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.updateExpertise(
          pseudonym,
          domainId,
          encryptedScore
        );
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async submitReview(
    proposalId: bigint,
    reviewerPseudonym: string,
    content: string,
    rating: number,
    domainId: bigint
  ): Promise<void> {
    try {
      // Check rate limits
      const withinRateLimit = await this.contract.checkRateLimit(reviewerPseudonym);
      if (!withinRateLimit) {
        throw new Error('Rate limit exceeded');
      }

      // Encrypt the rating
      const encryptedRating = await this.encryptScore(rating, domainId);

      // Generate expertise proof
      const expertiseProof = await this.generateExpertiseProof(
        reviewerPseudonym,
        domainId
      );

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.submitReview(
          proposalId,
          reviewerPseudonym,
          content,
          encryptedRating,
          expertiseProof
        );
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async getProposalReviews(proposalId: bigint): Promise<BlindReview[]> {
    try {
      const result = await retryMechanism.executeWithRetry<BlindReview[]>(async () => {
        return await this.contract.getProposalReviews(proposalId);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async getProfile(pseudonym: string): Promise<ExpertiseProfile | null> {
    try {
      const result = await retryMechanism.executeWithRetry<ExpertiseProfile | null>(async () => {
        return await this.contract.getProfile(pseudonym);
      });

      if (!result.success) {
        throw result.error;
      }

      return result.result ?? null;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async verifyExpertise(
    pseudonym: string,
    domainId: bigint,
    proof: ExpertiseProof
  ): Promise<boolean> {
    try {
      const result = await retryMechanism.executeWithRetry<boolean>(async () => {
        return await this.contract.verifyExpertise(pseudonym, domainId, proof);
      });

      if (!result.success || result.result === undefined) {
        throw result.error;
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async getExpertiseScore(
    pseudonym: string,
    domainId: bigint
  ): Promise<EncryptedScore> {
    try {
      const result = await retryMechanism.executeWithRetry<EncryptedScore>(async () => {
        return await this.contract.getExpertiseScore(pseudonym, domainId);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  private async encryptScore(score: number, domainId: bigint): Promise<EncryptedScore> {
    // Generate a random nonce
    const nonce = ethers.Wallet.createRandom().address;

    // Encrypt the score using the nonce
    const value = ethers.keccak256(
      ethers.solidityPacked(
        ['uint256', 'uint256', 'string'],
        [BigInt(score), domainId, nonce]
      )
    );

    return {
      value,
      nonce,
      domainId,
      timestamp: BigInt(Date.now())
    };
  }

  private async generateExpertiseProof(
    pseudonym: string,
    domainId: bigint
  ): Promise<ExpertiseProof> {
    // Get the expertise score
    const score = await this.getExpertiseScore(pseudonym, domainId);

    // Generate a commitment to the score
    const scoreCommitment = ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'uint256'],
        [score.value, score.timestamp]
      )
    );

    // Generate a range proof (simplified for this example)
    const rangeProof = ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'uint256', 'uint256'],
        [score.value, BigInt(this.config.minExpertiseScore), BigInt(100)]
      )
    );

    return {
      scoreCommitment,
      rangeProof,
      domainId,
      timestamp: BigInt(Date.now())
    };
  }

  public on<K extends keyof ExpertiseEvents>(
    event: K,
    callback: (event: ExpertiseEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }

  public off<K extends keyof ExpertiseEvents>(
    event: K,
    callback: (event: ExpertiseEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(callback);
  }
} 