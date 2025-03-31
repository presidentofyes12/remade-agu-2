import { BaseContract } from './contracts';
import { ethers } from 'ethers';

export interface BackupRequest {
  requestId: string;
  requesterAddress: string;
  keyHash: string;
  backupType: 'full' | 'partial';
  justification: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdAt: bigint;
  expiresAt: bigint;
  votes: {
    marketplaceAdmins: {
      for: bigint;
      against: bigint;
      totalVoters: bigint;
    };
    daoAdmins: {
      for: bigint;
      against: bigint;
      totalVoters: bigint;
    };
  };
}

export interface BackupMetadata {
  keyHash: string;
  backupHash: string;
  encryptedData: string;
  createdAt: bigint;
  expiresAt: bigint;
  backupType: 'full' | 'partial';
  backupVersion: number;
}

export interface KeyBackupEvents {
  BackupRequested: {
    requestId: string;
    requesterAddress: string;
    keyHash: string;
    backupType: 'full' | 'partial';
    createdAt: bigint;
  };
  BackupVoted: {
    requestId: string;
    voterAddress: string;
    voterType: 'marketplace' | 'dao';
    support: boolean;
    timestamp: bigint;
  };
  BackupApproved: {
    requestId: string;
    approvedAt: bigint;
    approvedBy: string[];
  };
  BackupRejected: {
    requestId: string;
    rejectedAt: bigint;
    rejectedBy: string[];
  };
  BackupExecuted: {
    requestId: string;
    executedAt: bigint;
    backupHash: string;
  };
  BackupExpired: {
    requestId: string;
    expiredAt: bigint;
  };
}

export interface KeyBackupConfig {
  marketplaceAdminThreshold: bigint; // Percentage required (e.g., 60% = 60n)
  daoAdminThreshold: bigint;
  votingPeriod: bigint; // In seconds
  maxActiveRequests: number;
  backupExpirationPeriod: bigint; // In seconds
}

export interface KeyBackupContract extends BaseContract {
  // Request Management
  requestBackup(
    keyHash: string,
    backupType: 'full' | 'partial',
    justification: string,
    duration: bigint
  ): Promise<string>;
  
  voteOnBackup(
    requestId: string,
    support: boolean,
    voterType: 'marketplace' | 'dao'
  ): Promise<ethers.ContractTransactionResponse>;
  
  executeBackup(requestId: string): Promise<ethers.ContractTransactionResponse>;
  
  // Query Functions
  getBackupRequest(requestId: string): Promise<BackupRequest>;
  getBackupMetadata(backupHash: string): Promise<BackupMetadata>;
  getActiveRequests(): Promise<string[]>;
  
  // Event Listeners
  on<K extends keyof KeyBackupEvents>(
    event: K,
    listener: (event: KeyBackupEvents[K]) => void
  ): Promise<this>;
  
  off<K extends keyof KeyBackupEvents>(
    event: K,
    listener: (event: KeyBackupEvents[K]) => void
  ): Promise<this>;
} 