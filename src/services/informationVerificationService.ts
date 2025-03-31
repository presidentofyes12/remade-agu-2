import { ethers } from 'ethers';
import { InformationVerificationContract, InformationItem, InformationSource, VerificationProof, AdViewingPreferences, InformationVerificationConfig, InformationVerificationEvents } from '../types/informationVerification';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';
import { ConceptMappingService } from './conceptMapping';
import { DAOTokenService } from './daoToken';

export class InformationVerificationService {
  private static instance: InformationVerificationService;
  private contract: InformationVerificationContract;
  private conceptMappingService: ConceptMappingService;
  private daoTokenService: DAOTokenService;
  private eventListeners: Map<keyof InformationVerificationEvents, Set<(event: any) => void>>;
  private config: InformationVerificationConfig;

  private constructor(
    logicAddress: string,
    stateAddress: string,
    viewAddress: string,
    config: InformationVerificationConfig,
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
      submitInformation: jest.fn(),
      verifyInformation: jest.fn(),
      rejectInformation: jest.fn(),
      getInformation: jest.fn(),
      getSource: jest.fn(),
      updateViewingPreferences: jest.fn(),
      getViewingPreferences: jest.fn(),
      updateAdStake: jest.fn(),
      getAdStake: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as InformationVerificationContract;

    // Initialize services
    this.conceptMappingService = ConceptMappingService.getInstance(
      process.env.REACT_APP_CONCEPT_MAPPING_ADDRESS || '',
      provider,
      signer
    );

    this.daoTokenService = DAOTokenService.getInstance(
      process.env.REACT_APP_TOKEN_ADDRESS || '',
      provider,
      signer
    );

    this.setupEventListeners();
  }

  public static getInstance(
    logicAddress: string,
    stateAddress: string,
    viewAddress: string,
    config: InformationVerificationConfig,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ): InformationVerificationService {
    if (!InformationVerificationService.instance) {
      InformationVerificationService.instance = new InformationVerificationService(
        logicAddress,
        stateAddress,
        viewAddress,
        config,
        provider,
        signer
      );
    }
    return InformationVerificationService.instance;
  }

  private setupEventListeners(): void {
    // Handle information submission
    this.contract.on('InformationSubmitted', (event: InformationVerificationEvents['InformationSubmitted']) => {
      const listeners = this.eventListeners.get('InformationSubmitted');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle information verification
    this.contract.on('InformationVerified', (event: InformationVerificationEvents['InformationVerified']) => {
      const listeners = this.eventListeners.get('InformationVerified');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle information rejection
    this.contract.on('InformationRejected', (event: InformationVerificationEvents['InformationRejected']) => {
      const listeners = this.eventListeners.get('InformationRejected');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle viewing preferences updates
    this.contract.on('ViewingPreferencesUpdated', (event: InformationVerificationEvents['ViewingPreferencesUpdated']) => {
      const listeners = this.eventListeners.get('ViewingPreferencesUpdated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle ad stake updates
    this.contract.on('AdStakeUpdated', (event: InformationVerificationEvents['AdStakeUpdated']) => {
      const listeners = this.eventListeners.get('AdStakeUpdated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });
  }

  public async submitInformation(
    content: string,
    sourceId: string,
    verificationLevel: 'local' | 'regional' | 'global'
  ): Promise<void> {
    try {
      // Check source reliability
      const source = await this.getSource(sourceId);
      if (source.reliabilityScore < this.config.minReliabilityScore) {
        throw new Error('Source reliability score below threshold');
      }

      // Generate content hash
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes(content));

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.submitInformation(
          content,
          sourceId,
          verificationLevel
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

  public async verifyInformation(
    itemId: string,
    level: 'local' | 'regional' | 'global',
    proof: string
  ): Promise<void> {
    try {
      // Check verification threshold
      const threshold = this.config.verificationThresholds[level];
      const stake = this.config.stakeRequirements[level];

      // Verify stake
      const hasStake = await this.daoTokenService.checkStake(stake);
      if (!hasStake) {
        throw new Error('Insufficient stake for verification');
      }

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.verifyInformation(
          itemId,
          level,
          proof
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

  public async rejectInformation(
    itemId: string,
    reason: string
  ): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.rejectInformation(
          itemId,
          reason
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

  public async getInformation(itemId: string): Promise<InformationItem> {
    try {
      const result = await retryMechanism.executeWithRetry<InformationItem>(async () => {
        return await this.contract.getInformation(itemId);
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

  public async getSource(sourceId: string): Promise<InformationSource> {
    try {
      const result = await retryMechanism.executeWithRetry<InformationSource>(async () => {
        return await this.contract.getSource(sourceId);
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

  public async updateViewingPreferences(
    baseRate: bigint,
    categoryRates: Map<string, bigint>
  ): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.updateViewingPreferences(
          baseRate,
          categoryRates
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

  public async getViewingPreferences(
    userAddress: string
  ): Promise<AdViewingPreferences> {
    try {
      const result = await retryMechanism.executeWithRetry<AdViewingPreferences>(async () => {
        return await this.contract.getViewingPreferences(userAddress);
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

  public async updateAdStake(
    advertiserAddress: string,
    stakeAmount: bigint
  ): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.updateAdStake(
          advertiserAddress,
          stakeAmount
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

  public async getAdStake(
    advertiserAddress: string
  ): Promise<bigint> {
    try {
      const result = await retryMechanism.executeWithRetry<bigint>(async () => {
        return await this.contract.getAdStake(advertiserAddress);
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

  public on<K extends keyof InformationVerificationEvents>(
    event: K,
    callback: (event: InformationVerificationEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }

  public off<K extends keyof InformationVerificationEvents>(
    event: K,
    callback: (event: InformationVerificationEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(callback);
  }
} 