import { BaseContract } from './contracts';
import { ethers } from 'ethers';

export type OperationType = 
  | 'keyRotation'
  | 'backupExecution'
  | 'adminUpdate'
  | 'thresholdUpdate'
  | 'emergencyPause';

export interface MultiSigRequest {
  requestId: string;
  operationType: OperationType;
  targetAddress: string;
  data: string;
  value: bigint;
  status: 'pending' | 'approved' | 'executed' | 'rejected' | 'expired';
  createdAt: bigint;
  expiresAt: bigint;
  signatures: {
    [address: string]: {
      signature: string;
      timestamp: bigint;
    };
  };
  requiredSignatures: number;
  currentSignatures: number;
}

export interface MultiSigConfig {
  minRequiredSignatures: number;
  maxRequiredSignatures: number;
  votingPeriod: bigint; // In seconds
  executionDelay: bigint; // In seconds
  maxActiveRequests: number;
}

export interface MultiSigEvents {
  RequestCreated: {
    requestId: string;
    operationType: OperationType;
    targetAddress: string;
    data: string;
    value: bigint;
    requiredSignatures: number;
    createdAt: bigint;
  };
  SignatureAdded: {
    requestId: string;
    signerAddress: string;
    signature: string;
    timestamp: bigint;
  };
  RequestApproved: {
    requestId: string;
    approvedAt: bigint;
  };
  RequestExecuted: {
    requestId: string;
    executedAt: bigint;
    executor: string;
  };
  RequestRejected: {
    requestId: string;
    rejectedAt: bigint;
    rejector: string;
  };
  RequestExpired: {
    requestId: string;
    expiredAt: bigint;
  };
}

export interface MultiSigContract extends BaseContract {
  // Request Management
  createRequest(
    operationType: OperationType,
    targetAddress: string,
    data: string,
    value: bigint,
    requiredSignatures: number
  ): Promise<string>;
  
  addSignature(
    requestId: string,
    signature: string
  ): Promise<ethers.ContractTransactionResponse>;
  
  executeRequest(requestId: string): Promise<ethers.ContractTransactionResponse>;
  
  rejectRequest(requestId: string): Promise<ethers.ContractTransactionResponse>;
  
  // Query Functions
  getRequest(requestId: string): Promise<MultiSigRequest>;
  getActiveRequests(): Promise<string[]>;
  getSignatures(requestId: string): Promise<{ [address: string]: { signature: string; timestamp: bigint } }>;
  
  // Event Listeners
  on<K extends keyof MultiSigEvents>(
    event: K,
    listener: (event: MultiSigEvents[K]) => void
  ): Promise<this>;
  
  off<K extends keyof MultiSigEvents>(
    event: K,
    listener: (event: MultiSigEvents[K]) => void
  ): Promise<this>;
} 