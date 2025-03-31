import { ethers } from 'ethers';
import { KeyBackupContract, BackupRequest, BackupMetadata, KeyBackupEvents, KeyBackupConfig } from '../types/keyBackup';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';
import { PrivacyService } from './privacyService';

export class KeyBackupService {
  private static instance: KeyBackupService;
  private contract: KeyBackupContract;
  private privacyService: PrivacyService;
  private config: KeyBackupConfig;
  private eventListeners: Map<keyof KeyBackupEvents, Set<(event: KeyBackupEvents[keyof KeyBackupEvents]) => void>>;
  private requestCache: Map<string, BackupRequest>;
  private metadataCache: Map<string, BackupMetadata>;

  private constructor(
    contract: KeyBackupContract,
    privacyService: PrivacyService,
    config: KeyBackupConfig
  ) {
    this.contract = contract;
    this.privacyService = privacyService;
    this.config = config;
    this.eventListeners = new Map();
    this.requestCache = new Map();
    this.metadataCache = new Map();
    this.setupEventListeners();
  }

  public static getInstance(
    contract: KeyBackupContract,
    privacyService: PrivacyService,
    config: KeyBackupConfig
  ): KeyBackupService {
    if (!KeyBackupService.instance) {
      KeyBackupService.instance = new KeyBackupService(contract, privacyService, config);
    }
    return KeyBackupService.instance;
  }

  private setupEventListeners(): void {
    // Handle backup requests
    this.contract.on('BackupRequested', (event: KeyBackupEvents['BackupRequested']) => {
      const listeners = this.eventListeners.get('BackupRequested');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
    });

    // Handle backup votes
    this.contract.on('BackupVoted', (event: KeyBackupEvents['BackupVoted']) => {
      const listeners = this.eventListeners.get('BackupVoted');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
    });

    // Handle backup approval
    this.contract.on('BackupApproved', (event: KeyBackupEvents['BackupApproved']) => {
      const listeners = this.eventListeners.get('BackupApproved');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
    });

    // Handle backup rejection
    this.contract.on('BackupRejected', (event: KeyBackupEvents['BackupRejected']) => {
      const listeners = this.eventListeners.get('BackupRejected');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
    });

    // Handle backup execution
    this.contract.on('BackupExecuted', (event: KeyBackupEvents['BackupExecuted']) => {
      const listeners = this.eventListeners.get('BackupExecuted');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
      this.invalidateMetadataCache(event.backupHash);
    });

    // Handle backup expiration
    this.contract.on('BackupExpired', (event: KeyBackupEvents['BackupExpired']) => {
      const listeners = this.eventListeners.get('BackupExpired');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
    });
  }

  private invalidateRequestCache(requestId: string): void {
    this.requestCache.delete(requestId);
  }

  private invalidateMetadataCache(backupHash: string): void {
    this.metadataCache.delete(backupHash);
  }

  public async requestBackup(
    keyHash: string,
    backupType: 'full' | 'partial',
    justification: string,
    duration: bigint
  ): Promise<string> {
    try {
      // Check if we have too many active requests
      const activeRequests = await this.getActiveRequests();
      if (activeRequests.length >= this.config.maxActiveRequests) {
        throw new Error('Maximum number of active backup requests reached');
      }

      const result = await retryMechanism.executeWithRetry<string>(async () => {
        return await this.contract.requestBackup(keyHash, backupType, justification, duration);
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

  public async voteOnBackup(
    requestId: string,
    support: boolean,
    voterType: 'marketplace' | 'dao'
  ): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.voteOnBackup(requestId, support, voterType);
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

  public async executeBackup(requestId: string): Promise<void> {
    try {
      const request = await this.getBackupRequest(requestId);
      
      // Check if request is approved
      if (request.status !== 'approved') {
        throw new Error('Backup request is not approved');
      }

      // Check if request has expired
      if (BigInt(Date.now()) > request.expiresAt) {
        throw new Error('Backup request has expired');
      }

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.executeBackup(requestId);
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

  public async getBackupRequest(requestId: string): Promise<BackupRequest> {
    try {
      // Check cache first
      const cached = this.requestCache.get(requestId);
      if (cached) {
        return cached;
      }

      const result = await retryMechanism.executeWithRetry<BackupRequest>(async () => {
        return await this.contract.getBackupRequest(requestId);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Cache the result
      this.requestCache.set(requestId, result.result);
      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async getBackupMetadata(backupHash: string): Promise<BackupMetadata> {
    try {
      // Check cache first
      const cached = this.metadataCache.get(backupHash);
      if (cached) {
        return cached;
      }

      const result = await retryMechanism.executeWithRetry<BackupMetadata>(async () => {
        return await this.contract.getBackupMetadata(backupHash);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Cache the result
      this.metadataCache.set(backupHash, result.result);
      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async getActiveRequests(): Promise<string[]> {
    try {
      const result = await retryMechanism.executeWithRetry<string[]>(async () => {
        return await this.contract.getActiveRequests();
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

  public on<K extends keyof KeyBackupEvents>(
    event: K,
    listener: (event: KeyBackupEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: KeyBackupEvents[keyof KeyBackupEvents]) => void);
  }

  public off<K extends keyof KeyBackupEvents>(
    event: K,
    listener: (event: KeyBackupEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: KeyBackupEvents[keyof KeyBackupEvents]) => void);
  }

  public cleanup(): void {
    // Clear all caches
    this.requestCache.clear();
    this.metadataCache.clear();
  }
} 