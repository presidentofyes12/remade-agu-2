import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrivacyService } from '../privacyService';
import { errorHandler } from '../../utils/errorHandler';
import { retryMechanism } from '../../utils/retryMechanism';
import { DAOTokenService } from '../daoToken';
import { 
  KeyPair, 
  SecondaryKeyMapping, 
  IdentityResolutionProposal,
  PrivacyConfig,
  PrivacyEvents
} from '../../types/privacy';
import { ethers } from 'ethers';

// Mock dependencies
jest.mock('../../utils/errorHandler');
jest.mock('../../utils/retryMechanism');
jest.mock('../daoToken');

// Test utilities
class PrivacyTestFactory {
  static createDefaultConfig(): PrivacyConfig {
    return {
      keyExpirationPeriod: BigInt(86400), // 24 hours
      proposalVotingPeriod: BigInt(604800), // 7 days
      minVotingPower: BigInt(1000),
      maxRequestedInformation: 5,
      allowedInformationTypes: ['email', 'phone', 'address']
    };
  }

  static createMockKeyPair(): KeyPair {
    return {
      publicKey: 'mock-public-key',
      privateKey: 'mock-private-key'
    };
  }

  static createMockSecondaryKeyMapping(
    primaryKeyHash: string,
    secondaryKeyHash: string
  ): SecondaryKeyMapping {
    return {
      primaryKeyHash,
      secondaryKeyHash,
      encryptedMapping: 'encrypted-data',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000) // 24 hours from now
    };
  }

  static createMockIdentityResolutionProposal(
    targetUserHash: string,
    requestedInformation: string[] = ['email']
  ): IdentityResolutionProposal {
    return {
      proposalId: `proposal-${Date.now()}`,
      targetUserHash,
      requestedInformation,
      justification: 'Test proposal',
      status: 'pending',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 604800000), // 7 days from now
      votes: {
        for: BigInt(0),
        against: BigInt(0)
      }
    };
  }

  static createMockProvider(): ethers.Provider {
    return {
      getNetwork: jest.fn(),
      getBlockNumber: jest.fn(),
      getBalance: jest.fn(),
      getCode: jest.fn(),
      getStorage: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getLogs: jest.fn(),
      send: jest.fn(),
      call: jest.fn(),
      estimateGas: jest.fn(),
      getFeeData: jest.fn(),
      broadcastTransaction: jest.fn(),
      waitForTransaction: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      once: jest.fn(),
      listenerCount: jest.fn(),
      listeners: jest.fn(),
      rawListeners: jest.fn(),
      emit: jest.fn(),
      setMaxListeners: jest.fn(),
      getMaxListeners: jest.fn(),
      eventNames: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn()
    } as unknown as ethers.Provider;
  }

  static createMockSigner(): ethers.Signer {
    return {
      getAddress: jest.fn(),
      signMessage: jest.fn(),
      signTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      connect: jest.fn(),
      provider: PrivacyTestFactory.createMockProvider()
    } as unknown as ethers.Signer;
  }
}

describe('PrivacyService', () => {
  let privacyService: PrivacyService;
  let mockConfig: PrivacyConfig;
  let mockProvider: ethers.Provider;
  let mockSigner: ethers.Signer;
  let mockDaoTokenService: jest.Mocked<DAOTokenService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize test data
    mockConfig = PrivacyTestFactory.createDefaultConfig();
    mockProvider = PrivacyTestFactory.createMockProvider();
    mockSigner = PrivacyTestFactory.createMockSigner();
    mockDaoTokenService = {
      getInstance: jest.fn(),
      getBalance: jest.fn(),
      transfer: jest.fn(),
      approve: jest.fn(),
      allowance: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<DAOTokenService>;
    
    // Initialize service
    privacyService = PrivacyService.getInstance(
      '0x123', // logic address
      '0x456', // state address
      '0x789', // view address
      mockConfig,
      mockProvider,
      mockSigner
    );
  });

  describe('Initialization', () => {
    it('should maintain singleton instance', () => {
      const instance1 = PrivacyService.getInstance(
        '0x123',
        '0x456',
        '0x789',
        mockConfig,
        mockProvider,
        mockSigner
      );
      const instance2 = PrivacyService.getInstance(
        '0x123',
        '0x456',
        '0x789',
        mockConfig,
        mockProvider,
        mockSigner
      );
      expect(instance1).toBe(instance2);
    });
  });

  describe('Key Management', () => {
    const primaryKeyHash = 'primary-key-hash';
    const targetUserHash = 'target-user-hash';
    const secondaryKeyHash = 'secondary-key-hash';

    it('should generate key pair successfully', async () => {
      const keyPair = await privacyService.generateKeyPair();
      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
    });

    it('should create secondary key successfully', async () => {
      const mapping = await privacyService.createSecondaryKey(
        primaryKeyHash,
        targetUserHash
      );

      expect(mapping).toBeDefined();
      expect(mapping.primaryKeyHash).toBe(primaryKeyHash);
      expect(mapping.secondaryKeyHash).toBeDefined();
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should get secondary key mapping successfully', async () => {
      const mapping = await privacyService.getSecondaryKeyMapping(
        primaryKeyHash,
        secondaryKeyHash
      );

      expect(mapping).toBeDefined();
      expect(mapping.primaryKeyHash).toBe(primaryKeyHash);
      expect(mapping.secondaryKeyHash).toBe(secondaryKeyHash);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should update key mapping successfully', async () => {
      const encryptedMapping = 'new-encrypted-data';
      await privacyService.updateKeyMapping(
        primaryKeyHash,
        secondaryKeyHash,
        encryptedMapping
      );

      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should fail to create secondary key with invalid parameters', async () => {
      await expect(privacyService.createSecondaryKey(
        '',
        targetUserHash
      )).rejects.toThrow('Invalid parameters');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should fail to get non-existent key mapping', async () => {
      await expect(privacyService.getSecondaryKeyMapping(
        primaryKeyHash,
        'non-existent-hash'
      )).rejects.toThrow('Key mapping not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Identity Resolution', () => {
    const targetUserHash = 'target-user-hash';
    const requestedInformation = ['email', 'phone'];
    const justification = 'Test justification';
    const duration = BigInt(604800); // 7 days

    it('should propose identity resolution successfully', async () => {
      const proposalId = await privacyService.proposeIdentityResolution(
        targetUserHash,
        requestedInformation,
        justification,
        duration
      );

      expect(proposalId).toBeDefined();
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should vote on identity resolution successfully', async () => {
      const proposal = PrivacyTestFactory.createMockIdentityResolutionProposal(
        targetUserHash,
        requestedInformation
      );

      await privacyService.voteOnIdentityResolution(proposal.proposalId, true);

      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should execute identity resolution successfully', async () => {
      const proposal = PrivacyTestFactory.createMockIdentityResolutionProposal(
        targetUserHash,
        requestedInformation
      );

      const revealedInformation = await privacyService.executeIdentityResolution(
        proposal.proposalId
      );

      expect(revealedInformation).toBeDefined();
      expect(revealedInformation.length).toBeGreaterThan(0);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should fail to propose resolution with invalid information types', async () => {
      const invalidInformation = ['invalid-type'];

      await expect(privacyService.proposeIdentityResolution(
        targetUserHash,
        invalidInformation,
        justification,
        duration
      )).rejects.toThrow('Invalid information types');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should fail to vote on non-existent proposal', async () => {
      await expect(privacyService.voteOnIdentityResolution(
        'non-existent-id',
        true
      )).rejects.toThrow('Proposal not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should fail to execute non-existent proposal', async () => {
      await expect(privacyService.executeIdentityResolution(
        'non-existent-id'
      )).rejects.toThrow('Proposal not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should emit secondary key created event', async () => {
      const listener = jest.fn();
      privacyService.on('SecondaryKeyCreated', listener);

      const primaryKeyHash = 'primary-key-hash';
      const targetUserHash = 'target-user-hash';
      await privacyService.createSecondaryKey(
        primaryKeyHash,
        targetUserHash
      );

      expect(listener).toHaveBeenCalled();
    });

    it('should emit identity resolution proposed event', async () => {
      const listener = jest.fn();
      privacyService.on('IdentityResolutionProposed', listener);

      const targetUserHash = 'target-user-hash';
      const requestedInformation = ['email'];
      await privacyService.proposeIdentityResolution(
        targetUserHash,
        requestedInformation,
        'Test justification',
        BigInt(604800)
      );

      expect(listener).toHaveBeenCalled();
    });

    it('should emit key mapping updated event', async () => {
      const listener = jest.fn();
      privacyService.on('KeyMappingUpdated', listener);

      const primaryKeyHash = 'primary-key-hash';
      const secondaryKeyHash = 'secondary-key-hash';
      await privacyService.updateKeyMapping(
        primaryKeyHash,
        secondaryKeyHash,
        'new-encrypted-data'
      );

      expect(listener).toHaveBeenCalled();
    });

    it('should remove event listeners', async () => {
      const listener = jest.fn();
      privacyService.on('SecondaryKeyCreated', listener);

      const primaryKeyHash = 'primary-key-hash';
      const targetUserHash = 'target-user-hash';
      await privacyService.createSecondaryKey(
        primaryKeyHash,
        targetUserHash
      );

      expect(listener).toHaveBeenCalled();

      privacyService.off('SecondaryKeyCreated', listener);
      await privacyService.createSecondaryKey(
        primaryKeyHash,
        targetUserHash
      );

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle key generation errors', async () => {
      jest.spyOn(privacyService as any, 'generateKeyPair')
        .mockRejectedValue(new Error('Key generation failed'));

      await expect(privacyService.generateKeyPair())
        .rejects
        .toThrow('Key generation failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle key mapping errors', async () => {
      const primaryKeyHash = 'primary-key-hash';
      const secondaryKeyHash = 'secondary-key-hash';

      jest.spyOn(privacyService as any, 'getSecondaryKeyMapping')
        .mockRejectedValue(new Error('Mapping retrieval failed'));

      await expect(privacyService.getSecondaryKeyMapping(
        primaryKeyHash,
        secondaryKeyHash
      )).rejects.toThrow('Mapping retrieval failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle identity resolution errors', async () => {
      const proposalId = 'proposal-id';

      jest.spyOn(privacyService as any, 'executeIdentityResolution')
        .mockRejectedValue(new Error('Resolution execution failed'));

      await expect(privacyService.executeIdentityResolution(proposalId))
        .rejects
        .toThrow('Resolution execution failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });
}); 