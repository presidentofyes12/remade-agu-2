import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProposalVotingService } from '../proposalVotingService';
import { LoadingStateService } from '../loadingStateService';
import { VotingPowerService } from '../votingPowerService';
import { errorHandler } from '../../utils/errorHandler';
import { VoteType, VoteConfig, Vote } from '../../types/proposalVoting';

// Mock dependencies
jest.mock('../../utils/errorHandler');
jest.mock('../loadingStateService');
jest.mock('../votingPowerService');

// Test utilities
class ProposalVotingTestFactory {
  static createDefaultConfig(): VoteConfig {
    return {
      minVotingPower: BigInt(1000),
      votingPeriod: 86400, // 24 hours
      cooldownPeriod: 3600, // 1 hour
      maxVoteChanges: 3,
      requireReason: true
    };
  }

  static createMockLoadingStateService(): jest.Mocked<LoadingStateService> {
    return {
      startOperation: jest.fn(),
      updateProgress: jest.fn(),
      completeOperation: jest.fn(),
      getOperationState: jest.fn(),
      getActiveOperations: jest.fn(),
      getOperationProgress: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      cleanup: jest.fn()
    } as unknown as jest.Mocked<LoadingStateService>;
  }

  static createMockVotingPowerService(): jest.Mocked<VotingPowerService> {
    const mock = {
      createDelegation: jest.fn(),
      updateDelegation: jest.fn(),
      revokeDelegation: jest.fn(),
      getDelegation: jest.fn(),
      getDelegationsByDelegator: jest.fn(),
      getDelegationsByDelegate: jest.fn(),
      getEffectiveVotingPower: jest.fn(),
      validateDelegation: jest.fn(),
      getActiveDelegations: jest.fn(),
      getDelegatedVotingPower: jest.fn(),
      getAvailableVotingPower: jest.fn(),
      getCurrentUser: jest.fn(),
      isDelegate: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<VotingPowerService>;

    // Set up mock implementations
    (mock.getEffectiveVotingPower as jest.Mock).mockResolvedValue(BigInt(1000));
    (mock.validateDelegation as jest.Mock).mockResolvedValue(true);
    (mock.getActiveDelegations as jest.Mock).mockResolvedValue([]);
    (mock.getDelegatedVotingPower as jest.Mock).mockResolvedValue(BigInt(500));
    (mock.getAvailableVotingPower as jest.Mock).mockResolvedValue(BigInt(500));
    (mock.getCurrentUser as jest.Mock).mockResolvedValue('0x123');
    (mock.isDelegate as jest.Mock).mockResolvedValue(false);

    return mock;
  }

  static createMockVote(
    proposalId: string,
    voter: string,
    voteType: VoteType = 'yes',
    votingPower: bigint = BigInt(1000)
  ): Vote {
    return {
      id: `vote-${Date.now()}`,
      proposalId,
      voter,
      voteType,
      votingPower,
      timestamp: Date.now(),
      metadata: {
        reason: 'Test vote',
        tags: []
      }
    };
  }
}

describe('ProposalVotingService', () => {
  let proposalVotingService: ProposalVotingService;
  let mockLoadingStateService: jest.Mocked<LoadingStateService>;
  let mockVotingPowerService: jest.Mocked<VotingPowerService>;
  let mockConfig: VoteConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize test data
    mockConfig = ProposalVotingTestFactory.createDefaultConfig();
    mockLoadingStateService = ProposalVotingTestFactory.createMockLoadingStateService();
    mockVotingPowerService = ProposalVotingTestFactory.createMockVotingPowerService();
    
    // Initialize service
    proposalVotingService = ProposalVotingService.getInstance(
      mockLoadingStateService,
      mockVotingPowerService,
      mockConfig
    );
  });

  describe('Initialization', () => {
    it('should maintain singleton instance', () => {
      const instance1 = ProposalVotingService.getInstance(
        mockLoadingStateService,
        mockVotingPowerService,
        mockConfig
      );
      const instance2 = ProposalVotingService.getInstance(
        mockLoadingStateService,
        mockVotingPowerService,
        mockConfig
      );
      expect(instance1).toBe(instance2);
    });
  });

  describe('Vote Management', () => {
    const proposalId = 'proposal-123';
    const voter = '0x123';
    const votingPower = BigInt(1000);

    beforeEach(() => {
      mockVotingPowerService.getEffectiveVotingPower.mockResolvedValue(votingPower);
    });

    it('should cast vote successfully', async () => {
      const voteId = await proposalVotingService.castVote(
        proposalId,
        'yes',
        'Supporting the proposal'
      );

      expect(voteId).toBeDefined();
      expect(mockLoadingStateService.startOperation).toHaveBeenCalledWith('contractInteraction');
      expect(mockLoadingStateService.completeOperation).toHaveBeenCalledWith('contractInteraction', true);
    });

    it('should change vote successfully', async () => {
      const vote = ProposalVotingTestFactory.createMockVote(proposalId, voter);
      const newVoteType: VoteType = 'no';

      await proposalVotingService.changeVote(
        vote.id,
        newVoteType,
        'Changed my mind'
      );

      expect(mockLoadingStateService.startOperation).toHaveBeenCalledWith('contractInteraction');
      expect(mockLoadingStateService.completeOperation).toHaveBeenCalledWith('contractInteraction', true);
    });

    it('should revoke vote successfully', async () => {
      const vote = ProposalVotingTestFactory.createMockVote(proposalId, voter);

      await proposalVotingService.revokeVote(vote.id);

      expect(mockLoadingStateService.startOperation).toHaveBeenCalledWith('contractInteraction');
      expect(mockLoadingStateService.completeOperation).toHaveBeenCalledWith('contractInteraction', true);
    });

    it('should fail to revoke vote before cooldown period', async () => {
      const vote = ProposalVotingTestFactory.createMockVote(proposalId, voter);

      await expect(proposalVotingService.revokeVote(vote.id))
        .rejects
        .toThrow('Vote revocation too soon');
    });

    it('should fail to change vote after max changes reached', async () => {
      const vote = ProposalVotingTestFactory.createMockVote(proposalId, voter);
      const voterVotes = Array(mockConfig.maxVoteChanges).fill(null).map(() => ({
        ...vote,
        metadata: { ...vote.metadata, tags: ['changed'] }
      }));

      jest.spyOn(proposalVotingService as any, 'getVotesByVoter')
        .mockResolvedValue(voterVotes);

      await expect(proposalVotingService.changeVote(vote.id, 'no'))
        .rejects
        .toThrow('Maximum vote changes reached');
    });
  });

  describe('Vote Queries', () => {
    const proposalId = 'proposal-123';
    const voter = '0x123';
    const vote = ProposalVotingTestFactory.createMockVote(proposalId, voter);

    it('should get vote by id', async () => {
      const result = await proposalVotingService.getVote(vote.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(vote.id);
    });

    it('should get votes by proposal', async () => {
      const result = await proposalVotingService.getVotesByProposal(proposalId);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].proposalId).toBe(proposalId);
    });

    it('should get votes by voter', async () => {
      const result = await proposalVotingService.getVotesByVoter(voter);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].voter).toBe(voter);
    });

    it('should get voting power', async () => {
      const result = await proposalVotingService.getVotingPower(voter);
      expect(result).toBeDefined();
      expect(typeof result).toBe('bigint');
    });
  });

  describe('Vote Calculations', () => {
    const proposalId = 'proposal-123';

    it('should calculate proposal vote count', async () => {
      const result = await proposalVotingService.getProposalVoteCount(proposalId);
      expect(result).toBeDefined();
      expect(typeof result.yes).toBe('bigint');
      expect(typeof result.no).toBe('bigint');
      expect(typeof result.abstain).toBe('bigint');
      expect(typeof result.total).toBe('bigint');
    });
  });

  describe('Validation', () => {
    const proposalId = 'proposal-123';
    const voter = '0x123';
    const votingPower = BigInt(1000);

    it('should validate vote parameters', async () => {
      const result = await proposalVotingService.validateVote(
        proposalId,
        voter,
        'yes',
        votingPower
      );
      expect(result).toBe(true);
    });

    it('should reject vote with insufficient voting power', async () => {
      const result = await proposalVotingService.validateVote(
        proposalId,
        voter,
        'yes',
        BigInt(500) // Less than minVotingPower
      );
      expect(result).toBe(false);
    });

    it('should reject vote without reason when required', async () => {
      const config = {
        ...mockConfig,
        requireReason: true
      };
      proposalVotingService = ProposalVotingService.getInstance(
        mockLoadingStateService,
        mockVotingPowerService,
        config
      );

      await expect(proposalVotingService.castVote(proposalId, 'yes'))
        .rejects
        .toThrow('Vote reason is required');
    });
  });

  describe('Event Handling', () => {
    it('should emit vote cast event', async () => {
      const listener = jest.fn();
      proposalVotingService.on('VoteCast', listener);

      const vote = ProposalVotingTestFactory.createMockVote('proposal-123', '0x123');
      await proposalVotingService.castVote(
        vote.proposalId,
        vote.voteType,
        'Test vote'
      );

      expect(listener).toHaveBeenCalled();
    });

    it('should emit vote changed event', async () => {
      const listener = jest.fn();
      proposalVotingService.on('VoteChanged', listener);

      const vote = ProposalVotingTestFactory.createMockVote('proposal-123', '0x123');
      await proposalVotingService.changeVote(
        vote.id,
        'no',
        'Changed my mind'
      );

      expect(listener).toHaveBeenCalled();
    });

    it('should emit vote revoked event', async () => {
      const listener = jest.fn();
      proposalVotingService.on('VoteRevoked', listener);

      const vote = ProposalVotingTestFactory.createMockVote('proposal-123', '0x123');
      await proposalVotingService.revokeVote(vote.id);

      expect(listener).toHaveBeenCalled();
    });

    it('should remove event listeners', async () => {
      const listener = jest.fn();
      proposalVotingService.on('VoteCast', listener);

      const vote = ProposalVotingTestFactory.createMockVote('proposal-123', '0x123');
      await proposalVotingService.castVote(
        vote.proposalId,
        vote.voteType,
        'Test vote'
      );

      expect(listener).toHaveBeenCalled();

      proposalVotingService.off('VoteCast', listener);
      await proposalVotingService.castVote(
        vote.proposalId,
        vote.voteType,
        'Test vote'
      );

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle vote casting errors', async () => {
      const invalidVotingPower = BigInt(500); // Less than minVotingPower
      mockVotingPowerService.getEffectiveVotingPower.mockResolvedValue(invalidVotingPower);

      await expect(proposalVotingService.castVote(
        'proposal-123',
        'yes',
        'Test vote'
      )).rejects.toThrow('Invalid vote parameters');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle vote change errors', async () => {
      const invalidId = 'invalid-id';

      await expect(proposalVotingService.changeVote(
        invalidId,
        'no',
        'Changed my mind'
      )).rejects.toThrow('Vote not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle vote revocation errors', async () => {
      const invalidId = 'invalid-id';

      await expect(proposalVotingService.revokeVote(invalidId))
        .rejects
        .toThrow('Vote not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });
}); 