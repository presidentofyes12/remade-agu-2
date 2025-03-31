import { ethers } from 'ethers';
import { VotingPowerService } from './votingPowerService';
import { LoadingStateService } from './loadingStateService';
import { 
  ProposalQuorumManager, 
  QuorumStatus, 
  QuorumConfig, 
  QuorumEvents 
} from '../types/proposalQuorum';

export class ProposalQuorumService implements ProposalQuorumManager {
  private static instance: ProposalQuorumService;
  private votingPowerService: VotingPowerService;
  private loadingStateService: LoadingStateService;
  private quorumData: Map<string, QuorumStatus> = new Map();
  private proposalVotes: Map<string, Map<string, bigint>> = new Map();
  private eventListeners: Map<keyof QuorumEvents, Set<(event: QuorumEvents[keyof QuorumEvents]) => void>> = new Map();

  private constructor(
    votingPowerService: VotingPowerService,
    loadingStateService: LoadingStateService
  ) {
    this.votingPowerService = votingPowerService;
    this.loadingStateService = loadingStateService;
  }

  public static getInstance(
    votingPowerService: VotingPowerService,
    loadingStateService: LoadingStateService
  ): ProposalQuorumService {
    if (!ProposalQuorumService.instance) {
      ProposalQuorumService.instance = new ProposalQuorumService(
        votingPowerService,
        loadingStateService
      );
    }
    return ProposalQuorumService.instance;
  }

  public async initializeQuorum(proposalId: string): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const totalVotingPower = await this.calculateTotalVotingPower();
      const requiredQuorum = await this.calculateRequiredQuorum(proposalId);

      const quorumStatus: QuorumStatus = {
        currentQuorum: 0n,
        requiredQuorum,
        totalVotingPower,
        currentVotingPower: 0n,
        quorumPercentage: 0,
        isQuorumReached: false,
        timeRemaining: 0
      };

      this.quorumData.set(proposalId, quorumStatus);
      this.proposalVotes.set(proposalId, new Map());

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async updateQuorum(proposalId: string): Promise<void> {
    try {
      const oldStatus = this.quorumData.get(proposalId);
      if (!oldStatus) {
        throw new Error('Quorum not initialized for proposal');
      }

      const newStatus = await this.checkQuorumStatus(proposalId);
      
      if (oldStatus.currentQuorum !== newStatus.currentQuorum) {
        this.emitEvent('QuorumUpdated', {
          proposalId,
          oldQuorum: oldStatus.currentQuorum,
          newQuorum: newStatus.currentQuorum,
          timestamp: BigInt(Date.now())
        });

        if (newStatus.isQuorumReached) {
          this.emitEvent('QuorumReached', {
            proposalId,
            quorum: newStatus.currentQuorum,
            timestamp: BigInt(Date.now())
          });
        }
      }
    } catch (error) {
      console.error('Failed to update quorum:', error);
      throw error;
    }
  }

  public async checkQuorumStatus(proposalId: string): Promise<QuorumStatus> {
    try {
      const quorumStatus = this.quorumData.get(proposalId);
      if (!quorumStatus) {
        throw new Error('Quorum not initialized for proposal');
      }

      // Calculate current voting power
      const votes = this.proposalVotes.get(proposalId);
      if (!votes) {
        throw new Error('Votes not found for proposal');
      }

      let currentVotingPower = 0n;
      for (const [voter, power] of votes) {
        currentVotingPower += power;
      }

      // Update quorum status
      const currentQuorum = (currentVotingPower * 100n) / quorumStatus.totalVotingPower;
      const isQuorumReached = currentQuorum >= quorumStatus.requiredQuorum;

      const updatedStatus: QuorumStatus = {
        ...quorumStatus,
        currentQuorum,
        currentVotingPower,
        quorumPercentage: Number(currentQuorum),
        isQuorumReached,
        timeRemaining: 0 // This would be calculated based on proposal end time
      };

      this.quorumData.set(proposalId, updatedStatus);
      return updatedStatus;
    } catch (error) {
      console.error('Failed to check quorum status:', error);
      throw error;
    }
  }

  public async calculateRequiredQuorum(proposalId: string): Promise<bigint> {
    // This would be implemented based on DAO governance rules
    // For now, requiring 51% of total voting power
    const totalVotingPower = await this.calculateTotalVotingPower();
    return (totalVotingPower * 51n) / 100n;
  }

  public async calculateCurrentQuorum(proposalId: string): Promise<bigint> {
    const status = await this.checkQuorumStatus(proposalId);
    return status.currentQuorum;
  }

  public async calculateQuorumPercentage(proposalId: string): Promise<number> {
    const status = await this.checkQuorumStatus(proposalId);
    return status.quorumPercentage;
  }

  public validateQuorumConfig(config: QuorumConfig): boolean {
    try {
      if (config.minQuorumPercentage < 0 || config.minQuorumPercentage > 100) {
        return false;
      }
      if (config.maxQuorumPercentage < config.minQuorumPercentage || config.maxQuorumPercentage > 100) {
        return false;
      }
      if (config.quorumGrowthRate < 0 || config.quorumGrowthRate > 1) {
        return false;
      }
      if (config.quorumGrowthPeriod < 0) {
        return false;
      }
      if (config.minVotingPeriod < 0 || config.minVotingPeriod > config.maxVotingPeriod) {
        return false;
      }
      if (config.maxVotingPeriod < config.minVotingPeriod) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to validate quorum config:', error);
      return false;
    }
  }

  public async validateProposalQuorum(proposalId: string): Promise<boolean> {
    try {
      const status = await this.checkQuorumStatus(proposalId);
      return status.isQuorumReached;
    } catch (error) {
      console.error('Failed to validate proposal quorum:', error);
      return false;
    }
  }

  public on<K extends keyof QuorumEvents>(
    event: K,
    listener: (event: QuorumEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: QuorumEvents[keyof QuorumEvents]) => void);
  }

  public off<K extends keyof QuorumEvents>(
    event: K,
    listener: (event: QuorumEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: QuorumEvents[keyof QuorumEvents]) => void);
  }

  private async calculateTotalVotingPower(): Promise<bigint> {
    // This would be implemented to calculate total voting power across all token holders
    // For now, returning a mock value
    return 1000000n;
  }

  private emitEvent<K extends keyof QuorumEvents>(
    event: K,
    data: QuorumEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
} 