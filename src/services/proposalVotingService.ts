import { ethers } from 'ethers';
import { 
  ProposalVotingManager, 
  Vote, 
  VoteType,
  VoteConfig,
  VoteEvents
} from '../types/proposalVoting';
import { errorHandler } from '../utils/errorHandler';
import { LoadingStateService } from './loadingStateService';
import { VotingPowerService } from './votingPowerService';

export class ProposalVotingService implements ProposalVotingManager {
  private static instance: ProposalVotingService;
  private loadingStateService: LoadingStateService;
  private votingPowerService: VotingPowerService;
  private config: VoteConfig;
  private eventListeners: Map<keyof VoteEvents, Set<(event: VoteEvents[keyof VoteEvents]) => void>>;
  private votes: Map<string, Vote>;

  private constructor(
    loadingStateService: LoadingStateService,
    votingPowerService: VotingPowerService,
    config: VoteConfig
  ) {
    this.loadingStateService = loadingStateService;
    this.votingPowerService = votingPowerService;
    this.config = config;
    this.eventListeners = new Map();
    this.votes = new Map();
  }

  public static getInstance(
    loadingStateService: LoadingStateService,
    votingPowerService: VotingPowerService,
    config: VoteConfig
  ): ProposalVotingService {
    if (!ProposalVotingService.instance) {
      ProposalVotingService.instance = new ProposalVotingService(
        loadingStateService,
        votingPowerService,
        config
      );
    }
    return ProposalVotingService.instance;
  }

  public async castVote(
    proposalId: string,
    voteType: VoteType,
    reason?: string
  ): Promise<string> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const voter = await this.getCurrentUser();
      const votingPower = await this.votingPowerService.getEffectiveVotingPower(voter);

      // Validate vote
      if (!await this.validateVote(proposalId, voter, voteType, votingPower)) {
        throw new Error('Invalid vote parameters');
      }

      // Generate unique ID
      const id = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify({ proposalId, voter, voteType, votingPower }) + Date.now())
      );

      // Create vote
      const vote: Vote = {
        id,
        proposalId,
        voter,
        voteType,
        votingPower,
        timestamp: Date.now(),
        metadata: {
          reason,
          tags: []
        }
      };

      // Store vote
      this.votes.set(id, vote);

      // Emit event
      this.emitEvent('VoteCast', {
        id,
        proposalId,
        voter,
        voteType,
        votingPower,
        timestamp: BigInt(Date.now())
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
      return id;
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async changeVote(
    voteId: string,
    newVoteType: VoteType,
    reason?: string
  ): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const vote = this.votes.get(voteId);
      if (!vote) {
        throw new Error('Vote not found');
      }

      // Validate vote change
      const voterVotes = await this.getVotesByVoter(vote.voter);
      const voteChanges = voterVotes.filter(v => v.metadata.tags.includes('changed')).length;
      if (voteChanges >= this.config.maxVoteChanges) {
        throw new Error('Maximum vote changes reached');
      }

      // Update vote
      const updatedVote: Vote = {
        ...vote,
        voteType: newVoteType,
        metadata: {
          ...vote.metadata,
          reason,
          tags: [...vote.metadata.tags, 'changed']
        }
      };

      // Store updated vote
      this.votes.set(voteId, updatedVote);

      // Emit event
      this.emitEvent('VoteChanged', {
        id: voteId,
        proposalId: vote.proposalId,
        voter: vote.voter,
        oldVoteType: vote.voteType,
        newVoteType,
        votingPower: vote.votingPower,
        timestamp: BigInt(Date.now())
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async revokeVote(voteId: string): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const vote = this.votes.get(voteId);
      if (!vote) {
        throw new Error('Vote not found');
      }

      // Validate revocation
      const now = Date.now();
      if (now - vote.timestamp < this.config.cooldownPeriod * 1000) {
        throw new Error('Vote revocation too soon');
      }

      // Update vote
      const updatedVote: Vote = {
        ...vote,
        metadata: {
          ...vote.metadata,
          tags: [...vote.metadata.tags, 'revoked']
        }
      };

      // Store updated vote
      this.votes.set(voteId, updatedVote);

      // Emit event
      this.emitEvent('VoteRevoked', {
        id: voteId,
        proposalId: vote.proposalId,
        voter: vote.voter,
        voteType: vote.voteType,
        votingPower: vote.votingPower,
        timestamp: BigInt(now)
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async getVote(id: string): Promise<Vote | undefined> {
    return this.votes.get(id);
  }

  public async getVotesByProposal(proposalId: string): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(v => v.proposalId === proposalId);
  }

  public async getVotesByVoter(address: string): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(v => v.voter === address);
  }

  public async getVotingPower(address: string): Promise<bigint> {
    return this.votingPowerService.getEffectiveVotingPower(address);
  }

  public async getProposalVoteCount(proposalId: string): Promise<{
    yes: bigint;
    no: bigint;
    abstain: bigint;
    total: bigint;
  }> {
    const votes = await this.getVotesByProposal(proposalId);
    const counts = {
      yes: BigInt(0),
      no: BigInt(0),
      abstain: BigInt(0),
      total: BigInt(0)
    };

    for (const vote of votes) {
      if (!vote.metadata.tags.includes('revoked')) {
        counts[vote.voteType] += vote.votingPower;
        counts.total += vote.votingPower;
      }
    }

    return counts;
  }

  public async validateVote(
    proposalId: string,
    voter: string,
    voteType: VoteType,
    votingPower: bigint
  ): Promise<boolean> {
    try {
      // Validate address
      if (!ethers.isAddress(voter)) {
        return false;
      }

      // Validate voting power
      if (votingPower < this.config.minVotingPower) {
        return false;
      }

      // Validate vote type
      if (!['yes', 'no', 'abstain'].includes(voteType)) {
        return false;
      }

      // Check if voter has already voted
      const existingVotes = await this.getVotesByVoter(voter);
      const proposalVote = existingVotes.find(v => v.proposalId === proposalId);
      if (proposalVote && !proposalVote.metadata.tags.includes('revoked')) {
        return false;
      }

      return true;
    } catch (error) {
      errorHandler.handleError(error);
      return false;
    }
  }

  public on<K extends keyof VoteEvents>(
    event: K,
    listener: (event: VoteEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: VoteEvents[keyof VoteEvents]) => void);
  }

  public off<K extends keyof VoteEvents>(
    event: K,
    listener: (event: VoteEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: VoteEvents[keyof VoteEvents]) => void);
  }

  public async getCurrentUser(): Promise<string> {
    // This would be implemented to get the current user's address
    return '0x0000000000000000000000000000000000000000';
  }

  private emitEvent<K extends keyof VoteEvents>(
    event: K,
    data: VoteEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
} 