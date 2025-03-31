import { ethers } from 'ethers';
import { MultiSigContract, MultiSigRequest, MultiSigEvents, MultiSigConfig, OperationType } from '../types/multiSignature';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';

export class MultiSigService {
  private static instance: MultiSigService;
  private contract: MultiSigContract;
  private config: MultiSigConfig;
  private eventListeners: Map<keyof MultiSigEvents, Set<(event: MultiSigEvents[keyof MultiSigEvents]) => void>>;
  private requestCache: Map<string, MultiSigRequest>;
  private signaturesCache: Map<string, { [address: string]: { signature: string; timestamp: bigint } }>;

  private constructor(
    contract: MultiSigContract,
    config: MultiSigConfig
  ) {
    this.contract = contract;
    this.config = config;
    this.eventListeners = new Map();
    this.requestCache = new Map();
    this.signaturesCache = new Map();
    this.setupEventListeners();
  }

  public static getInstance(
    contract: MultiSigContract,
    config: MultiSigConfig
  ): MultiSigService {
    if (!MultiSigService.instance) {
      MultiSigService.instance = new MultiSigService(contract, config);
    }
    return MultiSigService.instance;
  }

  private setupEventListeners(): void {
    // Handle request creation
    this.contract.on('RequestCreated', (event: MultiSigEvents['RequestCreated']) => {
      const listeners = this.eventListeners.get('RequestCreated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
    });

    // Handle signature addition
    this.contract.on('SignatureAdded', (event: MultiSigEvents['SignatureAdded']) => {
      const listeners = this.eventListeners.get('SignatureAdded');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
      this.invalidateSignaturesCache(event.requestId);
    });

    // Handle request approval
    this.contract.on('RequestApproved', (event: MultiSigEvents['RequestApproved']) => {
      const listeners = this.eventListeners.get('RequestApproved');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
    });

    // Handle request execution
    this.contract.on('RequestExecuted', (event: MultiSigEvents['RequestExecuted']) => {
      const listeners = this.eventListeners.get('RequestExecuted');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
      this.invalidateSignaturesCache(event.requestId);
    });

    // Handle request rejection
    this.contract.on('RequestRejected', (event: MultiSigEvents['RequestRejected']) => {
      const listeners = this.eventListeners.get('RequestRejected');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
    });

    // Handle request expiration
    this.contract.on('RequestExpired', (event: MultiSigEvents['RequestExpired']) => {
      const listeners = this.eventListeners.get('RequestExpired');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateRequestCache(event.requestId);
    });
  }

  private invalidateRequestCache(requestId: string): void {
    this.requestCache.delete(requestId);
  }

  private invalidateSignaturesCache(requestId: string): void {
    this.signaturesCache.delete(requestId);
  }

  public async createRequest(
    operationType: OperationType,
    targetAddress: string,
    data: string,
    value: bigint,
    requiredSignatures: number
  ): Promise<string> {
    try {
      // Validate required signatures
      if (requiredSignatures < this.config.minRequiredSignatures) {
        throw new Error(`Required signatures must be at least ${this.config.minRequiredSignatures}`);
      }
      if (requiredSignatures > this.config.maxRequiredSignatures) {
        throw new Error(`Required signatures cannot exceed ${this.config.maxRequiredSignatures}`);
      }

      // Check if we have too many active requests
      const activeRequests = await this.getActiveRequests();
      if (activeRequests.length >= this.config.maxActiveRequests) {
        throw new Error('Maximum number of active requests reached');
      }

      const result = await retryMechanism.executeWithRetry<string>(async () => {
        return await this.contract.createRequest(
          operationType,
          targetAddress,
          data,
          value,
          requiredSignatures
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

  public async addSignature(requestId: string, signature: string): Promise<void> {
    try {
      const request = await this.getRequest(requestId);
      
      // Check if request is still pending
      if (request.status !== 'pending') {
        throw new Error('Request is not pending');
      }

      // Check if request has expired
      if (BigInt(Date.now()) > request.expiresAt) {
        throw new Error('Request has expired');
      }

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.addSignature(requestId, signature);
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

  public async executeRequest(requestId: string): Promise<void> {
    try {
      const request = await this.getRequest(requestId);
      
      // Check if request is approved
      if (request.status !== 'approved') {
        throw new Error('Request is not approved');
      }

      // Check if request has expired
      if (BigInt(Date.now()) > request.expiresAt) {
        throw new Error('Request has expired');
      }

      // Check if execution delay has passed
      const executionTime = request.createdAt + this.config.executionDelay;
      if (BigInt(Date.now()) < executionTime) {
        throw new Error('Execution delay period has not passed');
      }

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.executeRequest(requestId);
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

  public async rejectRequest(requestId: string): Promise<void> {
    try {
      const request = await this.getRequest(requestId);
      
      // Check if request is still pending
      if (request.status !== 'pending') {
        throw new Error('Request is not pending');
      }

      // Check if request has expired
      if (BigInt(Date.now()) > request.expiresAt) {
        throw new Error('Request has expired');
      }

      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.rejectRequest(requestId);
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

  public async getRequest(requestId: string): Promise<MultiSigRequest> {
    try {
      // Check cache first
      const cached = this.requestCache.get(requestId);
      if (cached) {
        return cached;
      }

      const result = await retryMechanism.executeWithRetry<MultiSigRequest>(async () => {
        return await this.contract.getRequest(requestId);
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

  public async getSignatures(requestId: string): Promise<{ [address: string]: { signature: string; timestamp: bigint } }> {
    try {
      // Check cache first
      const cached = this.signaturesCache.get(requestId);
      if (cached) {
        return cached;
      }

      const result = await retryMechanism.executeWithRetry(async () => {
        return await this.contract.getSignatures(requestId);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Cache the result
      this.signaturesCache.set(requestId, result.result);
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

  public on<K extends keyof MultiSigEvents>(
    event: K,
    listener: (event: MultiSigEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: MultiSigEvents[keyof MultiSigEvents]) => void);
  }

  public off<K extends keyof MultiSigEvents>(
    event: K,
    listener: (event: MultiSigEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: MultiSigEvents[keyof MultiSigEvents]) => void);
  }

  public cleanup(): void {
    // Clear all caches
    this.requestCache.clear();
    this.signaturesCache.clear();
  }
} 