import { ethers } from 'ethers';
import { BaseContract } from './contracts';

export interface InformationSource {
  // Unique identifier for the source
  sourceId: string;
  // Source type (individual, organization, etc.)
  sourceType: 'individual' | 'organization' | 'dao';
  // Source address or identifier
  sourceAddress: string;
  // Reliability score (0-100)
  reliabilityScore: number;
  // Number of successful verifications
  verificationCount: number;
  // Timestamp of last verification
  lastVerification: bigint;
}

export interface InformationItem {
  // Unique identifier for the information item
  itemId: string;
  // Content hash for immutability
  contentHash: string;
  // Original content
  content: string;
  // Source information
  source: InformationSource;
  // Verification level (local, regional, global)
  verificationLevel: 'local' | 'regional' | 'global';
  // Verification status
  verificationStatus: 'pending' | 'verified' | 'rejected';
  // Verification proofs
  verificationProofs: VerificationProof[];
  // Distribution scope
  distributionScope: string[];
  // Timestamps
  createdAt: bigint;
  verifiedAt?: bigint;
  expiresAt?: bigint;
}

export interface VerificationProof {
  // Verifier address
  verifierAddress: string;
  // Verification level
  level: 'local' | 'regional' | 'global';
  // Verification timestamp
  timestamp: bigint;
  // Cryptographic proof
  proof: string;
  // Stake amount used for verification
  stakeAmount: bigint;
}

export interface AdViewingPreferences {
  // User address
  userAddress: string;
  // Base viewing rate (tokens per view)
  baseRate: bigint;
  // Category-specific rates
  categoryRates: Map<string, bigint>;
  // Minimum stake requirements
  minStakeRequirements: Map<string, bigint>;
  // Last updated timestamp
  lastUpdated: bigint;
}

export interface InformationVerificationConfig {
  // Minimum reliability score for sources
  minReliabilityScore: number;
  // Verification thresholds by level
  verificationThresholds: {
    local: number;
    regional: number;
    global: number;
  };
  // Stake requirements by level
  stakeRequirements: {
    local: bigint;
    regional: bigint;
    global: bigint;
  };
  // Verification cooldown period
  verificationCooldown: bigint;
  // Maximum distribution scope
  maxDistributionScope: string[];
}

export interface InformationVerificationEvents {
  InformationSubmitted: {
    itemId: string;
    sourceId: string;
    contentHash: string;
    timestamp: bigint;
  };
  InformationVerified: {
    itemId: string;
    verifierAddress: string;
    level: 'local' | 'regional' | 'global';
    timestamp: bigint;
  };
  InformationRejected: {
    itemId: string;
    reason: string;
    timestamp: bigint;
  };
  ViewingPreferencesUpdated: {
    userAddress: string;
    baseRate: bigint;
    timestamp: bigint;
  };
  AdStakeUpdated: {
    advertiserAddress: string;
    stakeAmount: bigint;
    timestamp: bigint;
  };
}

export interface InformationVerificationContract extends BaseContract {
  // Information Management
  submitInformation(
    content: string,
    sourceId: string,
    verificationLevel: 'local' | 'regional' | 'global'
  ): Promise<ethers.ContractTransactionResponse>;
  verifyInformation(
    itemId: string,
    level: 'local' | 'regional' | 'global',
    proof: string
  ): Promise<ethers.ContractTransactionResponse>;
  rejectInformation(
    itemId: string,
    reason: string
  ): Promise<ethers.ContractTransactionResponse>;
  getInformation(itemId: string): Promise<InformationItem>;
  getSource(sourceId: string): Promise<InformationSource>;

  // Viewing Preferences
  updateViewingPreferences(
    baseRate: bigint,
    categoryRates: Map<string, bigint>
  ): Promise<ethers.ContractTransactionResponse>;
  getViewingPreferences(
    userAddress: string
  ): Promise<AdViewingPreferences>;

  // Ad Stake Management
  updateAdStake(
    advertiserAddress: string,
    stakeAmount: bigint
  ): Promise<ethers.ContractTransactionResponse>;
  getAdStake(
    advertiserAddress: string
  ): Promise<bigint>;

  // Event Handling
  on<K extends keyof InformationVerificationEvents>(
    event: K,
    listener: (event: InformationVerificationEvents[K]) => void
  ): Promise<this>;
  off<K extends keyof InformationVerificationEvents>(
    event: K,
    listener: (event: InformationVerificationEvents[K]) => void
  ): Promise<this>;
} 