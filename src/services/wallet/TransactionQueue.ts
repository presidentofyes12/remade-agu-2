import { ethers } from 'ethers';
import { WalletConnector } from './WalletConnector';

export interface QueuedTransaction {
  id: string;
  transaction: ethers.PopulatedTransaction;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  hash?: string;
  error?: string;
}

export class TransactionQueue {
  private queue: QueuedTransaction[] = [];
  private isProcessing: boolean = false;
  private walletConnector: WalletConnector;
  private maxRetries: number = 3;
  private retryDelay: number = 5000; // 5 seconds

  constructor(walletConnector: WalletConnector) {
    this.walletConnector = walletConnector;
    this.startProcessing();
  }

  public async addTransaction(
    transaction: ethers.PopulatedTransaction,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<string> {
    const id = ethers.utils.id(JSON.stringify(transaction) + Date.now());
    const queuedTransaction: QueuedTransaction = {
      id,
      transaction,
      timestamp: Date.now(),
      priority,
      status: 'pending'
    };

    this.queue.push(queuedTransaction);
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return id;
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const transaction = this.queue[0];
      try {
        await this.processTransaction(transaction);
        this.queue.shift();
      } catch (error) {
        console.error(`Transaction ${transaction.id} failed:`, error);
        transaction.status = 'failed';
        transaction.error = error.message;
        
        if (transaction.retryCount < this.maxRetries) {
          transaction.retryCount = (transaction.retryCount || 0) + 1;
          setTimeout(() => {
            transaction.status = 'pending';
            this.queue.push(transaction);
          }, this.retryDelay);
        }
        
        this.queue.shift();
      }
    }

    this.isProcessing = false;
  }

  private async processTransaction(transaction: QueuedTransaction): Promise<void> {
    transaction.status = 'processing';
    
    try {
      const preparedTx = await this.walletConnector.prepareTransaction(transaction.transaction);
      const tx = await this.walletConnector.getSigner()?.sendTransaction(preparedTx);
      
      if (!tx) throw new Error('Transaction failed to send');
      
      transaction.status = 'completed';
      transaction.hash = tx.hash;
      
      // Wait for confirmation
      await tx.wait();
    } catch (error) {
      throw new Error(`Transaction processing failed: ${error.message}`);
    }
  }

  public getTransactionStatus(id: string): QueuedTransaction | undefined {
    return this.queue.find(tx => tx.id === id);
  }

  public getQueueStatus(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter(tx => tx.status === 'pending').length,
      processing: this.queue.filter(tx => tx.status === 'processing').length,
      completed: this.queue.filter(tx => tx.status === 'completed').length,
      failed: this.queue.filter(tx => tx.status === 'failed').length
    };
  }

  public clearQueue(): void {
    this.queue = [];
  }
} 