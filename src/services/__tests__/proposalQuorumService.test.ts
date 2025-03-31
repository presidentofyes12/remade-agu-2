import { ProposalQuorumService } from '../proposalQuorumService';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { VotingPowerService } from '../votingPowerService';
import { LoadingStateService } from '../loadingStateService';
import { QuorumStatus, QuorumConfig } from '../../types/proposalQuorum';

jest.mock('../../utils/errorHandler');
jest.mock('../../utils/logger');
jest.mock('../votingPowerService');
jest.mock('../loadingStateService');

describe('ProposalQuorumService', () => {
  let quorumService: ProposalQuorumService;
  let mockVotingPowerService: jest.Mocked<VotingPowerService>;
  let mockLoadingStateService: jest.Mocked<LoadingStateService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVotingPowerService = {
      getVotingPower: jest.fn(),
      updateVotingPower: jest.fn()
    } as any;
    mockLoadingStateService = {
      setLoading: jest.fn(),
      clearLoading: jest.fn()
    } as any;
    quorumService = ProposalQuorumService.getInstance(mockVotingPowerService, mockLoadingStateService);
  });

  describe('initializeQuorum', () => {
    it('should initialize quorum successfully', async () => {
      const proposalId = '1';
      await quorumService.initializeQuorum(proposalId);

      const status = await quorumService.checkQuorumStatus(proposalId);
      expect(status).toBeDefined();
      expect(status.currentQuorum).toBeDefined();
      expect(status.requiredQuorum).toBeDefined();
      expect(status.totalVotingPower).toBeDefined();
      expect(status.currentVotingPower).toBeDefined();
      expect(status.quorumPercentage).toBeDefined();
      expect(status.isQuorumReached).toBeDefined();
      expect(status.timeRemaining).toBeDefined();
    });

    it('should handle initialization errors', async () => {
      await expect(quorumService.initializeQuorum('')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('updateQuorum', () => {
    it('should update quorum successfully', async () => {
      const proposalId = '1';
      await quorumService.initializeQuorum(proposalId);
      await quorumService.updateQuorum(proposalId);

      const status = await quorumService.checkQuorumStatus(proposalId);
      expect(status).toBeDefined();
      expect(status.currentQuorum).toBeDefined();
      expect(status.requiredQuorum).toBeDefined();
    });

    it('should handle update errors', async () => {
      await expect(quorumService.updateQuorum('')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('checkQuorumStatus', () => {
    it('should get quorum status successfully', async () => {
      const proposalId = '1';
      await quorumService.initializeQuorum(proposalId);
      const status = await quorumService.checkQuorumStatus(proposalId);

      expect(status).toBeDefined();
      expect(status.currentQuorum).toBeDefined();
      expect(status.requiredQuorum).toBeDefined();
      expect(status.totalVotingPower).toBeDefined();
      expect(status.currentVotingPower).toBeDefined();
      expect(status.quorumPercentage).toBeDefined();
      expect(status.isQuorumReached).toBeDefined();
      expect(status.timeRemaining).toBeDefined();
    });

    it('should handle non-existent quorum', async () => {
      await expect(quorumService.checkQuorumStatus('1')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('calculateRequiredQuorum', () => {
    it('should calculate required quorum correctly', async () => {
      const proposalId = '1';
      await quorumService.initializeQuorum(proposalId);
      const requiredQuorum = await quorumService.calculateRequiredQuorum(proposalId);

      expect(requiredQuorum).toBeDefined();
      expect(typeof requiredQuorum).toBe('bigint');
    });

    it('should handle calculation errors', async () => {
      await expect(quorumService.calculateRequiredQuorum('')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('calculateCurrentQuorum', () => {
    it('should calculate current quorum correctly', async () => {
      const proposalId = '1';
      await quorumService.initializeQuorum(proposalId);
      const currentQuorum = await quorumService.calculateCurrentQuorum(proposalId);

      expect(currentQuorum).toBeDefined();
      expect(typeof currentQuorum).toBe('bigint');
    });

    it('should handle calculation errors', async () => {
      await expect(quorumService.calculateCurrentQuorum('')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('calculateQuorumPercentage', () => {
    it('should calculate quorum percentage correctly', async () => {
      const proposalId = '1';
      await quorumService.initializeQuorum(proposalId);
      const percentage = await quorumService.calculateQuorumPercentage(proposalId);

      expect(percentage).toBeDefined();
      expect(typeof percentage).toBe('number');
    });

    it('should handle calculation errors', async () => {
      await expect(quorumService.calculateQuorumPercentage('')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('validateQuorumConfig', () => {
    it('should validate quorum config correctly', () => {
      const config: QuorumConfig = {
        minQuorumPercentage: 10,
        maxQuorumPercentage: 50,
        quorumGrowthRate: 1,
        quorumGrowthPeriod: 86400,
        minVotingPeriod: 3600,
        maxVotingPeriod: 604800
      };

      const isValid = quorumService.validateQuorumConfig(config);
      expect(isValid).toBe(true);
    });

    it('should reject invalid config', () => {
      const config: QuorumConfig = {
        minQuorumPercentage: 60,
        maxQuorumPercentage: 50,
        quorumGrowthRate: 1,
        quorumGrowthPeriod: 86400,
        minVotingPeriod: 3600,
        maxVotingPeriod: 604800
      };

      const isValid = quorumService.validateQuorumConfig(config);
      expect(isValid).toBe(false);
    });
  });

  describe('validateProposalQuorum', () => {
    it('should validate proposal quorum correctly', async () => {
      const proposalId = '1';
      await quorumService.initializeQuorum(proposalId);
      const isValid = await quorumService.validateProposalQuorum(proposalId);

      expect(isValid).toBeDefined();
      expect(typeof isValid).toBe('boolean');
    });

    it('should handle validation errors', async () => {
      await expect(quorumService.validateProposalQuorum('')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('event listeners', () => {
    it('should handle event listeners correctly', () => {
      const listener = jest.fn();
      quorumService.on('QuorumUpdated', listener);
      quorumService.off('QuorumUpdated', listener);
      expect(listener).not.toHaveBeenCalled();
    });
  });
}); 