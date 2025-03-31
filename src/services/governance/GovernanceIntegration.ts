import { ContractInterface } from '../contracts/ContractInterface';
import { WalletConnector } from '../wallet/WalletConnector';
import { KeyManager } from '../wallet/KeyManager';
import { ethers } from 'ethers';
import { errorHandler } from '../../utils/errorHandler';

export class GovernanceIntegration {
  private contractInterface: ContractInterface;

  constructor(
    private provider: ethers.BrowserProvider,
    private walletConnector: WalletConnector,
    private keyManager: KeyManager
  ) {
    this.contractInterface = ContractInterface.getInstance(provider);
  }

  async createProposal(
    title: string,
    description: string,
    amount: bigint,
    recipient: string,
    duration: bigint
  ): Promise<void> {
    try {
      // Get the current state from the tripartite architecture
      const stateConstituent = this.contractInterface.getStateConstituent();
      const currentState = await stateConstituent.getValue('proposal_count');
      const proposalCount = parseInt(currentState) || 0;

      // Create proposal in the tripartite architecture
      const logicConstituent = this.contractInterface.getLogicConstituent();
      await logicConstituent.createProposal(
        title,
        description,
        amount,
        recipient,
        duration
      );
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'createProposal',
        timestamp: Date.now(),
        additionalInfo: {
          title,
          description,
          amount,
          recipient,
          duration
        }
      });
      throw error;
    }
  }

  async castVote(
    proposalId: number,
    support: boolean,
    votes: bigint
  ): Promise<void> {
    // Get proposal data
    const proposalData = await this.contractInterface.getConceptValue(
      `proposal_${proposalId}`
    );
    const proposal = JSON.parse(proposalData);

    // Verify voting period
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < proposal.startTime || currentTime > proposal.endTime) {
      throw new Error('Voting period is not active');
    }

    // Get voter's token balance
    const voterAddress = await this.walletConnector.getAddress();
    const tokenBalance = await this.contractInterface.getTokenBalance(voterAddress);
    
    if (votes > tokenBalance) {
      throw new Error('Insufficient voting power');
    }

    // Record vote in the tripartite architecture
    const voteData = {
      proposalId,
      voter: voterAddress,
      support,
      votes: votes.toString(),
      timestamp: currentTime
    };

    await this.contractInterface.mapConceptValue(
      `vote_${proposalId}_${voterAddress}`,
      JSON.stringify(voteData)
    );

    // Update proposal vote count
    await this.contractInterface.executeLogic(
      ethers.keccak256(ethers.toUtf8Bytes('update_proposal_votes'))
    );
  }

  async executeProposal(proposalId: bigint): Promise<void> {
    try {
      const logicConstituent = this.contractInterface.getLogicConstituent();
      await logicConstituent.executeProposal(proposalId);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'executeProposal',
        timestamp: Date.now(),
        additionalInfo: { proposalId }
      });
      throw error;
    }
  }

  async getProposalDetails(proposalId: number): Promise<any> {
    const proposalData = await this.contractInterface.getConceptValue(
      `proposal_${proposalId}`
    );
    const proposal = JSON.parse(proposalData);

    // Get vote results
    const tripartiteComputations = this.contractInterface.getTripartiteComputations();
    const voteResults = await tripartiteComputations.compute(
      ethers.keccak256(ethers.toUtf8Bytes(`proposal_${proposalId}_results`))
    );
    const results = JSON.parse(voteResults);

    return {
      ...proposal,
      voteResults: results
    };
  }

  public async getProposalCount(): Promise<number> {
    try {
      const stateConstituent = this.contractInterface.getStateConstituent();
      const currentState = await stateConstituent.getValue('proposal_count');
      return parseInt(currentState) || 0;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'getProposalCount',
        timestamp: Date.now(),
        additionalInfo: {}
      });
      throw error;
    }
  }

  public async getVotingPower(address: string): Promise<bigint> {
    try {
      const daoToken = this.contractInterface.getDAOToken();
      return await daoToken.balanceOf(address);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'getVotingPower',
        timestamp: Date.now(),
        additionalInfo: { address }
      });
      throw error;
    }
  }

  async delegateVotingPower(to: string): Promise<void> {
    const from = await this.walletConnector.getAddress();
    const votingPower = await this.getVotingPower(from);

    // Record delegation in the tripartite architecture
    const delegationData = {
      from,
      to,
      amount: votingPower.toString(),
      timestamp: Math.floor(Date.now() / 1000)
    };

    await this.contractInterface.mapConceptValue(
      `delegation_${from}_${to}`,
      JSON.stringify(delegationData)
    );

    // Execute delegation logic
    await this.contractInterface.executeLogic(
      ethers.keccak256(ethers.toUtf8Bytes('update_delegation'))
    );
  }

  async getDelegatedVotingPower(address: string): Promise<bigint> {
    const delegationData = await this.contractInterface.getConceptValue(
      `delegation_${address}`
    );
    if (!delegationData) return BigInt(0);

    const delegations = JSON.parse(delegationData);
    return delegations.reduce((acc: bigint, d: any) => acc + BigInt(d.amount), BigInt(0));
  }

  public async computeValue(value: bigint): Promise<bigint> {
    try {
      const tripartiteComputations = this.contractInterface.getTripartiteComputations();
      const result = await tripartiteComputations.computeValue(value);
      return BigInt(result) || 0n;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'computeValue',
        timestamp: Date.now(),
        additionalInfo: { value }
      });
      throw error;
    }
  }

  async vote(proposalId: bigint, votes: bigint): Promise<void> {
    try {
      // Get voter's token balance
      const voterAddress = await this.walletConnector.getAddress();
      const daoToken = this.contractInterface.getDAOToken();
      const tokenBalance = await daoToken.balanceOf(voterAddress);
      
      if (votes > tokenBalance) {
        throw new Error('Insufficient voting power');
      }

      // Cast vote in the tripartite architecture
      const logicConstituent = this.contractInterface.getLogicConstituent();
      await logicConstituent.vote(proposalId, votes);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'vote',
        timestamp: Date.now(),
        additionalInfo: { proposalId, votes }
      });
      throw error;
    }
  }
} 