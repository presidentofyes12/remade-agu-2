import { ethers } from 'ethers';
import { 
  TransactionTrackingContract, 
  TransactionInfo, 
  TransactionEvents,
  TransactionType,
  TransactionStatus,
  TransactionTrackingConfig
} from '../types/transactionTracking';
import { NotificationService } from './notificationService';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';

export class TransactionTrackingService {
  private static instance: TransactionTrackingService;
  private contract: TransactionTrackingContract;
  private notificationService: NotificationService;
  private config: TransactionTrackingConfig;
  private eventListeners: Map<keyof TransactionEvents, Set<(event: TransactionEvents[keyof TransactionEvents]) => void>>;
  private transactionCache: Map<string, TransactionInfo>;
  private statusUpdateIntervals: Map<string, NodeJS.Timeout>;
  private provider: ethers.Provider;

  private constructor(
    contract: TransactionTrackingContract,
    notificationService: NotificationService,
    provider: ethers.Provider,
    config: TransactionTrackingConfig
  ) {
    this.contract = contract;
    this.notificationService = notificationService;
    this.provider = provider;
    this.config = config;
    this.eventListeners = new Map();
    this.transactionCache = new Map();
    this.statusUpdateIntervals = new Map();
    this.setupEventListeners();
  }

  public static getInstance(
    contract: TransactionTrackingContract,
    notificationService: NotificationService,
    provider: ethers.Provider,
    config: TransactionTrackingConfig
  ): TransactionTrackingService {
    if (!TransactionTrackingService.instance) {
      TransactionTrackingService.instance = new TransactionTrackingService(
        contract,
        notificationService,
        provider,
        config
      );
    }
    return TransactionTrackingService.instance;
  }

  private setupEventListeners(): void {
    // Handle transaction creation
    this.contract.on('TransactionCreated', (event: TransactionEvents['TransactionCreated']) => {
      const listeners = this.eventListeners.get('TransactionCreated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.startStatusTracking(event.id);
    });

    // Handle status updates
    this.contract.on('TransactionStatusUpdated', (event: TransactionEvents['TransactionStatusUpdated']) => {
      const listeners = this.eventListeners.get('TransactionStatusUpdated');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.invalidateTransactionCache(event.id);
    });

    // Handle transaction confirmation
    this.contract.on('TransactionConfirmed', (event: TransactionEvents['TransactionConfirmed']) => {
      const listeners = this.eventListeners.get('TransactionConfirmed');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.stopStatusTracking(event.id);
      this.invalidateTransactionCache(event.id);
    });

    // Handle transaction failure
    this.contract.on('TransactionFailed', (event: TransactionEvents['TransactionFailed']) => {
      const listeners = this.eventListeners.get('TransactionFailed');
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
      this.stopStatusTracking(event.id);
      this.invalidateTransactionCache(event.id);
    });
  }

  private startStatusTracking(transactionId: string): void {
    // Clear any existing interval
    this.stopStatusTracking(transactionId);

    // Start new interval for status updates
    const interval = setInterval(async () => {
      try {
        await this.updateTransactionStatus(transactionId);
      } catch (error) {
        errorHandler.handleError(error);
        this.stopStatusTracking(transactionId);
      }
    }, this.config.statusUpdateInterval * 1000);

    this.statusUpdateIntervals.set(transactionId, interval);
  }

  private stopStatusTracking(transactionId: string): void {
    const interval = this.statusUpdateIntervals.get(transactionId);
    if (interval) {
      clearInterval(interval);
      this.statusUpdateIntervals.delete(transactionId);
    }
  }

  private invalidateTransactionCache(transactionId: string): void {
    this.transactionCache.delete(transactionId);
  }

  public async trackTransaction(
    hash: string,
    type: TransactionType,
    metadata: Record<string, any>
  ): Promise<string> {
    try {
      const result = await retryMechanism.executeWithRetry<string>(async () => {
        return await this.contract.trackTransaction(
          hash,
          type,
          JSON.stringify(metadata)
        );
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Start tracking the transaction status
      this.startStatusTracking(result.result);

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  private async updateTransactionStatus(transactionId: string): Promise<void> {
    try {
      const transaction = await this.getTransaction(transactionId);
      const receipt = await this.provider.getTransactionReceipt(transaction.hash);

      if (!receipt) {
        // Transaction is still pending
        if (transaction.status !== 'pending') {
          await this.updateStatus(transactionId, 'pending');
        }
        return;
      }

      if (receipt.status === 0) {
        // Transaction failed
        await this.updateStatus(transactionId, 'failed', undefined, undefined, 'Transaction reverted');
        return;
      }

      // Transaction is confirmed
      const confirmations = await receipt.confirmations();
      if (confirmations >= this.config.maxConfirmations) {
        await this.updateStatus(transactionId, 'confirmed', receipt.blockNumber, confirmations);
      } else {
        await this.updateStatus(transactionId, 'processing', receipt.blockNumber, confirmations);
      }
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  private async updateStatus(
    transactionId: string,
    status: TransactionStatus,
    blockNumber?: number,
    confirmations?: number,
    error?: string
  ): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.updateTransactionStatus(
          transactionId,
          status,
          blockNumber,
          confirmations,
          error
        );
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }

      // Invalidate cache
      this.invalidateTransactionCache(transactionId);

      // Send notification for status change
      await this.notifyStatusChange(transactionId, status, error);
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  private async notifyStatusChange(
    transactionId: string,
    status: TransactionStatus,
    error?: string
  ): Promise<void> {
    try {
      const transaction = await this.getTransaction(transactionId);
      const title = `Transaction ${status.charAt(0).toUpperCase() + status.slice(1)}`;
      const message = error 
        ? `Transaction ${transaction.hash} failed: ${error}`
        : `Transaction ${transaction.hash} is now ${status}`;

      await this.notificationService.createNotification(
        'transactionStatus',
        status === 'failed' ? 'high' : 'medium',
        title,
        message,
        {
          transactionId,
          hash: transaction.hash,
          type: transaction.type,
          status
        }
      );
    } catch (error) {
      errorHandler.handleError(error);
      // Don't throw here as this is a non-critical operation
    }
  }

  public async getTransaction(id: string): Promise<TransactionInfo> {
    try {
      // Check cache first
      const cached = this.transactionCache.get(id);
      if (cached) {
        return cached;
      }

      const result = await retryMechanism.executeWithRetry<TransactionInfo>(async () => {
        return await this.contract.getTransaction(id);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // Cache the result
      this.transactionCache.set(id, result.result);
      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async getTransactionsByStatus(status: TransactionStatus): Promise<string[]> {
    try {
      const result = await retryMechanism.executeWithRetry<string[]>(async () => {
        return await this.contract.getTransactionsByStatus(status);
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

  public async getTransactionsByType(type: TransactionType): Promise<string[]> {
    try {
      const result = await retryMechanism.executeWithRetry<string[]>(async () => {
        return await this.contract.getTransactionsByType(type);
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

  public async getTransactionsByAddress(address: string): Promise<string[]> {
    try {
      const result = await retryMechanism.executeWithRetry<string[]>(async () => {
        return await this.contract.getTransactionsByAddress(address);
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

  public on<K extends keyof TransactionEvents>(
    event: K,
    listener: (event: TransactionEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: TransactionEvents[keyof TransactionEvents]) => void);
  }

  public off<K extends keyof TransactionEvents>(
    event: K,
    listener: (event: TransactionEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: TransactionEvents[keyof TransactionEvents]) => void);
  }

  public cleanup(): void {
    // Clear all intervals
    this.statusUpdateIntervals.forEach(interval => clearInterval(interval));
    this.statusUpdateIntervals.clear();

    // Clear all caches
    this.transactionCache.clear();
  }
} 