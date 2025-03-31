import { ethers } from 'ethers';
import { PrivacyContract, KeyPair, SecondaryKeyMapping, IdentityResolutionProposal, PrivacyConfig, PrivacyEvents } from '../types/privacy';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';
import { DAOTokenService } from './daoToken';

export class PrivacyService {
  private static instance: PrivacyService;
  private contract: PrivacyContract;
  private daoTokenService: DAOTokenService;
  private eventListeners: Map<keyof PrivacyEvents, Set<(event: PrivacyEvents[keyof PrivacyEvents]) => void>>;
  private config: PrivacyConfig;
  private keyCache: Map<string, KeyPair>;
  private mappingCache: Map<string, SecondaryKeyMapping>;

  private constructor(
    logicAddress: string,
    stateAddress: string,
    viewAddress: string,
    config: PrivacyConfig,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.config = config;
    this.eventListeners = new Map();
    this.keyCache = new Map();
    this.mappingCache = new Map();
    
    // Initialize contracts
    this.contract = {
      address: logicAddress,
      provider,
      signer,
      createSecondaryKey: jest.fn(),
      getSecondaryKeyMapping: jest.fn(),
      updateKeyMapping: jest.fn(),
      proposeIdentityResolution: jest.fn(),
      voteOnIdentityResolution: jest.fn(),
      executeIdentityResolution: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as PrivacyContract;

    // Initialize DAO Token Service
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
    config: PrivacyConfig,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ): PrivacyService {
    if (!PrivacyService.instance) {
      PrivacyService.instance = new PrivacyService(
        logicAddress,
        stateAddress,
        viewAddress,
        config,
        provider,
        signer
      );
    }
    return PrivacyService.instance;
  }

  private setupEventListeners(): void {
    // Handle secondary key creation
    this.contract.on('SecondaryKeyCreated', (event: PrivacyEvents['SecondaryKeyCreated']) => {
      const listeners = this.eventListeners.get('SecondaryKeyCreated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateKeyCache(event.primaryKeyHash);
    });

    // Handle identity resolution proposals
    this.contract.on('IdentityResolutionProposed', (event: PrivacyEvents['IdentityResolutionProposed']) => {
      const listeners = this.eventListeners.get('IdentityResolutionProposed');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle proposal status changes
    this.contract.on('IdentityResolutionApproved', (event: PrivacyEvents['IdentityResolutionApproved']) => {
      const listeners = this.eventListeners.get('IdentityResolutionApproved');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    this.contract.on('IdentityResolutionRejected', (event: PrivacyEvents['IdentityResolutionRejected']) => {
      const listeners = this.eventListeners.get('IdentityResolutionRejected');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    this.contract.on('IdentityResolutionExecuted', (event: PrivacyEvents['IdentityResolutionExecuted']) => {
      const listeners = this.eventListeners.get('IdentityResolutionExecuted');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    });

    // Handle key mapping updates
    this.contract.on('KeyMappingUpdated', (event: PrivacyEvents['KeyMappingUpdated']) => {
      const listeners = this.eventListeners.get('KeyMappingUpdated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateMappingCache(event.primaryKeyHash, event.secondaryKeyHash);
    });
  }

  private invalidateKeyCache(primaryKeyHash: string): void {
    this.keyCache.delete(primaryKeyHash);
  }

  private invalidateMappingCache(primaryKeyHash: string, secondaryKeyHash: string): void {
    this.mappingCache.delete(`${primaryKeyHash}:${secondaryKeyHash}`);
  }

  public async generateKeyPair(): Promise<KeyPair> {
    try {
      const wallet = ethers.Wallet.createRandom();
      return {
        publicKey: wallet.address,
        privateKey: wallet.privateKey
      };
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async createSecondaryKey(
    primaryKeyHash: string,
    targetUserHash: string
  ): Promise<SecondaryKeyMapping> {
    try {
      // Check cache first
      const cacheKey = `${primaryKeyHash}:${targetUserHash}`;
      const cached = this.mappingCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await retryMechanism.executeWithRetry<SecondaryKeyMapping>(async () => {
        return await this.contract.createSecondaryKey(primaryKeyHash, targetUserHash);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Cache the result
      this.mappingCache.set(cacheKey, result.result);
      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async getSecondaryKeyMapping(
    primaryKeyHash: string,
    secondaryKeyHash: string
  ): Promise<SecondaryKeyMapping> {
    try {
      // Check cache first
      const cacheKey = `${primaryKeyHash}:${secondaryKeyHash}`;
      const cached = this.mappingCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await retryMechanism.executeWithRetry<SecondaryKeyMapping>(async () => {
        return await this.contract.getSecondaryKeyMapping(primaryKeyHash, secondaryKeyHash);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Cache the result
      this.mappingCache.set(cacheKey, result.result);
      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async updateKeyMapping(
    primaryKeyHash: string,
    secondaryKeyHash: string,
    encryptedMapping: string
  ): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.updateKeyMapping(
          primaryKeyHash,
          secondaryKeyHash,
          encryptedMapping
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

  public async proposeIdentityResolution(
    targetUserHash: string,
    requestedInformation: string[],
    justification: string,
    duration: bigint
  ): Promise<string> {
    try {
      // Validate requested information
      if (requestedInformation.length > this.config.maxRequestedInformation) {
        throw new Error('Too many requested information fields');
      }

      for (const info of requestedInformation) {
        if (!this.config.allowedInformationTypes.includes(info)) {
          throw new Error(`Invalid information type: ${info}`);
        }
      }

      // Check voting power
      if (!this.contract.signer) {
        throw new Error('Signer not available');
      }

      const address = await this.contract.signer.getAddress();
      const votingPower = await this.daoTokenService.getStakedBalance(address);
      if (votingPower < this.config.minVotingPower) {
        throw new Error('Insufficient voting power');
      }

      const result = await retryMechanism.executeWithRetry<string>(async () => {
        return await this.contract.proposeIdentityResolution(
          targetUserHash,
          requestedInformation,
          justification,
          duration
        );
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

  public async voteOnIdentityResolution(
    proposalId: string,
    support: boolean
  ): Promise<void> {
    try {
      // Check voting power
      if (!this.contract.signer) {
        throw new Error('Signer not available');
      }

      const address = await this.contract.signer.getAddress();
      const votingPower = await this.daoTokenService.getStakedBalance(address);
      if (votingPower < this.config.minVotingPower) {
        throw new Error('Insufficient voting power');
      }

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.voteOnIdentityResolution(proposalId, support);
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

  public async executeIdentityResolution(proposalId: string): Promise<string[]> {
    try {
      const result = await retryMechanism.executeWithRetry<string[]>(async () => {
        return await this.contract.executeIdentityResolution(proposalId);
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

  public on<K extends keyof PrivacyEvents>(
    event: K,
    listener: (event: PrivacyEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: PrivacyEvents[keyof PrivacyEvents]) => void);
  }

  public off<K extends keyof PrivacyEvents>(
    event: K,
    listener: (event: PrivacyEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: PrivacyEvents[keyof PrivacyEvents]) => void);
  }
} 