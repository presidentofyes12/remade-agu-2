import { ethers } from 'ethers';

export interface QuorumConfig {
  minQuorumPercentage: number; // Minimum percentage of total voting power required
  maxQuorumPercentage: number; // Maximum percentage of total voting power required
  quorumGrowthRate: number; // Rate at which quorum increases over time
  quorumGrowthPeriod: number; // Period in seconds for quorum growth
  minVotingPeriod: number; // Minimum voting period in seconds
  maxVotingPeriod: number; // Maximum voting period in seconds
}

export interface QuorumStatus {
  currentQuorum: bigint;
  requiredQuorum: bigint;
  totalVotingPower: bigint;
  currentVotingPower: bigint;
  quorumPercentage: number;
  isQuorumReached: boolean;
  timeRemaining: number;
}

export interface QuorumEvents {
  QuorumUpdated: {
    proposalId: string;
    oldQuorum: bigint;
    newQuorum: bigint;
    timestamp: bigint;
  };
  QuorumReached: {
    proposalId: string;
    quorum: bigint;
    timestamp: bigint;
  };
  QuorumFailed: {
    proposalId: string;
    quorum: bigint;
    timestamp: bigint;
  };
}

export interface ProposalQuorumManager {
  // Quorum Management
  initializeQuorum(proposalId: string): Promise<void>;
  updateQuorum(proposalId: string): Promise<void>;
  checkQuorumStatus(proposalId: string): Promise<QuorumStatus>;
  
  // Quorum Calculations
  calculateRequiredQuorum(proposalId: string): Promise<bigint>;
  calculateCurrentQuorum(proposalId: string): Promise<bigint>;
  calculateQuorumPercentage(proposalId: string): Promise<number>;
  
  // Validation
  validateQuorumConfig(config: QuorumConfig): boolean;
  validateProposalQuorum(proposalId: string): Promise<boolean>;
  
  // Event Listeners
  on<K extends keyof QuorumEvents>(
    event: K,
    listener: (event: QuorumEvents[K]) => void
  ): void;
  
  off<K extends keyof QuorumEvents>(
    event: K,
    listener: (event: QuorumEvents[K]) => void
  ): void;
} 