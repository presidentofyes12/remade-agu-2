import { ethers } from 'ethers';
import { DAOContract, KnowledgeDomain, DomainMapping, DomainAnalytics, KnowledgeDomainEvents } from '../types/contracts';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';

export interface KnowledgeDomainConfig {
  minRelevanceScore: number;
  maxRelevanceScore: number;
  minInnovationScore: number;
  maxInnovationScore: number;
  defaultContributionThreshold: bigint;
  analyticsUpdateInterval: number;
}

export enum DomainState {
  REGISTERED = 'REGISTERED',
  UPDATING = 'UPDATING',
  MAPPING = 'MAPPING',
  CONTRIBUTING = 'CONTRIBUTING'
}

export class KnowledgeDomainService {
  private static instance: KnowledgeDomainService;
  private contract: DAOContract;
  private config: KnowledgeDomainConfig;
  private domainCache: Map<bigint, { data: KnowledgeDomain; timestamp: number }>;
  private analyticsCache: Map<bigint, { data: DomainAnalytics; timestamp: number }>;
  private domainStates: Map<bigint, DomainState>;

  private constructor(
    logicAddress: string,
    config: KnowledgeDomainConfig,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.config = config;
    this.domainCache = new Map();
    this.analyticsCache = new Map();
    this.domainStates = new Map();

    // Initialize contract
    this.contract = {
      address: logicAddress,
      provider,
      signer,
      registerDomain: jest.fn(),
      getDomain: jest.fn(),
      getDomainCount: jest.fn(),
      updateDomainScores: jest.fn(),
      mapProposalToDomain: jest.fn(),
      getDomainMappings: jest.fn(),
      getDomainAnalytics: jest.fn(),
      contributeToDomain: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as DAOContract;

    this.setupEventListeners();
  }

  public static getInstance(
    logicAddress: string,
    config: KnowledgeDomainConfig,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ): KnowledgeDomainService {
    if (!KnowledgeDomainService.instance) {
      KnowledgeDomainService.instance = new KnowledgeDomainService(
        logicAddress,
        config,
        provider,
        signer
      );
    }
    return KnowledgeDomainService.instance;
  }

  private setupEventListeners(): void {
    // Handle domain registration
    this.contract.on('DomainRegistered', (event: KnowledgeDomainEvents['DomainRegistered']) => {
      this.invalidateDomainCache(event.domainId);
    });

    // Handle domain updates
    this.contract.on('DomainUpdated', (event: KnowledgeDomainEvents['DomainUpdated']) => {
      this.invalidateDomainCache(event.domainId);
      this.invalidateAnalyticsCache(event.domainId);
    });

    // Handle domain mappings
    this.contract.on('DomainMapped', (event: KnowledgeDomainEvents['DomainMapped']) => {
      this.invalidateAnalyticsCache(event.domainId);
    });

    // Handle domain contributions
    this.contract.on('DomainContribution', (event: KnowledgeDomainEvents['DomainContribution']) => {
      this.invalidateDomainCache(event.domainId);
      this.invalidateAnalyticsCache(event.domainId);
    });
  }

  private invalidateDomainCache(domainId: bigint): void {
    this.domainCache.delete(domainId);
  }

  private invalidateAnalyticsCache(domainId: bigint): void {
    this.analyticsCache.delete(domainId);
  }

  private validateDomainState(domainId: bigint, requiredState: DomainState): void {
    const currentState = this.domainStates.get(domainId);
    if (currentState === DomainState.UPDATING || 
        currentState === DomainState.MAPPING || 
        currentState === DomainState.CONTRIBUTING) {
      throw new Error(`Domain ${domainId} is currently in ${currentState} state and cannot be modified`);
    }
    if (requiredState === DomainState.REGISTERED && !currentState) {
      throw new Error(`Domain ${domainId} is not registered`);
    }
  }

  private setDomainState(domainId: bigint, state: DomainState): void {
    this.domainStates.set(domainId, state);
  }

  public async registerDomain(
    name: string,
    description: string,
    parentId: bigint | null,
    contributionThreshold: bigint = this.config.defaultContributionThreshold
  ): Promise<KnowledgeDomain> {
    try {
      const result = await retryMechanism.executeWithRetry<KnowledgeDomain>(async () => {
        const tx = await this.contract.registerDomain(
          name,
          description,
          parentId,
          contributionThreshold
        );
        await tx.wait();
        const domainCount = await this.contract.getDomainCount();
        const newDomain = await this.contract.getDomain(domainCount - BigInt(1));
        this.setDomainState(newDomain.id, DomainState.REGISTERED);
        return newDomain;
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

  public async getDomain(domainId: bigint): Promise<KnowledgeDomain> {
    // Check cache
    const cached = this.domainCache.get(domainId);
    if (cached && Date.now() - cached.timestamp < 60000) { // 1-minute cache
      return cached.data;
    }

    try {
      const result = await retryMechanism.executeWithRetry<KnowledgeDomain>(async () => {
        return await this.contract.getDomain(domainId);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Update cache
      this.domainCache.set(domainId, {
        data: result.result,
        timestamp: Date.now()
      });

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async updateDomainScores(
    domainId: bigint,
    relevanceScore: number,
    innovationScore: number
  ): Promise<void> {
    try {
      this.validateDomainState(domainId, DomainState.REGISTERED);
      this.setDomainState(domainId, DomainState.UPDATING);

      // Validate scores
      if (relevanceScore < this.config.minRelevanceScore || 
          relevanceScore > this.config.maxRelevanceScore) {
        throw new Error('Invalid relevance score');
      }
      if (innovationScore < this.config.minInnovationScore || 
          innovationScore > this.config.maxInnovationScore) {
        throw new Error('Invalid innovation score');
      }

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.updateDomainScores(
          domainId,
          relevanceScore,
          innovationScore
        );
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }

      this.invalidateDomainCache(domainId);
      this.invalidateAnalyticsCache(domainId);
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    } finally {
      this.setDomainState(domainId, DomainState.REGISTERED);
    }
  }

  public async mapProposalToDomain(
    proposalId: bigint,
    domainId: bigint,
    isPrimary: boolean
  ): Promise<void> {
    try {
      this.validateDomainState(domainId, DomainState.REGISTERED);
      this.setDomainState(domainId, DomainState.MAPPING);

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.mapProposalToDomain(
          proposalId,
          domainId,
          isPrimary
        );
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }

      this.invalidateAnalyticsCache(domainId);
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    } finally {
      this.setDomainState(domainId, DomainState.REGISTERED);
    }
  }

  public async getDomainMappings(proposalId: bigint): Promise<DomainMapping[]> {
    try {
      const result = await retryMechanism.executeWithRetry<DomainMapping[]>(async () => {
        return await this.contract.getDomainMappings(proposalId);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      return [];
    }
  }

  public async getDomainAnalytics(domainId: bigint): Promise<DomainAnalytics> {
    // Check cache
    const cached = this.analyticsCache.get(domainId);
    if (cached && Date.now() - cached.timestamp < this.config.analyticsUpdateInterval) {
      return cached.data;
    }

    try {
      const result = await retryMechanism.executeWithRetry<DomainAnalytics>(async () => {
        return await this.contract.getDomainAnalytics(domainId);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Update cache
      this.analyticsCache.set(domainId, {
        data: result.result,
        timestamp: Date.now()
      });

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async contributeToDomain(domainId: bigint, amount: bigint): Promise<void> {
    try {
      this.validateDomainState(domainId, DomainState.REGISTERED);
      this.setDomainState(domainId, DomainState.CONTRIBUTING);

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.contributeToDomain(domainId, amount);
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }

      this.invalidateDomainCache(domainId);
      this.invalidateAnalyticsCache(domainId);
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    } finally {
      this.setDomainState(domainId, DomainState.REGISTERED);
    }
  }

  public on<K extends keyof KnowledgeDomainEvents>(
    event: K,
    callback: (event: KnowledgeDomainEvents[K]) => void
  ): void {
    this.contract.on(event, callback);
  }

  public off<K extends keyof KnowledgeDomainEvents>(
    event: K,
    callback: (event: KnowledgeDomainEvents[K]) => void
  ): void {
    this.contract.off(event, callback);
  }

  public async getDomainCount(): Promise<bigint> {
    try {
      const result = await retryMechanism.executeWithRetry<bigint>(async () => {
        return await this.contract.getDomainCount();
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
} 