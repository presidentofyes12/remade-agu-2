import { BaseContract } from './contracts';
import { ethers } from 'ethers';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface SecondaryKeyMapping {
  primaryKeyHash: string;
  secondaryKeyHash: string;
  encryptedMapping: string;
  createdAt: bigint;
  expiresAt: bigint;
}

export interface IdentityResolutionProposal {
  proposalId: string;
  targetUserHash: string;
  requestedInformation: string[];
  justification: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdAt: bigint;
  expiresAt: bigint;
  votes: {
    for: bigint;
    against: bigint;
  };
}

export interface PrivacyEvents {
  SecondaryKeyCreated: {
    primaryKeyHash: string;
    secondaryKeyHash: string;
    createdAt: bigint;
  };
  IdentityResolutionProposed: {
    proposalId: string;
    targetUserHash: string;
    requestedInformation: string[];
    createdAt: bigint;
  };
  IdentityResolutionApproved: {
    proposalId: string;
    approvedAt: bigint;
  };
  IdentityResolutionRejected: {
    proposalId: string;
    rejectedAt: bigint;
  };
  IdentityResolutionExecuted: {
    proposalId: string;
    executedAt: bigint;
    revealedInformation: string[];
  };
  KeyMappingUpdated: {
    primaryKeyHash: string;
    secondaryKeyHash: string;
    updatedAt: bigint;
  };
}

export interface PrivacyContract extends BaseContract {
  // Key Management
  createSecondaryKey(primaryKeyHash: string, targetUserHash: string): Promise<SecondaryKeyMapping>;
  getSecondaryKeyMapping(primaryKeyHash: string, secondaryKeyHash: string): Promise<SecondaryKeyMapping>;
  updateKeyMapping(primaryKeyHash: string, secondaryKeyHash: string, encryptedMapping: string): Promise<ethers.ContractTransactionResponse>;
  
  // Identity Resolution
  proposeIdentityResolution(
    targetUserHash: string,
    requestedInformation: string[],
    justification: string,
    duration: bigint
  ): Promise<string>;
  voteOnIdentityResolution(proposalId: string, support: boolean): Promise<ethers.ContractTransactionResponse>;
  executeIdentityResolution(proposalId: string): Promise<string[]>;
  
  // Event Listeners
  on<K extends keyof PrivacyEvents>(
    event: K,
    listener: (event: PrivacyEvents[K]) => void
  ): Promise<this>;
  off<K extends keyof PrivacyEvents>(
    event: K,
    listener: (event: PrivacyEvents[K]) => void
  ): Promise<this>;
}

export interface PrivacyConfig {
  keyExpirationPeriod: bigint;
  proposalVotingPeriod: bigint;
  minVotingPower: bigint;
  maxRequestedInformation: number;
  allowedInformationTypes: string[];
} 