import { BaseContract } from './contracts';
import { ethers } from 'ethers';

export type TransactionStatus = 
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'failed'
  | 'reverted';

export type TransactionType = 
  | 'keyRotation'
  | 'backupRequest'
  | 'multiSigRequest'
  | 'tokenTransfer'
  | 'contractInteraction';

export interface TransactionInfo {
  id: string;
  hash: string;
  type: TransactionType;
  status: TransactionStatus;
  from: string;
  to: string;
  value: bigint;
  data: string;
  gasLimit: bigint;
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce: number;
  timestamp: bigint;
  blockNumber?: number;
  confirmations?: number;
  error?: string;
  metadata: {
    [key: string]: any;
  };
}

export interface TransactionEvents {
  TransactionCreated: {
    id: string;
    hash: string;
    type: TransactionType;
    from: string;
    to: string;
    timestamp: bigint;
  };
  TransactionStatusUpdated: {
    id: string;
    status: TransactionStatus;
    blockNumber?: number;
    confirmations?: number;
    error?: string;
    timestamp: bigint;
  };
  TransactionConfirmed: {
    id: string;
    blockNumber: number;
    confirmations: number;
    timestamp: bigint;
  };
  TransactionFailed: {
    id: string;
    error: string;
    timestamp: bigint;
  };
}

export interface TransactionTrackingConfig {
  maxConfirmations: number;
  confirmationInterval: number; // In seconds
  maxRetries: number;
  retryDelay: number; // In seconds
  statusUpdateInterval: number; // In seconds
}

export interface TransactionTrackingContract extends BaseContract {
  // Transaction Management
  trackTransaction(
    hash: string,
    type: TransactionType,
    metadata: string
  ): Promise<string>;
  
  updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    blockNumber?: number,
    confirmations?: number,
    error?: string
  ): Promise<ethers.ContractTransactionResponse>;
  
  // Query Functions
  getTransaction(id: string): Promise<TransactionInfo>;
  getTransactionsByStatus(status: TransactionStatus): Promise<string[]>;
  getTransactionsByType(type: TransactionType): Promise<string[]>;
  getTransactionsByAddress(address: string): Promise<string[]>;
  
  // Event Listeners
  on<K extends keyof TransactionEvents>(
    event: K,
    listener: (event: TransactionEvents[K]) => void
  ): Promise<this>;
  
  off<K extends keyof TransactionEvents>(
    event: K,
    listener: (event: TransactionEvents[K]) => void
  ): Promise<this>;
} 