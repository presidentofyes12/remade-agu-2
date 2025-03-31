import { ethers } from 'ethers';
import { AdminTokenDistributionService } from '../adminTokenDistribution';

jest.mock('ethers');

describe('AdminTokenDistributionService Reward Calculation', () => {
  let adminTokenService: AdminTokenDistributionService;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockSigner: jest.Mocked<ethers.Signer>;
  let mockContract: any;

  const mockAddresses = {
    token: '0x123',
    logic: '0x456',
    state: '0x789',
    view: '0xabc'
  };

  beforeEach(() => {
    // Reset singleton instance
    (AdminTokenDistributionService as any).instance = null;

    // Setup mocks
    mockProvider = {
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn()
    } as unknown as jest.Mocked<ethers.Provider>;

    mockSigner = {
      getAddress: jest.fn().mockResolvedValue('0x123'),
      signMessage: jest.fn(),
      signTransaction: jest.fn()
    } as unknown as jest.Mocked<ethers.Signer>;

    mockContract = {
      address: mockAddresses.logic,
      provider: mockProvider,
      signer: mockSigner,
      on: jest.fn(),
      off: jest.fn(),
      getRelayUptime: jest.fn(),
      getUsersServed: jest.fn(),
      getGovernanceActivity: jest.fn(),
      getTotalSupply: jest.fn(),
      getLastDistribution: jest.fn(),
      getTotalDistributed: jest.fn(),
      distributeRewards: jest.fn()
    };

    // Initialize service
    adminTokenService = AdminTokenDistributionService.getInstance(
      mockAddresses.token,
      mockAddresses.logic,
      mockAddresses.state,
      mockAddresses.view,
      {
        allocationPercentage: 7.407407407,
        distributionInterval: 86400000,
        weights: {
          relayUptime: 0.6,
          usersServed: 0.4,
          governanceActivity: 1.0
        }
      },
      mockProvider,
      mockSigner
    );
  });

  describe('Edge Cases', () => {
    it('should handle zero metrics correctly', async () => {
      // Mock zero metrics
      mockContract.getRelayUptime.mockResolvedValue(BigInt(0));
      mockContract.getUsersServed.mockResolvedValue(BigInt(0));
      mockContract.getGovernanceActivity.mockResolvedValue(BigInt(0));
      mockContract.getTotalSupply.mockResolvedValue(BigInt(1000000));

      const rewards = await adminTokenService.calculateAdminRewards();
      expect(rewards).toBe(BigInt(0));
    });

    it('should handle maximum metrics correctly', async () => {
      // Mock maximum metrics
      mockContract.getRelayUptime.mockResolvedValue(BigInt(100));
      mockContract.getUsersServed.mockResolvedValue(BigInt(1000000));
      mockContract.getGovernanceActivity.mockResolvedValue(BigInt(100));
      mockContract.getTotalSupply.mockResolvedValue(BigInt(1000000));

      const rewards = await adminTokenService.calculateAdminRewards();
      expect(rewards).toBeLessThanOrEqual(BigInt(1000000)); // Should not exceed total supply
    });

    it('should handle negative metrics gracefully', async () => {
      // Mock negative metrics
      mockContract.getRelayUptime.mockResolvedValue(BigInt(-1));
      mockContract.getUsersServed.mockResolvedValue(BigInt(-1));
      mockContract.getGovernanceActivity.mockResolvedValue(BigInt(-1));
      mockContract.getTotalSupply.mockResolvedValue(BigInt(1000000));

      const rewards = await adminTokenService.calculateAdminRewards();
      expect(rewards).toBe(BigInt(0));
    });

    it('should handle zero total supply correctly', async () => {
      // Mock metrics with zero total supply
      mockContract.getRelayUptime.mockResolvedValue(BigInt(100));
      mockContract.getUsersServed.mockResolvedValue(BigInt(1000));
      mockContract.getGovernanceActivity.mockResolvedValue(BigInt(100));
      mockContract.getTotalSupply.mockResolvedValue(BigInt(0));

      const rewards = await adminTokenService.calculateAdminRewards();
      expect(rewards).toBe(BigInt(0));
    });

    it('should handle very large numbers correctly', async () => {
      // Mock very large numbers
      mockContract.getRelayUptime.mockResolvedValue(BigInt(100));
      mockContract.getUsersServed.mockResolvedValue(BigInt(1000000));
      mockContract.getGovernanceActivity.mockResolvedValue(BigInt(100));
      mockContract.getTotalSupply.mockResolvedValue(BigInt(1000000000000));

      const rewards = await adminTokenService.calculateAdminRewards();
      expect(rewards).toBeLessThanOrEqual(BigInt(1000000000000));
    });
  });

  describe('Weight Calculations', () => {
    it('should handle zero weights correctly', async () => {
      // Create service with zero weights
      const zeroWeightService = AdminTokenDistributionService.getInstance(
        mockAddresses.token,
        mockAddresses.logic,
        mockAddresses.state,
        mockAddresses.view,
        {
          allocationPercentage: 7.407407407,
          distributionInterval: 86400000,
          weights: {
            relayUptime: 0,
            usersServed: 0,
            governanceActivity: 0
          }
        },
        mockProvider,
        mockSigner
      );

      // Mock metrics
      mockContract.getRelayUptime.mockResolvedValue(BigInt(100));
      mockContract.getUsersServed.mockResolvedValue(BigInt(1000));
      mockContract.getGovernanceActivity.mockResolvedValue(BigInt(100));
      mockContract.getTotalSupply.mockResolvedValue(BigInt(1000000));

      const rewards = await zeroWeightService.calculateAdminRewards();
      expect(rewards).toBe(BigInt(0));
    });

    it('should handle equal weights correctly', async () => {
      // Create service with equal weights
      const equalWeightService = AdminTokenDistributionService.getInstance(
        mockAddresses.token,
        mockAddresses.logic,
        mockAddresses.state,
        mockAddresses.view,
        {
          allocationPercentage: 7.407407407,
          distributionInterval: 86400000,
          weights: {
            relayUptime: 1,
            usersServed: 1,
            governanceActivity: 1
          }
        },
        mockProvider,
        mockSigner
      );

      // Mock metrics
      mockContract.getRelayUptime.mockResolvedValue(BigInt(100));
      mockContract.getUsersServed.mockResolvedValue(BigInt(100));
      mockContract.getGovernanceActivity.mockResolvedValue(BigInt(100));
      mockContract.getTotalSupply.mockResolvedValue(BigInt(1000000));

      const rewards = await equalWeightService.calculateAdminRewards();
      expect(rewards).toBeGreaterThan(BigInt(0));
    });
  });

  describe('Error Handling', () => {
    it('should handle contract errors gracefully', async () => {
      // Mock contract errors
      mockContract.getRelayUptime.mockRejectedValue(new Error('Contract error'));
      mockContract.getUsersServed.mockRejectedValue(new Error('Contract error'));
      mockContract.getGovernanceActivity.mockRejectedValue(new Error('Contract error'));
      mockContract.getTotalSupply.mockRejectedValue(new Error('Contract error'));

      const rewards = await adminTokenService.calculateAdminRewards();
      expect(rewards).toBe(BigInt(0));
    });

    it('should handle partial contract errors gracefully', async () => {
      // Mock partial contract errors
      mockContract.getRelayUptime.mockResolvedValue(BigInt(100));
      mockContract.getUsersServed.mockRejectedValue(new Error('Contract error'));
      mockContract.getGovernanceActivity.mockResolvedValue(BigInt(100));
      mockContract.getTotalSupply.mockResolvedValue(BigInt(1000000));

      const rewards = await adminTokenService.calculateAdminRewards();
      expect(rewards).toBe(BigInt(0));
    });
  });
}); 