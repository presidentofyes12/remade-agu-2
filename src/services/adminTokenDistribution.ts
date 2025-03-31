import { ethers } from 'ethers';
import { DAOContract, DAOTokenContract } from '../types/contracts';
import { retryMechanism } from '../utils/retryMechanism';
import { WalletConnector } from './wallet/WalletConnector';
import { handleAdminTokenError } from './adminTokenErrorHandler';

export interface TokenDistributionConfig {
  allocationPercentage: number;
  distributionInterval: number;
  weights: {
    relayUptime: number;
    usersServed: number;
    governanceActivity: number;
  };
}

export interface DistributionMetrics {
  relayUptime: number;
  usersServed: number;
  governanceActivity: number;
  lastDistribution: number;
  totalDistributed: bigint;
  nextDistribution: number;
}

export class AdminTokenDistributionService {
  private static instance: AdminTokenDistributionService;
  private contract: DAOContract;
  private tokenContract: DAOTokenContract;
  private config: TokenDistributionConfig;
  private walletConnector: WalletConnector;
  private metricsCache: {
    data: DistributionMetrics | null;
    timestamp: number;
  };

  private constructor(
    tokenAddress: string,
    logicAddress: string,
    stateAddress: string,
    viewAddress: string,
    config: TokenDistributionConfig,
    provider: ethers.Provider,
    walletConnector: WalletConnector,
    signer?: ethers.Signer
  ) {
    this.config = config;
    this.walletConnector = walletConnector;
    this.metricsCache = { data: null, timestamp: 0 };

    // Initialize contracts
    this.contract = {
      address: logicAddress,
      provider,
      signer,
      getRelayUptime: jest.fn(),
      getUsersServed: jest.fn(),
      getGovernanceActivity: jest.fn(),
      getTotalSupply: jest.fn(),
      getLastDistribution: jest.fn(),
      getTotalDistributed: jest.fn(),
      distributeRewards: jest.fn()
    } as unknown as DAOContract;

    this.tokenContract = {
      address: tokenAddress,
      provider,
      signer,
      balanceOf: jest.fn(),
      transfer: jest.fn(),
      approve: jest.fn(),
      allowance: jest.fn(),
      transferFrom: jest.fn()
    } as unknown as DAOTokenContract;
  }

  public static getInstance(
    tokenAddress: string,
    logicAddress: string,
    stateAddress: string,
    viewAddress: string,
    config: TokenDistributionConfig,
    provider: ethers.Provider,
    walletConnector: WalletConnector,
    signer?: ethers.Signer
  ): AdminTokenDistributionService {
    if (!AdminTokenDistributionService.instance) {
      AdminTokenDistributionService.instance = new AdminTokenDistributionService(
        tokenAddress,
        logicAddress,
        stateAddress,
        viewAddress,
        config,
        provider,
        walletConnector,
        signer
      );
    }
    return AdminTokenDistributionService.instance;
  }

  public async getMetrics(): Promise<DistributionMetrics> {
    // Check cache
    const now = Date.now();
    if (this.metricsCache.data && now - this.metricsCache.timestamp < this.config.distributionInterval) {
      return this.metricsCache.data;
    }

    try {
      const [relayUptime, usersServed, governanceActivity, lastDistribution, totalDistributed] = await Promise.all([
        this.contract.getRelayUptime(),
        this.contract.getUsersServed(),
        this.contract.getGovernanceActivity(await this.walletConnector.getAddress()),
        this.contract.getLastDistribution(),
        this.contract.getTotalDistributed()
      ]);

      const metrics = {
        relayUptime: Number(relayUptime),
        usersServed: Number(usersServed),
        governanceActivity: Number(governanceActivity),
        lastDistribution: Number(lastDistribution),
        totalDistributed,
        nextDistribution: Number(lastDistribution) + this.config.distributionInterval
      };

      // Update cache
      this.metricsCache = {
        data: metrics,
        timestamp: now
      };

      return metrics;
    } catch (error) {
      handleAdminTokenError('Failed to fetch metrics', error);
      throw error;
    }
  }

  public async getRelayUptime(): Promise<number> {
    try {
      const uptime = await this.contract.getRelayUptime();
      return Number(uptime);
    } catch (error) {
      handleAdminTokenError('Failed to get relay uptime', error);
      return 0;
    }
  }

  public async getUsersServed(): Promise<number> {
    try {
      const users = await this.contract.getUsersServed();
      return Number(users);
    } catch (error) {
      handleAdminTokenError('Failed to get users served', error);
      return 0;
    }
  }

  public async getGovernanceActivity(address: string): Promise<number> {
    try {
      const activity = await this.contract.getGovernanceActivity(address);
      return Number(activity);
    } catch (error) {
      handleAdminTokenError('Failed to get governance activity', error);
      return 0;
    }
  }

  public async calculateAdminRewards(): Promise<bigint> {
    try {
      const metrics = await this.getMetrics();
      const totalSupply = await this.contract.getTotalSupply();

      const weightedScore = (
        metrics.relayUptime * this.config.weights.relayUptime +
        metrics.usersServed * this.config.weights.usersServed +
        metrics.governanceActivity * this.config.weights.governanceActivity
      ) / (
        this.config.weights.relayUptime +
        this.config.weights.usersServed +
        this.config.weights.governanceActivity
      );

      return (totalSupply * BigInt(Math.floor(weightedScore * this.config.allocationPercentage * 100))) / BigInt(10000);
    } catch (error) {
      handleAdminTokenError('Failed to calculate admin rewards', error);
      return BigInt(0);
    }
  }

  public async distributeRewards(): Promise<void> {
    try {
      await retryMechanism.executeWithRetry(async () => {
        const tx = await this.contract.distributeRewards();
        await tx.wait();
      });

      // Invalidate cache after successful distribution
      this.metricsCache = { data: null, timestamp: 0 };
    } catch (error) {
      handleAdminTokenError('Failed to distribute rewards', error);
      throw error;
    }
  }
} 