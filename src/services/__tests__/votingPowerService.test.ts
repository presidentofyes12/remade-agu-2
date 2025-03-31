import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { VotingPowerService } from '../votingPowerService';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { 
  DelegationType, 
  DelegationConfig, 
  Delegation,
  VotingPowerManager
} from '../../types/votingDelegation';

// Mock dependencies
jest.mock('../../utils/errorHandler');
jest.mock('../../utils/logger');

// Test utilities
class VotingPowerTestFactory {
  static createDefaultConfig(): DelegationConfig {
    return {
      maxDelegationsPerAddress: 5,
      minDelegationAmount: BigInt(1000),
      maxDelegationPercentage: 100,
      lockPeriod: 86400, // 24 hours
      cooldownPeriod: 3600 // 1 hour
    };
  }

  static createMockDelegation(
    delegator: string,
    delegate: string,
    type: DelegationType = 'full',
    amount: bigint = BigInt(1000),
    percentage: number = 100
  ): Delegation {
    return {
      id: `delegation-${Date.now()}`,
      delegator,
      delegate,
      type,
      amount,
      percentage,
      startTime: Date.now(),
      endTime: null,
      metadata: {
        reason: 'Test delegation',
        tags: []
      }
    };
  }
}

describe('VotingPowerService', () => {
  let votingPowerService: VotingPowerService;
  let mockConfig: DelegationConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize test data
    mockConfig = VotingPowerTestFactory.createDefaultConfig();
    
    // Initialize service
    votingPowerService = VotingPowerService.getInstance(mockConfig);
  });

  describe('Initialization', () => {
    it('should maintain singleton instance', () => {
      const instance1 = VotingPowerService.getInstance(mockConfig);
      const instance2 = VotingPowerService.getInstance(mockConfig);
      expect(instance1).toBe(instance2);
    });
  });

  describe('Delegation Management', () => {
    const delegator = '0x123';
    const delegate = '0x456';
    const amount = BigInt(1000);
    const percentage = 50;

    it('should create full delegation successfully', async () => {
      const delegationId = await votingPowerService.createDelegation(
        delegate,
        'full',
        amount,
        percentage
      );

      expect(delegationId).toBeDefined();
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should create partial delegation successfully', async () => {
      const delegationId = await votingPowerService.createDelegation(
        delegate,
        'partial',
        amount,
        percentage
      );

      expect(delegationId).toBeDefined();
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should create percentage delegation successfully', async () => {
      const delegationId = await votingPowerService.createDelegation(
        delegate,
        'percentage',
        amount,
        percentage
      );

      expect(delegationId).toBeDefined();
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should update delegation successfully', async () => {
      const delegation = VotingPowerTestFactory.createMockDelegation(
        delegator,
        delegate,
        'full',
        amount,
        percentage
      );

      const newAmount = BigInt(2000);
      const newPercentage = 75;

      await votingPowerService.updateDelegation(
        delegation.id,
        'partial',
        newAmount,
        newPercentage
      );

      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should revoke delegation successfully', async () => {
      const delegation = VotingPowerTestFactory.createMockDelegation(
        delegator,
        delegate
      );

      await votingPowerService.revokeDelegation(delegation.id);

      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should fail to create delegation exceeding max count', async () => {
      const maxDelegations = mockConfig.maxDelegationsPerAddress;
      const delegations = Array(maxDelegations).fill(null).map(() => 
        VotingPowerTestFactory.createMockDelegation(delegator, delegate)
      );

      jest.spyOn(votingPowerService as any, 'getDelegationsByDelegator')
        .mockResolvedValue(delegations);

      await expect(votingPowerService.createDelegation(
        delegate,
        'full',
        amount,
        percentage
      )).rejects.toThrow('Maximum delegations reached');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should fail to create delegation with insufficient amount', async () => {
      const insufficientAmount = BigInt(500); // Less than minDelegationAmount

      await expect(votingPowerService.createDelegation(
        delegate,
        'partial',
        insufficientAmount,
        percentage
      )).rejects.toThrow('Insufficient delegation amount');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should fail to create delegation exceeding max percentage', async () => {
      const excessivePercentage = 150; // More than maxDelegationPercentage

      await expect(votingPowerService.createDelegation(
        delegate,
        'percentage',
        amount,
        excessivePercentage
      )).rejects.toThrow('Excessive delegation percentage');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Delegation Queries', () => {
    const delegator = '0x123';
    const delegate = '0x456';
    const delegation = VotingPowerTestFactory.createMockDelegation(
      delegator,
      delegate
    );

    it('should get delegation by id', async () => {
      const result = await votingPowerService.getDelegation(delegation.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(delegation.id);
    });

    it('should get delegations by delegator', async () => {
      const result = await votingPowerService.getDelegationsByDelegator(delegator);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].delegator).toBe(delegator);
    });

    it('should get delegations by delegate', async () => {
      const result = await votingPowerService.getDelegationsByDelegate(delegate);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].delegate).toBe(delegate);
    });

    it('should get active delegations', async () => {
      const result = await votingPowerService.getActiveDelegations(delegator);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].endTime).toBeNull();
    });
  });

  describe('Voting Power Calculations', () => {
    const address = '0x123';
    const amount = BigInt(1000);

    it('should get effective voting power', async () => {
      const result = await votingPowerService.getEffectiveVotingPower(address);
      expect(result).toBeDefined();
      expect(typeof result).toBe('bigint');
    });

    it('should get delegated voting power', async () => {
      const result = await votingPowerService.getDelegatedVotingPower(address);
      expect(result).toBeDefined();
      expect(typeof result).toBe('bigint');
    });

    it('should get available voting power', async () => {
      const result = await votingPowerService.getAvailableVotingPower(address);
      expect(result).toBeDefined();
      expect(typeof result).toBe('bigint');
    });

    it('should get current user', async () => {
      const result = await votingPowerService.getCurrentUser();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Validation', () => {
    const delegator = '0x123';
    const delegate = '0x456';
    const amount = BigInt(1000);
    const percentage = 50;

    it('should validate delegation parameters', async () => {
      const result = await votingPowerService.validateDelegation(
        delegate,
        'full',
        amount,
        percentage
      );
      expect(result).toBe(true);
    });

    it('should reject delegation with insufficient amount', async () => {
      const insufficientAmount = BigInt(500); // Less than minDelegationAmount
      const result = await votingPowerService.validateDelegation(
        delegate,
        'partial',
        insufficientAmount,
        percentage
      );
      expect(result).toBe(false);
    });

    it('should reject delegation exceeding max percentage', async () => {
      const excessivePercentage = 150; // More than maxDelegationPercentage
      const result = await votingPowerService.validateDelegation(
        delegate,
        'percentage',
        amount,
        excessivePercentage
      );
      expect(result).toBe(false);
    });
  });

  describe('Event Handling', () => {
    it('should emit delegation created event', async () => {
      const listener = jest.fn();
      votingPowerService.on('DelegationCreated', listener);

      const delegate = '0x456';
      await votingPowerService.createDelegation(
        delegate,
        'full',
        BigInt(1000),
        100
      );

      expect(listener).toHaveBeenCalled();
    });

    it('should emit delegation updated event', async () => {
      const listener = jest.fn();
      votingPowerService.on('DelegationUpdated', listener);

      const delegation = VotingPowerTestFactory.createMockDelegation(
        '0x123',
        '0x456'
      );
      await votingPowerService.updateDelegation(
        delegation.id,
        'partial',
        BigInt(2000),
        75
      );

      expect(listener).toHaveBeenCalled();
    });

    it('should emit delegation revoked event', async () => {
      const listener = jest.fn();
      votingPowerService.on('DelegationRevoked', listener);

      const delegation = VotingPowerTestFactory.createMockDelegation(
        '0x123',
        '0x456'
      );
      await votingPowerService.revokeDelegation(delegation.id);

      expect(listener).toHaveBeenCalled();
    });

    it('should remove event listeners', async () => {
      const listener = jest.fn();
      votingPowerService.on('DelegationCreated', listener);

      const delegate = '0x456';
      await votingPowerService.createDelegation(
        delegate,
        'full',
        BigInt(1000),
        100
      );

      expect(listener).toHaveBeenCalled();

      votingPowerService.off('DelegationCreated', listener);
      await votingPowerService.createDelegation(
        delegate,
        'full',
        BigInt(1000),
        100
      );

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle delegation creation errors', async () => {
      const invalidAmount = BigInt(500); // Less than minDelegationAmount
      await expect(votingPowerService.createDelegation(
        '0x456',
        'partial',
        invalidAmount,
        50
      )).rejects.toThrow('Invalid delegation parameters');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle delegation update errors', async () => {
      const invalidId = 'invalid-id';
      await expect(votingPowerService.updateDelegation(
        invalidId,
        'partial',
        BigInt(2000),
        75
      )).rejects.toThrow('Delegation not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle delegation revocation errors', async () => {
      const invalidId = 'invalid-id';
      await expect(votingPowerService.revokeDelegation(invalidId))
        .rejects
        .toThrow('Delegation not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });
}); 