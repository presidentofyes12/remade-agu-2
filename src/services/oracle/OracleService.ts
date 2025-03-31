import { ethers } from 'ethers';
import { WalletConnector } from '../wallet/WalletConnector';
import { IKeyManager } from '../../types/KeyManager';
import { VotingPowerService } from '../votingPowerService';
import { ProposalQuorumService } from '../proposalQuorumService';

export interface OracleData {
  id: string;
  timestamp: number;
  value: string;
  source: string;
  status: 'pending' | 'validated' | 'rejected';
  votes: {
    for: bigint;
    against: bigint;
    voters: string[];
    voterTypes: Map<string, 'user' | 'admin' | 'delegate'>;
  };
  proposalId?: string;
}

export interface OracleConfig {
  updateInterval: number;
  requiredVotingPower: bigint;
  validationPeriod: number;
  minVotesRequired: number;
  maxAdminVotingPower: bigint; // Maximum voting power for admin votes
  maxDelegateVotingPower: bigint; // Maximum voting power for delegate votes
  minorityProtectionThreshold: number; // Minimum percentage of minority votes required
  vetoPowerThreshold: number; // Percentage of votes required for veto power
}

export class OracleService {
  private walletConnector: WalletConnector;
  private keyManager: IKeyManager;
  private votingPowerService: VotingPowerService;
  private proposalQuorumService: ProposalQuorumService;
  private configs: Map<string, OracleConfig> = new Map();
  private dataCache: Map<string, OracleData[]> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    walletConnector: WalletConnector,
    keyManager: IKeyManager,
    votingPowerService: VotingPowerService,
    proposalQuorumService: ProposalQuorumService
  ) {
    this.walletConnector = walletConnector;
    this.keyManager = keyManager;
    this.votingPowerService = votingPowerService;
    this.proposalQuorumService = proposalQuorumService;
  }

  public async submitData(data: Omit<OracleData, 'id' | 'status' | 'votes' | 'proposalId'>): Promise<string> {
    try {
      const id = ethers.keccak256(ethers.toUtf8Bytes(`${data.source}-${data.timestamp}-${data.value}`));
      
      const oracleData: OracleData = {
        ...data,
        id,
        status: 'pending',
        votes: {
          for: 0n,
          against: 0n,
          voters: [],
          voterTypes: new Map()
        }
      };

      // Create a proposal for data validation
      const proposalId = await this.createValidationProposal(oracleData);
      oracleData.proposalId = proposalId;

      // Store the data
      const sourceData = this.dataCache.get(data.source) || [];
      sourceData.push(oracleData);
      this.dataCache.set(data.source, sourceData);

      // Start validation period
      this.startValidationPeriod(oracleData);

      return id;
    } catch (error) {
      console.error('Failed to submit data:', error);
      throw new Error('Failed to submit data for validation');
    }
  }

  private async createValidationProposal(data: OracleData): Promise<string> {
    try {
      const proposalId = ethers.keccak256(ethers.toUtf8Bytes(`proposal-${data.id}`));
      
      // Initialize quorum for the proposal
      await this.proposalQuorumService.initializeQuorum(proposalId);

      return proposalId;
    } catch (error) {
      console.error('Failed to create validation proposal:', error);
      throw new Error('Failed to create validation proposal');
    }
  }

  private startValidationPeriod(data: OracleData): void {
    const config = this.configs.get(data.source);
    if (!config) return;

    const interval = setInterval(async () => {
      await this.checkValidationStatus(data);
    }, config.updateInterval);

    this.updateIntervals.set(data.id, interval);
  }

  private async checkValidationStatus(data: OracleData): Promise<void> {
    try {
      if (!data.proposalId) return;

      const quorumStatus = await this.proposalQuorumService.checkQuorumStatus(data.proposalId);
      const config = this.configs.get(data.source);
      if (!config) return;

      // Check if validation period has ended
      const now = Date.now();
      if (now - data.timestamp > config.validationPeriod) {
        this.finalizeValidation(data, quorumStatus);
      }
    } catch (error) {
      console.error('Failed to check validation status:', error);
    }
  }

  private async finalizeValidation(data: OracleData, quorumStatus: any): Promise<void> {
    try {
      // Clear the update interval
      const interval = this.updateIntervals.get(data.id);
      if (interval) {
        clearInterval(interval);
        this.updateIntervals.delete(data.id);
      }

      const config = this.configs.get(data.source);
      if (!config) return;

      // Calculate total voting power
      const totalVotingPower = data.votes.for + data.votes.against;
      
      // Check for minority protection
      const minorityVotes = data.votes.for < data.votes.against ? data.votes.for : data.votes.against;
      const minorityPercentage = (minorityVotes * 100n) / totalVotingPower;
      
      // Check for veto power
      const vetoThreshold = (totalVotingPower * BigInt(config.vetoPowerThreshold)) / 100n;
      
      // Determine validation result based on votes and safeguards
      if (quorumStatus.isQuorumReached) {
        if (minorityPercentage < BigInt(config.minorityProtectionThreshold)) {
          // If minority protection threshold not met, require supermajority
          const supermajorityThreshold = 66n; // 2/3 majority
          const majorityPercentage = (data.votes.for * 100n) / totalVotingPower;
          data.status = majorityPercentage >= supermajorityThreshold ? 'validated' : 'rejected';
        } else if (minorityVotes > vetoThreshold) {
          // If veto threshold is met, reject the proposal
          data.status = 'rejected';
        } else {
          // Normal majority vote
          data.status = data.votes.for > data.votes.against ? 'validated' : 'rejected';
        }
      } else {
        data.status = 'rejected';
      }

      // Update the data in cache
      const sourceData = this.dataCache.get(data.source) || [];
      const index = sourceData.findIndex(d => d.id === data.id);
      if (index !== -1) {
        sourceData[index] = data;
        this.dataCache.set(data.source, sourceData);
      }
    } catch (error) {
      console.error('Failed to finalize validation:', error);
    }
  }

  public async voteOnData(dataId: string, vote: boolean): Promise<void> {
    try {
      const data = this.findDataById(dataId);
      if (!data || data.status !== 'pending' || !data.proposalId) {
        throw new Error('Invalid data or data not pending validation');
      }

      const voter = await this.walletConnector.getAddress();
      if (!voter) {
        throw new Error('No wallet connected');
      }

      // Check if voter has already voted
      if (data.votes.voters.includes(voter)) {
        throw new Error('Already voted on this data');
      }

      // Get voter's role and voting power
      const isAdmin = await this.keyManager.isAdmin(voter);
      const isDelegate = await this.votingPowerService.isDelegate(voter);
      const baseVotingPower = await this.votingPowerService.getEffectiveVotingPower(voter);
      
      if (baseVotingPower <= 0n) {
        throw new Error('Insufficient voting power');
      }

      // Apply voting power caps based on role
      let votingPower = baseVotingPower;
      const config = this.configs.get(data.source);
      if (config) {
        if (isAdmin) {
          votingPower = BigInt(Math.min(Number(votingPower), Number(config.maxAdminVotingPower)));
        } else if (isDelegate) {
          votingPower = BigInt(Math.min(Number(votingPower), Number(config.maxDelegateVotingPower)));
        }
      }

      // Record the vote with voter type
      if (vote) {
        data.votes.for += votingPower;
      } else {
        data.votes.against += votingPower;
      }
      data.votes.voters.push(voter);
      data.votes.voterTypes.set(voter, isAdmin ? 'admin' : isDelegate ? 'delegate' : 'user');

      // Update the data in cache
      const sourceData = this.dataCache.get(data.source) || [];
      const index = sourceData.findIndex(d => d.id === dataId);
      if (index !== -1) {
        sourceData[index] = data;
        this.dataCache.set(data.source, sourceData);
      }
    } catch (error) {
      console.error('Failed to vote on data:', error);
      throw new Error('Failed to vote on data');
    }
  }

  private findDataById(dataId: string): OracleData | undefined {
    for (const data of this.dataCache.values()) {
      const found = data.find(d => d.id === dataId);
      if (found) return found;
    }
    return undefined;
  }

  public async getData(source: string): Promise<OracleData[]> {
    return this.dataCache.get(source) || [];
  }

  public async getValidatedData(source: string): Promise<OracleData[]> {
    const data = this.dataCache.get(source) || [];
    return data.filter(d => d.status === 'validated');
  }

  public setConfig(source: string, config: OracleConfig): void {
    this.configs.set(source, config);
  }
} 