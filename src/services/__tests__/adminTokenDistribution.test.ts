import { ethers } from 'ethers';
import { AdminTokenDistributionService } from '../adminTokenDistribution';
import { DAOTokenContract, DAOContract } from '../../types/contracts';

jest.mock('ethers');

describe('AdminTokenDistributionService', () => {
  let service: AdminTokenDistributionService;
  let mockTokenContract: jest.Mocked<DAOTokenContract>;
  let mockLogicContract: jest.Mocked<DAOContract>;
  let mockStateContract: jest.Mocked<DAOContract>;
  let mockViewContract: jest.Mocked<DAOContract>;
  const mockProvider = {} as ethers.Provider;
  const mockSigner = {} as ethers.Signer;
  const config = {
    allocationPercentage: 7.407407407,
    distributionInterval: 86400000,
    weights: {
      relayUptime: 0.6,
      usersServed: 0.4,
      governanceActivity: 1.0
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock contracts
    mockTokenContract = {
      address: '0x28692ce06b9EB38a8b4D07FED172ba5c3403745b',
      provider: mockProvider,
      signer: mockSigner,
      balanceOf: jest.fn(),
      transfer: jest.fn(),
      approve: jest.fn(),
      allowance: jest.fn(),
      transferFrom: jest.fn()
    };

    const baseContractMock = {
      address: '',
      provider: mockProvider,
      signer: mockSigner,
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
    };

    mockLogicContract = { ...baseContractMock, address: '0xdd7eC040D5C2A15FFF30a5F7B004d888747Fa903' };
    mockStateContract = { ...baseContractMock, address: '0xE24C734260189dd58618A95619EfF4164f98CC78' };
    mockViewContract = { ...baseContractMock, address: '0x2F2af46ae41ABEA5c3D8A50289d2b326D657a689' };

    // Initialize service with mocked contracts
    service = AdminTokenDistributionService.getInstance(
      '0x28692ce06b9EB38a8b4D07FED172ba5c3403745b',
      '0xdd7eC040D5C2A15FFF30a5F7B004d888747Fa903',
      '0xE24C734260189dd58618A95619EfF4164f98CC78',
      '0x2F2af46ae41ABEA5c3D8A50289d2b326D657a689',
      config,
      mockProvider,
      mockSigner
    );
  });

  describe('getRelayUptime', () => {
    it('should return cached value if available', async () => {
      mockViewContract.getBalance.mockResolvedValueOnce(BigInt(1000));
      const result = await service.getRelayUptime();
      expect(result).toBe(1);
      expect(mockViewContract.getBalance).toHaveBeenCalledTimes(1);
    });

    it('should handle contract errors gracefully', async () => {
      mockViewContract.getBalance.mockRejectedValueOnce(new Error('Contract error'));
      const result = await service.getRelayUptime();
      expect(result).toBe(0);
    });
  });

  describe('getUsersServed', () => {
    it('should calculate users based on proposal count', async () => {
      mockViewContract.getProposalCount.mockResolvedValueOnce(BigInt(5));
      const result = await service.getUsersServed();
      expect(result).toBe(50); // 5 proposals * 10 users per proposal
      expect(mockViewContract.getProposalCount).toHaveBeenCalledTimes(1);
    });

    it('should handle contract errors gracefully', async () => {
      mockViewContract.getProposalCount.mockRejectedValueOnce(new Error('Contract error'));
      const result = await service.getUsersServed();
      expect(result).toBe(0);
    });
  });

  describe('getGovernanceActivity', () => {
    it('should calculate activity score based on proposal count', async () => {
      mockViewContract.getProposalCount.mockResolvedValueOnce(BigInt(3));
      const result = await service.getGovernanceActivity();
      expect(result).toBe(300); // 3 proposals * 100 points per proposal
      expect(mockViewContract.getProposalCount).toHaveBeenCalledTimes(1);
    });

    it('should handle contract errors gracefully', async () => {
      mockViewContract.getProposalCount.mockRejectedValueOnce(new Error('Contract error'));
      const result = await service.getGovernanceActivity();
      expect(result).toBe(0);
    });
  });

  describe('calculateAdminRewards', () => {
    it('should calculate rewards based on performance metrics', async () => {
      mockViewContract.getBalance.mockResolvedValueOnce(BigInt(1000)); // High relay uptime
      mockViewContract.getProposalCount.mockResolvedValueOnce(BigInt(5)); // Moderate activity
      mockTokenContract.balanceOf.mockResolvedValueOnce(BigInt(1000000));

      const rewards = await service.calculateAdminRewards();
      expect(rewards).toBeGreaterThan(BigInt(0));
    });

    it('should handle contract errors gracefully', async () => {
      mockViewContract.getBalance.mockRejectedValueOnce(new Error('Contract error'));
      const rewards = await service.calculateAdminRewards();
      expect(rewards).toBe(BigInt(0));
    });
  });

  describe('distributeRewards', () => {
    it('should distribute rewards when conditions are met', async () => {
      const now = Date.now();
      mockStateContract.getBalance.mockResolvedValueOnce(BigInt(now - 90000000)); // 25 hours ago
      mockTokenContract.balanceOf.mockResolvedValueOnce(BigInt(1000000));
      mockTokenContract.transfer.mockResolvedValueOnce({ hash: '0x123', wait: jest.fn() } as any);

      const result = await service.distributeRewards();
      expect(result).toBe(true);
      expect(mockTokenContract.transfer).toHaveBeenCalled();
    });

    it('should not distribute rewards before interval', async () => {
      const now = Date.now();
      mockStateContract.getBalance.mockResolvedValueOnce(BigInt(now - 3600000)); // 1 hour ago

      const result = await service.distributeRewards();
      expect(result).toBe(false);
      expect(mockTokenContract.transfer).not.toHaveBeenCalled();
    });

    it('should handle contract errors gracefully', async () => {
      mockStateContract.getBalance.mockRejectedValueOnce(new Error('Contract error'));
      const result = await service.distributeRewards();
      expect(result).toBe(false);
    });
  });

  describe('getDistributionMetrics', () => {
    it('should return correct distribution metrics', async () => {
      const now = Date.now();
      mockStateContract.getBalance.mockResolvedValueOnce(BigInt(now));
      mockTokenContract.balanceOf.mockResolvedValueOnce(BigInt(100000));

      const result = await service.getDistributionMetrics();
      
      expect(result).toEqual({
        lastDistribution: now,
        totalDistributed: BigInt(100000),
        nextDistribution: now + config.distributionInterval
      });
    });

    it('should handle contract errors gracefully', async () => {
      mockStateContract.getBalance.mockRejectedValueOnce(new Error('Contract error'));
      const result = await service.getDistributionMetrics();
      
      expect(result).toEqual({
        lastDistribution: 0,
        totalDistributed: BigInt(0),
        nextDistribution: config.distributionInterval
      });
    });
  });
}); 