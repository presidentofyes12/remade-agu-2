import { ethers } from 'ethers';
import { DAOContract, IdeaData, IdeaRegistryEvents } from '../types/contracts';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';

export interface IdeaRegistryConfig {
  minRoyaltyRate: number;
  maxRoyaltyRate: number;
  minSimilarityThreshold: number;
  maxSimilarityThreshold: number;
  analyticsUpdateInterval: number;
}

export enum IdeaState {
  REGISTERED = 'REGISTERED',
  DISTRIBUTING = 'DISTRIBUTING',
  UPDATING = 'UPDATING'
}

export class IdeaRegistryService {
  private static instance: IdeaRegistryService;
  private contract: DAOContract;
  private config: IdeaRegistryConfig;
  private ideaCache: Map<bigint, { data: IdeaData; timestamp: number }>;
  private analyticsCache: Map<bigint, { data: any; timestamp: number }>;
  private ideaStates: Map<bigint, IdeaState>;

  private constructor(
    logicAddress: string,
    config: IdeaRegistryConfig,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.config = config;
    this.ideaCache = new Map();
    this.analyticsCache = new Map();
    this.ideaStates = new Map();

    // Initialize contract
    this.contract = {
      address: logicAddress,
      provider,
      signer,
      registerIdea: jest.fn(),
      getIdea: jest.fn(),
      getIdeaCount: jest.fn(),
      calculateSimilarity: jest.fn(),
      distributeRoyalties: jest.fn(),
      getRoyaltyRate: jest.fn(),
      updateRoyaltyRate: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as DAOContract;

    this.setupEventListeners();
  }

  public static getInstance(
    logicAddress: string,
    config: IdeaRegistryConfig,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ): IdeaRegistryService {
    if (!IdeaRegistryService.instance) {
      IdeaRegistryService.instance = new IdeaRegistryService(
        logicAddress,
        config,
        provider,
        signer
      );
    }
    return IdeaRegistryService.instance;
  }

  private setupEventListeners(): void {
    // Handle idea registration
    this.contract.on('IdeaRegistered', (event: IdeaRegistryEvents['IdeaRegistered']) => {
      this.invalidateIdeaCache(event.ideaId);
    });

    // Handle idea reuse
    this.contract.on('IdeaReused', (event: IdeaRegistryEvents['IdeaReused']) => {
      this.invalidateIdeaCache(event.originalIdeaId);
      this.invalidateIdeaCache(event.newIdeaId);
    });

    // Handle royalty distribution
    this.contract.on('RoyaltyDistributed', (event: IdeaRegistryEvents['RoyaltyDistributed']) => {
      this.invalidateIdeaCache(event.ideaId);
      this.invalidateAnalyticsCache(event.ideaId);
    });
  }

  private invalidateIdeaCache(ideaId: bigint): void {
    this.ideaCache.delete(ideaId);
  }

  private invalidateAnalyticsCache(ideaId: bigint): void {
    this.analyticsCache.delete(ideaId);
  }

  private validateIdeaState(ideaId: bigint, requiredState: IdeaState): void {
    const currentState = this.ideaStates.get(ideaId);
    if (currentState === IdeaState.DISTRIBUTING || currentState === IdeaState.UPDATING) {
      throw new Error(`Idea ${ideaId} is currently in ${currentState} state and cannot be modified`);
    }
    if (requiredState === IdeaState.REGISTERED && !currentState) {
      throw new Error(`Idea ${ideaId} is not registered`);
    }
  }

  private setIdeaState(ideaId: bigint, state: IdeaState): void {
    this.ideaStates.set(ideaId, state);
  }

  public async registerIdea(
    title: string,
    description: string,
    hash: string
  ): Promise<IdeaData> {
    try {
      const result = await retryMechanism.executeWithRetry<IdeaData>(async () => {
        const tx = await this.contract.registerIdea(title, description, hash);
        await tx.wait();
        const ideaCount = await this.contract.getIdeaCount();
        const newIdea = await this.contract.getIdea(ideaCount - BigInt(1));
        this.setIdeaState(newIdea.id, IdeaState.REGISTERED);
        return newIdea;
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

  public async getIdea(ideaId: bigint): Promise<IdeaData> {
    // Check cache
    const cached = this.ideaCache.get(ideaId);
    if (cached && Date.now() - cached.timestamp < 60000) { // 1-minute cache
      return cached.data;
    }

    try {
      const result = await retryMechanism.executeWithRetry<IdeaData>(async () => {
        return await this.contract.getIdea(ideaId);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Update cache
      this.ideaCache.set(ideaId, {
        data: result.result,
        timestamp: Date.now()
      });

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async calculateSimilarity(ideaId1: bigint, ideaId2: bigint): Promise<number> {
    try {
      const result = await retryMechanism.executeWithRetry<number>(async () => {
        return await this.contract.calculateSimilarity(ideaId1, ideaId2);
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

  public async distributeRoyalties(ideaId: bigint): Promise<void> {
    try {
      this.validateIdeaState(ideaId, IdeaState.REGISTERED);
      this.setIdeaState(ideaId, IdeaState.DISTRIBUTING);

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.distributeRoyalties(ideaId);
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }

      this.invalidateIdeaCache(ideaId);
      this.invalidateAnalyticsCache(ideaId);
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    } finally {
      this.setIdeaState(ideaId, IdeaState.REGISTERED);
    }
  }

  public async getRoyaltyRate(ideaId: bigint): Promise<number> {
    try {
      const result = await retryMechanism.executeWithRetry<number>(async () => {
        return await this.contract.getRoyaltyRate(ideaId);
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

  public async updateRoyaltyRate(ideaId: bigint, newRate: number): Promise<void> {
    try {
      this.validateIdeaState(ideaId, IdeaState.REGISTERED);
      this.setIdeaState(ideaId, IdeaState.UPDATING);

      // Validate rate
      if (newRate < this.config.minRoyaltyRate || newRate > this.config.maxRoyaltyRate) {
        throw new Error('Invalid royalty rate');
      }

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.updateRoyaltyRate(ideaId, newRate);
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }

      this.invalidateIdeaCache(ideaId);
      this.invalidateAnalyticsCache(ideaId);
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    } finally {
      this.setIdeaState(ideaId, IdeaState.REGISTERED);
    }
  }

  public async getIdeaCount(): Promise<bigint> {
    try {
      const result = await retryMechanism.executeWithRetry<bigint>(async () => {
        return await this.contract.getIdeaCount();
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

  public on<K extends keyof IdeaRegistryEvents>(
    event: K,
    callback: (event: IdeaRegistryEvents[K]) => void
  ): void {
    this.contract.on(event, callback);
  }

  public off<K extends keyof IdeaRegistryEvents>(
    event: K,
    callback: (event: IdeaRegistryEvents[K]) => void
  ): void {
    this.contract.off(event, callback);
  }
} 