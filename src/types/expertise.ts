import { ethers } from 'ethers';
import { BaseContract } from './contracts';

export interface ExpertiseProfile {
  // Public identifier (pseudonym)
  pseudonym: string;
  // Encrypted domain expertise scores
  domainExpertise: Map<bigint, EncryptedScore>;
  // Cryptographic commitment to reputation
  reputationCommitment: string;
  // Timestamp of last update
  lastUpdate: bigint;
}

export interface EncryptedScore {
  // Encrypted score value
  value: string;
  // Nonce for encryption
  nonce: string;
  // Domain ID
  domainId: bigint;
  // Timestamp of last update
  timestamp: bigint;
}

export interface BlindReview {
  // Proposal ID
  proposalId: bigint;
  // Reviewer's pseudonym
  reviewerPseudonym: string;
  // Encrypted review content
  content: string;
  // Encrypted rating
  rating: EncryptedScore;
  // Timestamp
  timestamp: bigint;
  // Cryptographic proof of expertise
  expertiseProof: string;
}

export interface ExpertiseProof {
  // Commitment to expertise score
  scoreCommitment: string;
  // Zero-knowledge proof of score range
  rangeProof: string;
  // Domain ID
  domainId: bigint;
  // Timestamp
  timestamp: bigint;
}

export interface ExpertiseMatchingConfig {
  // Minimum expertise score threshold
  minExpertiseScore: number;
  // Maximum number of reviews per proposal
  maxReviewsPerProposal: number;
  // Review cooldown period (in seconds)
  reviewCooldown: bigint;
  // Rate limiting parameters
  rateLimit: {
    reviewsPerDay: number;
    proposalsPerDay: number;
  };
  // Anomaly detection thresholds
  anomalyThresholds: {
    ratingDeviation: number;
    reviewFrequency: number;
    patternSimilarity: number;
  };
}

export interface ExpertiseEvents {
  ProfileCreated: {
    pseudonym: string;
    timestamp: bigint;
  };
  ProfileUpdated: {
    pseudonym: string;
    domainId: bigint;
    timestamp: bigint;
  };
  ReviewSubmitted: {
    proposalId: bigint;
    reviewerPseudonym: string;
    timestamp: bigint;
  };
  ExpertiseVerified: {
    pseudonym: string;
    domainId: bigint;
    timestamp: bigint;
  };
  AnomalyDetected: {
    pseudonym: string;
    anomalyType: string;
    timestamp: bigint;
  };
}

export interface ExpertiseContract extends BaseContract {
  // Profile Management
  createProfile(pseudonym: string): Promise<ethers.ContractTransactionResponse>;
  updateExpertise(
    pseudonym: string,
    domainId: bigint,
    encryptedScore: EncryptedScore
  ): Promise<ethers.ContractTransactionResponse>;
  getProfile(pseudonym: string): Promise<ExpertiseProfile>;

  // Review Management
  submitReview(
    proposalId: bigint,
    reviewerPseudonym: string,
    content: string,
    rating: EncryptedScore,
    expertiseProof: ExpertiseProof
  ): Promise<ethers.ContractTransactionResponse>;
  getProposalReviews(proposalId: bigint): Promise<BlindReview[]>;

  // Expertise Verification
  verifyExpertise(
    pseudonym: string,
    domainId: bigint,
    proof: ExpertiseProof
  ): Promise<boolean>;
  getExpertiseScore(
    pseudonym: string,
    domainId: bigint
  ): Promise<EncryptedScore>;

  // Anti-Gaming
  checkRateLimit(pseudonym: string): Promise<boolean>;
  detectAnomalies(
    pseudonym: string,
    reviewData: BlindReview
  ): Promise<boolean>;

  // Event Handling
  on<K extends keyof ExpertiseEvents>(
    event: K,
    listener: (event: ExpertiseEvents[K]) => void
  ): Promise<this>;
  off<K extends keyof ExpertiseEvents>(
    event: K,
    listener: (event: ExpertiseEvents[K]) => void
  ): Promise<this>;
} 