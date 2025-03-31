import { ethers } from 'ethers';

export type VoteType = 
  | 'yes'      // Support the proposal
  | 'no'       // Oppose the proposal
  | 'abstain'; // Abstain from voting

export interface Vote {
  id: string;
  proposalId: string;
  voter: string;
  voteType: VoteType;
  votingPower: bigint;
  timestamp: number;
  metadata: {
    reason?: string;
    tags: string[];
  };
}

export interface VoteEvents {
  VoteCast: {
    id: string;
    proposalId: string;
    voter: string;
    voteType: VoteType;
    votingPower: bigint;
    timestamp: bigint;
  };
  VoteChanged: {
    id: string;
    proposalId: string;
    voter: string;
    oldVoteType: VoteType;
    newVoteType: VoteType;
    votingPower: bigint;
    timestamp: bigint;
  };
  VoteRevoked: {
    id: string;
    proposalId: string;
    voter: string;
    voteType: VoteType;
    votingPower: bigint;
    timestamp: bigint;
  };
}

export interface VoteConfig {
  minVotingPower: bigint;
  votingPeriod: number; // in seconds
  cooldownPeriod: number; // in seconds
  maxVoteChanges: number;
  requireReason: boolean;
}

export interface ProposalVotingManager {
  // Vote Management
  castVote(
    proposalId: string,
    voteType: VoteType,
    reason?: string
  ): Promise<string>;
  
  changeVote(
    voteId: string,
    newVoteType: VoteType,
    reason?: string
  ): Promise<void>;
  
  revokeVote(voteId: string): Promise<void>;
  
  // Vote Queries
  getVote(id: string): Promise<Vote | undefined>;
  getVotesByProposal(proposalId: string): Promise<Vote[]>;
  getVotesByVoter(address: string): Promise<Vote[]>;
  getVotingPower(address: string): Promise<bigint>;
  
  // Vote Calculations
  getProposalVoteCount(proposalId: string): Promise<{
    yes: bigint;
    no: bigint;
    abstain: bigint;
    total: bigint;
  }>;
  
  // Validation
  validateVote(
    proposalId: string,
    voter: string,
    voteType: VoteType,
    votingPower: bigint
  ): Promise<boolean>;
  
  // Event Listeners
  on<K extends keyof VoteEvents>(
    event: K,
    listener: (event: VoteEvents[K]) => void
  ): void;
  
  off<K extends keyof VoteEvents>(
    event: K,
    listener: (event: VoteEvents[K]) => void
  ): void;
} 