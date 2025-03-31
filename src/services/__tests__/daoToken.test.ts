import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DAOTokenService } from '../daoToken';
import { errorHandler } from '../../utils/errorHandler';
import { retryMechanism } from '../../utils/retryMechanism';
import { ethers } from 'ethers';
import { JsonRpcProvider } from 'ethers';

// Mock dependencies
jest.mock('../../utils/errorHandler');
jest.mock('../../utils/retryMechanism');

// Mock ethers
jest.mock('ethers', () => ({
  Contract: jest.fn().mockImplementation(() => ({
    balanceOf: jest.fn(),
    transfer: jest.fn(),
    approve: jest.fn(),
    transferFrom: jest.fn(),
    allowance: jest.fn(),
    totalSupply: jest.fn(),
    name: jest.fn(),
    symbol: jest.fn(),
    decimals: jest.fn(),
    mint: jest.fn(),
    burn: jest.fn(),
    mintTo: jest.fn(),
    burnFrom: jest.fn(),
    pause: jest.fn(),
    unpause: jest.fn(),
    paused: jest.fn(),
    owner: jest.fn(),
    renounceOwnership: jest.fn(),
    transferOwnership: jest.fn(),
    getRoleMemberCount: jest.fn(),
    getRoleMember: jest.fn(),
    hasRole: jest.fn(),
    grantRole: jest.fn(),
    revokeRole: jest.fn(),
    stake: jest.fn(),
    unstake: jest.fn(),
    getStakedBalance: jest.fn()
  })),
  JsonRpcProvider: jest.fn(),
  Wallet: jest.fn().mockImplementation(() => ({
    getAddress: jest.fn(),
    signMessage: jest.fn(),
    signTransaction: jest.fn(),
    connect: jest.fn()
  }))
}));

// Test utilities
class DAOTokenTestFactory {
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
      provider: DAOTokenTestFactory.createMockProvider()
    } as unknown as ethers.Signer;
  }

  static createMockContract(): ethers.Contract {
    const mockContract = {
      address: '0x123',
      provider: DAOTokenTestFactory.createMockProvider(),
      signer: DAOTokenTestFactory.createMockSigner(),
      balanceOf: jest.fn(),
      transfer: jest.fn(),
      approve: jest.fn(),
      allowance: jest.fn(),
      transferFrom: jest.fn(),
      stake: jest.fn(),
      unstake: jest.fn(),
      getStakedBalance: jest.fn(),
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
    } as unknown as ethers.Contract;

    // Type the mock functions
    ((mockContract.balanceOf as unknown) as jest.Mock).mockResolvedValue(BigInt(0));
    ((mockContract.transfer as unknown) as jest.Mock).mockResolvedValue(true);
    ((mockContract.approve as unknown) as jest.Mock).mockResolvedValue(true);
    ((mockContract.allowance as unknown) as jest.Mock).mockResolvedValue(BigInt(0));
    ((mockContract.transferFrom as unknown) as jest.Mock).mockResolvedValue(true);
    ((mockContract.stake as unknown) as jest.Mock).mockResolvedValue(undefined);
    ((mockContract.unstake as unknown) as jest.Mock).mockResolvedValue(undefined);
    ((mockContract.getStakedBalance as unknown) as jest.Mock).mockResolvedValue(BigInt(0));

    return mockContract;
  }
}

describe('DAOTokenService', () => {
  let tokenService: DAOTokenService;
  let mockProvider: jest.Mocked<JsonRpcProvider>;
  let mockSigner: jest.Mocked<ethers.Wallet>;
  let mockContract: jest.Mocked<ethers.Contract>;

  const mockAddress = '0x1234567890abcdef';
  const mockTokenAddress = '0xabcdef1234567890';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mocks
    mockProvider = new JsonRpcProvider() as jest.Mocked<JsonRpcProvider>;
    mockSigner = new ethers.Wallet(mockAddress) as jest.Mocked<ethers.Wallet>;
    mockContract = new ethers.Contract(mockTokenAddress, [], mockSigner) as jest.Mocked<ethers.Contract>;

    tokenService = DAOTokenService.getInstance(
      mockTokenAddress,
      mockProvider, 
      mockSigner
    );
  });

  describe('Initialization', () => {
    it('should maintain singleton instance', () => {
      const instance1 = DAOTokenService.getInstance(
        mockTokenAddress,
        mockProvider,
        mockSigner
      );
      const instance2 = DAOTokenService.getInstance(
        mockTokenAddress,
        mockProvider,
        mockSigner
      );
      expect(instance1).toBe(instance2);
    });
  });

  describe('Balance Operations', () => {
    const address = '0x456';
    const balance = BigInt(1000);
    it('should get balance successfully', async () => {
      ((mockContract.balanceOf as unknown) as jest.Mock).mockResolvedValue(balance);

      const result = await tokenService.getBalance(address);

      expect(result).toBe(balance);
      expect(mockContract.balanceOf).toHaveBeenCalledWith(address);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });
    it('should handle balance retrieval errors', async () => {
      ((mockContract.balanceOf as unknown) as jest.Mock).mockRejectedValue(
        new Error('Balance retrieval failed')
      );

      await expect(tokenService.getBalance(address))
        .rejects
        .toThrow('Balance retrieval failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Transfer Operations', () => {
    const from = '0x456';
    const to = '0x789';
    const amount = BigInt(100);
    it('should transfer tokens successfully', async () => {
      ((mockContract.transfer as unknown) as jest.Mock).mockResolvedValue(true);

      const result = await tokenService.transfer(to, amount);

      expect(result).toBe(true);
      expect(mockContract.transfer).toHaveBeenCalledWith(to, amount);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });
    it('should transfer from address successfully', async () => {
      ((mockContract.transferFrom as unknown) as jest.Mock).mockResolvedValue(true);

      const result = await tokenService.transferFrom(from, to, amount);

      expect(result).toBe(true);
      expect(mockContract.transferFrom).toHaveBeenCalledWith(from, to, amount);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });
    it('should handle transfer errors', async () => {
      ((mockContract.transfer as unknown) as jest.Mock).mockRejectedValue(
        new Error('Transfer failed')
      );

      await expect(tokenService.transfer(to, amount))
        .rejects
        .toThrow('Transfer failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle transfer from errors', async () => {
      ((mockContract.transferFrom as unknown) as jest.Mock).mockRejectedValue(
        new Error('Transfer from failed')
      );

      await expect(tokenService.transferFrom(from, to, amount))
        .rejects
        .toThrow('Transfer from failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Approval Operations', () => {
    const owner = '0x456';
    const spender = '0x789';
    const amount = BigInt(100);

    it('should approve tokens successfully', async () => {
      ((mockContract.approve as unknown) as jest.Mock).mockResolvedValue(true);

      const result = await tokenService.approve(spender, amount);

      expect(result).toBe(true);
      expect(mockContract.approve).toHaveBeenCalledWith(spender, amount);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should get allowance successfully', async () => {
      ((mockContract.allowance as unknown) as jest.Mock).mockResolvedValue(amount);

      const result = await tokenService.getAllowance(owner, spender);

      expect(result).toBe(amount);
      expect(mockContract.allowance).toHaveBeenCalledWith(owner, spender);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should handle approval errors', async () => {
      ((mockContract.approve as unknown) as jest.Mock).mockRejectedValue(
        new Error('Approval failed')
      );

      await expect(tokenService.approve(spender, amount))
        .rejects
        .toThrow('Approval failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle allowance retrieval errors', async () => {
      ((mockContract.allowance as unknown) as jest.Mock).mockRejectedValue(
        new Error('Allowance retrieval failed')
      );

      await expect(tokenService.getAllowance(owner, spender))
        .rejects
        .toThrow('Allowance retrieval failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Staking Operations', () => {
    const address = '0x456';
    const amount = BigInt(100);

    it('should stake tokens successfully', async () => {
      ((mockContract.stake as unknown) as jest.Mock).mockResolvedValue(undefined);

      await tokenService.stake(amount);

      expect(mockContract.stake).toHaveBeenCalledWith(amount);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should unstake tokens successfully', async () => {
      ((mockContract.unstake as unknown) as jest.Mock).mockResolvedValue(undefined);

      await tokenService.unstake(amount);

      expect(mockContract.unstake).toHaveBeenCalledWith(amount);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should get staked balance successfully', async () => {
      ((mockContract.getStakedBalance as unknown) as jest.Mock).mockResolvedValue(amount);

      const result = await tokenService.getStakedBalance(address);

      expect(result).toBe(amount);
      expect(mockContract.getStakedBalance).toHaveBeenCalledWith(address);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should check stake successfully', async () => {
      const requiredAmount = BigInt(50);
      ((mockContract.getStakedBalance as unknown) as jest.Mock).mockResolvedValue(amount);

      const result = await tokenService.checkStake(requiredAmount);

      expect(result).toBe(true);
      expect(mockContract.getStakedBalance).toHaveBeenCalled();
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should handle staking errors', async () => {
      ((mockContract.stake as unknown) as jest.Mock).mockRejectedValue(
        new Error('Staking failed')
      );

      await expect(tokenService.stake(amount))
        .rejects
        .toThrow('Staking failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle unstaking errors', async () => {
      ((mockContract.unstake as unknown) as jest.Mock).mockRejectedValue(
        new Error('Unstaking failed')
      );

      await expect(tokenService.unstake(amount))
        .rejects
        .toThrow('Unstaking failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle staked balance retrieval errors', async () => {
      ((mockContract.getStakedBalance as unknown) as jest.Mock).mockRejectedValue(
        new Error('Staked balance retrieval failed')
      );

      await expect(tokenService.getStakedBalance(address))
        .rejects
        .toThrow('Staked balance retrieval failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle insufficient stake', async () => {
      const requiredAmount = BigInt(200);
      ((mockContract.getStakedBalance as unknown) as jest.Mock).mockResolvedValue(amount);

      const result = await tokenService.checkStake(requiredAmount);

      expect(result).toBe(false);
      expect(mockContract.getStakedBalance).toHaveBeenCalled();
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle contract initialization errors', async () => {
      (ethers.Contract as jest.Mock).mockImplementation(() => {
        throw new Error('Contract initialization failed');
      });

      expect(() => DAOTokenService.getInstance(
        mockTokenAddress,
        mockProvider,
        mockSigner
      )).toThrow('Contract initialization failed');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle provider errors', async () => {
      const providerError = new Error('Provider error');
      (mockProvider.getNetwork as jest.Mock).mockRejectedValue(providerError);

      await expect(tokenService.getBalance('0x456'))
        .rejects
        .toThrow('Provider error');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle signer errors', async () => {
      const signerError = new Error('Signer error');
      (mockSigner.getAddress as jest.Mock).mockRejectedValue(signerError);

      await expect(tokenService.transfer('0x789', BigInt(100)))
        .rejects
        .toThrow('Signer error');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });
}); 