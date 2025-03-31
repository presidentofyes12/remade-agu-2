import { ethers } from 'ethers';
import { retryMechanism } from '../utils/retryMechanism';
import { errorHandler } from '../utils/errorHandler';

export class DAOTokenService {
  private static instance: DAOTokenService;

  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  private constructor(
    contractAddress: string,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.contract = new ethers.Contract(
      contractAddress,
      [
        'function balanceOf(address account) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function transferFrom(address from, address to, uint256 amount) returns (bool)',
        'function stake(uint256 amount)',
        'function unstake(uint256 amount)',
        'function getStakedBalance(address account) view returns (uint256)',
      ],
      provider
    );
    this.provider = provider;
    this.signer = signer;
  }

  public static getInstance(
    contractAddress: string,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ): DAOTokenService {
    if (!DAOTokenService.instance) {
      DAOTokenService.instance = new DAOTokenService(contractAddress, provider, signer);
    }
    return DAOTokenService.instance;
  }

  public async getBalance(address: string): Promise<bigint> {
    try {
      const result = await retryMechanism.executeWithRetry<bigint>(
        async () => {
          return await this.contract.balanceOf(address);
        },
        {}
      );

      if (result.result === undefined) {
        throw new Error('Failed to get balance');
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'getBalance',
        timestamp: Date.now(),
        additionalInfo: { address }
      });
      throw error;
    }
  }

  public async transfer(to: string, amount: bigint): Promise<boolean> {
    try {
      const result = await retryMechanism.executeWithRetry<boolean>(
        async () => {
          const tx = await this.contract.transfer(to, amount);
          await tx.wait();
          return true;
        },
        {}
      );

      if (result.result === undefined) {
        throw new Error('Failed to transfer tokens');
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'transfer',
        timestamp: Date.now(),
        additionalInfo: { to, amount: amount.toString() }
      });
      throw error;
    }
  }

  public async approve(spender: string, amount: bigint): Promise<boolean> {
    try {
      const result = await retryMechanism.executeWithRetry<boolean>(
        async () => {
          const tx = await this.contract.approve(spender, amount);
          await tx.wait();
          return true;
        },
        {}
      );

      if (result.result === undefined) {
        throw new Error('Failed to approve tokens');
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'approve',
        timestamp: Date.now(),
        additionalInfo: { spender, amount: amount.toString() }
      });
      throw error;
    }
  }

  public async getAllowance(owner: string, spender: string): Promise<bigint> {
    try {
      const result = await retryMechanism.executeWithRetry<bigint>(
        async () => {
          return await this.contract.allowance(owner, spender);
        },
        {}
      );

      if (result.result === undefined) {
        throw new Error('Failed to get allowance');
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'getAllowance',
        timestamp: Date.now(),
        additionalInfo: { owner, spender }
      });
      throw error;
    }
  }

  public async transferFrom(
    from: string,
    to: string,
    amount: bigint
  ): Promise<boolean> {
    try {
      const result = await retryMechanism.executeWithRetry<boolean>(
        async () => {
          const tx = await this.contract.transferFrom(from, to, amount);
          await tx.wait();
          return true;
        },
        {}
      );

      if (result.result === undefined) {
        throw new Error('Failed to transfer tokens from');
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'transferFrom',
        timestamp: Date.now(),
        additionalInfo: { from, to, amount: amount.toString() }
      });
      throw error;
    }
  }

  public async stake(amount: bigint): Promise<void> {
    try {
      await retryMechanism.executeWithRetry(
        async () => {
          const tx = await this.contract.stake(amount);
          await tx.wait();
        },
        {}
      );
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'stake',
        timestamp: Date.now(),
        additionalInfo: { amount: amount.toString() }
      });
      throw error;
    }
  }

  public async unstake(amount: bigint): Promise<void> {
    try {
      await retryMechanism.executeWithRetry(
        async () => {
          const tx = await this.contract.unstake(amount);
          await tx.wait();
        },
        {}
      );
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'unstake',
        timestamp: Date.now(),
        additionalInfo: { amount: amount.toString() }
      });
      throw error;
    }
  }

  public async getStakedBalance(address: string): Promise<bigint> {
    try {
      const result = await retryMechanism.executeWithRetry<bigint>(
        async () => {
          return await this.contract.getStakedBalance(address);
        },
        {}
      );

      if (result.result === undefined) {
        throw new Error('Failed to get staked balance');
      }

      return result.result;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'getStakedBalance',
        timestamp: Date.now(),
        additionalInfo: { address }
      });
      throw error;
    }
  }

  public async checkStake(requiredAmount: bigint): Promise<boolean> {
    try {
      if (!this.signer) {
        throw new Error('Signer not available');
      }

      const address = await this.signer.getAddress();
      const stakedBalance = await this.getStakedBalance(address);
      return stakedBalance >= requiredAmount;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'checkStake',
        timestamp: Date.now(),
        additionalInfo: { requiredAmount: requiredAmount.toString() }
      });
      throw error;
    }
  }
} 