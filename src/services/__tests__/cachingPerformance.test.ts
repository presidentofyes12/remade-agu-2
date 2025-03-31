import { ethers } from 'ethers';
import { AdminTokenDistributionService } from '../adminTokenDistribution';

jest.mock('ethers');

describe('AdminTokenDistributionService Caching Performance', () => {
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
      getTotalDistributed: jest.fn()
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

  describe('Caching Performance', () => {
    it('should cache metrics for the configured duration', async () => {
      const mockMetrics = {
        relayUptime: 0.95,
        usersServed: 1000,
        governanceActivity: 0.8
      };

      // Mock contract calls
      mockContract.getRelayUptime.mockResolvedValue(mockMetrics.relayUptime);
      mockContract.getUsersServed.mockResolvedValue(mockMetrics.usersServed);
      mockContract.getGovernanceActivity.mockResolvedValue(mockMetrics.governanceActivity);

      // First call - should hit the contract
      const firstCallStart = Date.now();
      await adminTokenService.getMetrics();
      const firstCallDuration = Date.now() - firstCallStart;

      // Second call within cache duration - should use cache
      const secondCallStart = Date.now();
      await adminTokenService.getMetrics();
      const secondCallDuration = Date.now() - secondCallStart;

      // Verify cache is faster
      expect(secondCallDuration).toBeLessThan(firstCallDuration);
      expect(mockContract.getRelayUptime).toHaveBeenCalledTimes(1);
      expect(mockContract.getUsersServed).toHaveBeenCalledTimes(1);
      expect(mockContract.getGovernanceActivity).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after duration expires', async () => {
      const mockMetrics = {
        relayUptime: 0.95,
        usersServed: 1000,
        governanceActivity: 0.8
      };

      // Mock contract calls
      mockContract.getRelayUptime.mockResolvedValue(mockMetrics.relayUptime);
      mockContract.getUsersServed.mockResolvedValue(mockMetrics.usersServed);
      mockContract.getGovernanceActivity.mockResolvedValue(mockMetrics.governanceActivity);

      // First call
      await adminTokenService.getMetrics();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Second call after cache expires
      await adminTokenService.getMetrics();

      // Verify contract was called again
      expect(mockContract.getRelayUptime).toHaveBeenCalledTimes(2);
      expect(mockContract.getUsersServed).toHaveBeenCalledTimes(2);
      expect(mockContract.getGovernanceActivity).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent requests efficiently', async () => {
      const mockMetrics = {
        relayUptime: 0.95,
        usersServed: 1000,
        governanceActivity: 0.8
      };

      // Mock contract calls
      mockContract.getRelayUptime.mockResolvedValue(mockMetrics.relayUptime);
      mockContract.getUsersServed.mockResolvedValue(mockMetrics.usersServed);
      mockContract.getGovernanceActivity.mockResolvedValue(mockMetrics.governanceActivity);

      // Make concurrent requests
      const startTime = Date.now();
      await Promise.all([
        adminTokenService.getMetrics(),
        adminTokenService.getMetrics(),
        adminTokenService.getMetrics()
      ]);
      const totalDuration = Date.now() - startTime;

      // Verify only one set of contract calls was made
      expect(mockContract.getRelayUptime).toHaveBeenCalledTimes(1);
      expect(mockContract.getUsersServed).toHaveBeenCalledTimes(1);
      expect(mockContract.getGovernanceActivity).toHaveBeenCalledTimes(1);

      // Verify concurrent requests were handled efficiently
      expect(totalDuration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle cache invalidation on errors', async () => {
      const mockMetrics = {
        relayUptime: 0.95,
        usersServed: 1000,
        governanceActivity: 0.8
      };

      // Mock contract calls with error on first attempt
      mockContract.getRelayUptime
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockMetrics.relayUptime);
      mockContract.getUsersServed
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockMetrics.usersServed);
      mockContract.getGovernanceActivity
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockMetrics.governanceActivity);

      // First call should fail
      await expect(adminTokenService.getMetrics()).rejects.toThrow('Network error');

      // Second call should succeed and cache the result
      await adminTokenService.getMetrics();

      // Third call should use cache
      await adminTokenService.getMetrics();

      // Verify contract was called twice (once failed, once succeeded)
      expect(mockContract.getRelayUptime).toHaveBeenCalledTimes(2);
      expect(mockContract.getUsersServed).toHaveBeenCalledTimes(2);
      expect(mockContract.getGovernanceActivity).toHaveBeenCalledTimes(2);
    });
  });
}); 