import { ethers } from 'ethers';
import { DAOContract, ProposalData, DAOEvents } from '../types/contracts';
import { Proposal, ProposalStatus, ProposalEvent } from '../types/proposals';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';
import { AdminTokenDistributionService } from './adminTokenDistribution';
import { IdeaRegistryService } from './ideaRegistry';
import { WalletConnector } from './wallet/WalletConnector';
import { ContractInterface } from './contracts/ContractInterface';

export class ProposalService {
  private static instance: ProposalService;
  private contract: DAOContract;
  private contractInterface: ContractInterface;
  private adminTokenService: AdminTokenDistributionService;
  private ideaRegistryService: IdeaRegistryService;
  private eventListeners: Map<keyof DAOEvents, Set<(event: ProposalEvent) => void>>;

  private constructor(
    tokenAddress: string,
    logicAddress: string,
    stateAddress: string,
    viewAddress: string,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.eventListeners = new Map();
    
    // Initialize contracts
    this.contract = {
      address: logicAddress,
      provider,
      signer,
      createProposal: jest.fn(),
      vote: jest.fn(),
      executeProposal: jest.fn(),
      cancelProposal: jest.fn(),
      getProposal: jest.fn(),
      getProposalCount: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      isMember: jest.fn(),
      deposit: jest.fn(),
      withdraw: jest.fn(),
      getBalance: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as DAOContract;

    // Initialize contract interface
    this.contractInterface = ContractInterface.getInstance(provider as ethers.BrowserProvider);

    // Initialize admin token service
    this.adminTokenService = AdminTokenDistributionService.getInstance(
      tokenAddress,
      logicAddress,
      stateAddress,
      viewAddress,
      {
        allocationPercentage: 7.407407407,
        distributionInterval: 86400000,
        weights: {
          relayUptime: 0.6,
          usersServed: 0.4,
          governanceActivity: 1.0
        }
      },
      provider,
      new WalletConnector(provider),
      signer
    );

    // Initialize idea registry service
    this.ideaRegistryService = IdeaRegistryService.getInstance(
      logicAddress,
      {
        minRoyaltyRate: 0.1,
        maxRoyaltyRate: 1.8519,
        minSimilarityThreshold: 0.5,
        maxSimilarityThreshold: 0.7,
        analyticsUpdateInterval: 3600000
      },
      provider,
      signer
    );

    this.setupEventListeners();
  }

  public static getInstance(
    tokenAddress: string,
    logicAddress: string,
    stateAddress: string,
    viewAddress: string,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ): ProposalService {
    if (!ProposalService.instance) {
      ProposalService.instance = new ProposalService(
        tokenAddress,
        logicAddress,
        stateAddress,
        viewAddress,
        provider,
        signer
      );
    }
    return ProposalService.instance;
  }

  private setupEventListeners(): void {
    // Handle proposal execution
    this.contract.on('ProposalExecuted', async (event: DAOEvents['ProposalExecuted']) => {
      try {
        // Distribute admin rewards after successful proposal execution
        await this.adminTokenService.distributeRewards();
        
        // Notify listeners
        const proposalEvent: ProposalEvent = {
          proposalId: event.proposalId,
          timestamp: Number(event.timestamp),
          eventType: ProposalStatus.EXECUTED,
          data: {
            executor: event.executor
          }
        };
        
        const listeners = this.eventListeners.get('ProposalExecuted');
        if (listeners) {
          listeners.forEach(listener => listener(proposalEvent));
        }
      } catch (error) {
        errorHandler.handleError(error);
      }
    });

    // Handle proposal creation
    this.contract.on('ProposalCreated', (event: DAOEvents['ProposalCreated']) => {
      const proposalEvent: ProposalEvent = {
        proposalId: event.proposalId,
        timestamp: Number(event.timestamp),
        eventType: ProposalStatus.PENDING,
        data: {
          title: event.title,
          creator: event.creator
        }
      };
      
      const listeners = this.eventListeners.get('ProposalCreated');
      if (listeners) {
        listeners.forEach(listener => listener(proposalEvent));
      }
    });

    // Handle proposal voting
    this.contract.on('ProposalVoted', (event: DAOEvents['ProposalVoted']) => {
      const proposalEvent: ProposalEvent = {
        proposalId: event.proposalId,
        timestamp: Number(event.timestamp),
        eventType: ProposalStatus.ACTIVE,
        data: {
          voter: event.voter,
          support: event.support
        }
      };
      
      const listeners = this.eventListeners.get('ProposalVoted');
      if (listeners) {
        listeners.forEach(listener => listener(proposalEvent));
      }
    });

    // Handle proposal cancellation
    this.contract.on('ProposalCancelled', (event: DAOEvents['ProposalCancelled']) => {
      const proposalEvent: ProposalEvent = {
        proposalId: event.proposalId,
        timestamp: Number(event.timestamp),
        eventType: ProposalStatus.CANCELLED,
        data: {
          canceller: event.canceller
        }
      };
      
      const listeners = this.eventListeners.get('ProposalCancelled');
      if (listeners) {
        listeners.forEach(listener => listener(proposalEvent));
      }
    });
  }

  public async createProposal(
    title: string,
    description: string,
    amount: bigint,
    recipient: string,
    duration: bigint,
    originalIdeaId?: bigint
  ): Promise<Proposal> {
    try {
      // Register idea if this is a new proposal
      let ideaId: bigint | undefined;
      if (!originalIdeaId) {
        const ideaHash = await this.calculateIdeaHash(title, description);
        const idea = await this.ideaRegistryService.registerIdea(
          title,
          description,
          ideaHash
        );
        ideaId = idea.id;
      }

      // Create proposal
      const result = await retryMechanism.executeWithRetry<ProposalData>(async () => {
        const tx = await this.contract.createProposal(
          title,
          description,
          amount,
          recipient,
          duration
        );

        await tx.wait();
        const proposalCount = await this.contract.getProposalCount();
        return await this.contract.getProposal(proposalCount - BigInt(1));
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      // If this is a derivative proposal, calculate similarity and update royalty rate
      if (originalIdeaId && ideaId) {
        const similarity = await this.ideaRegistryService.calculateSimilarity(
          originalIdeaId,
          ideaId
        );

        const timeSinceCreation = Date.now() - Number(
          (await this.ideaRegistryService.getIdea(originalIdeaId)).timestamp
        );

        const royaltyRate = await this.ideaRegistryService.calculateRoyaltyRate(
          originalIdeaId,
          similarity,
          timeSinceCreation
        );

        await this.ideaRegistryService.updateRoyaltyRate(originalIdeaId, royaltyRate);
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  private async calculateIdeaHash(title: string, description: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(title + description);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  public async vote(proposalId: bigint, support: boolean): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.vote(proposalId, support);
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async executeProposal(proposalId: bigint): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.executeProposal(proposalId);
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async cancelProposal(proposalId: bigint): Promise<void> {
    try {
      const result = await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.cancelProposal(proposalId);
        await tx.wait();
      });

      if (!result.success) {
        throw result.error;
      }
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async getProposal(proposalId: bigint): Promise<Proposal> {
    try {
      const result = await retryMechanism.executeWithRetry<ProposalData>(async () => {
        return await this.contract.getProposal(proposalId);
      });

      if (!result.success || !result.result) {
        throw result.error;
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error);
      throw error;
    }
  }

  public async getProposalCount(): Promise<number> {
    try {
      // Get the current state from the tripartite architecture
      const stateConstituent = this.contractInterface.getStateConstituent();
      const currentState = await stateConstituent.getValue('proposal_count');
      const proposalCount = parseInt(currentState) || 0;

      return proposalCount;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'getProposalCount',
        timestamp: Date.now(),
        additionalInfo: {}
      });
      throw error;
    }
  }

  public on<K extends keyof DAOEvents>(
    event: K,
    callback: (event: ProposalEvent) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }

  public off<K extends keyof DAOEvents>(
    event: K,
    callback: (event: ProposalEvent) => void
  ): void {
    this.eventListeners.get(event)?.delete(callback);
  }
} 