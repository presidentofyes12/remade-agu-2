import { BridgeService, ChainConfig, BridgeTransaction } from '../BridgeService';
import { WalletConnector } from '../../wallet/WalletConnector';
import { IKeyManager } from '../../../types/KeyManager';
import { ethers } from 'ethers';

// Mock dependencies
jest.mock('../../wallet/WalletConnector');
jest.mock('../../../types/KeyManager');
jest.mock('ethers');

describe('BridgeService', () => {
  let bridgeService: BridgeService;
  let mockWalletConnector: jest.Mocked<WalletConnector>;
  let mockKeyManager: jest.Mocked<IKeyManager>;
  let mockContract: jest.Mocked<ethers.Contract>;

  const mockChainId = 1;
  const mockTargetChainId = 2;
  const mockAmount = '1000000000000000000'; // 1 ETH
  const mockTransactionId = 'mock-tx-id';
  const mockSignature = 'mock-signature';
  const mockAdminKey = 'mock-admin-key';

  const mockChainConfig: ChainConfig = {
    chainId: mockChainId,
    name: 'Test Chain',
    rpcUrl: 'https://test-rpc.com',
    bridgeAddress: '0x1234567890abcdef',
    tokenAddress: '0xabcdef1234567890',
    bridgeContract: '0x9876543210fedcba',
    bridgeABI: []
  };

  const mockTransaction: BridgeTransaction = {
    id: mockTransactionId,
    sourceChain: mockChainId,
    targetChain: mockTargetChainId,
    amount: mockAmount,
    status: 'pending',
    timestamp: Date.now(),
    recipient: '0x1234567890abcdef'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mocks
    mockWalletConnector = new WalletConnector() as jest.Mocked<WalletConnector>;
    mockKeyManager = {
      getSecondaryKey: jest.fn().mockResolvedValue(mockAdminKey),
      signWithSecondaryKey: jest.fn().mockResolvedValue(mockSignature),
      getAddress: jest.fn().mockResolvedValue('0x1234567890abcdef')
    } as unknown as jest.Mocked<IKeyManager>;

    mockContract = {
      lock: jest.fn(),
      unlock: jest.fn(),
      balanceOf: jest.fn(),
      estimateFee: jest.fn(),
      verifyMessage: jest.fn()
    } as unknown as jest.Mocked<ethers.Contract>;

    (ethers.Contract as jest.Mock).mockImplementation(() => mockContract);

    bridgeService = new BridgeService(mockWalletConnector, mockKeyManager);
  });

  describe('Chain Management', () => {
    it('should initialize chain successfully', async () => {
      await bridgeService.initializeChain(mockChainConfig);
      
      expect(mockKeyManager.getSecondaryKey).toHaveBeenCalledWith('admin');
      expect(mockKeyManager.signWithSecondaryKey).toHaveBeenCalled();
      expect(bridgeService['chains'].has(mockChainId)).toBe(true);
    });

    it('should handle chain initialization errors', async () => {
      mockKeyManager.getSecondaryKey.mockResolvedValue(null);
      
      await expect(bridgeService.initializeChain(mockChainConfig))
        .rejects
        .toThrow('Admin role not initialized');
    });

    it('should get supported chains', async () => {
      await bridgeService.initializeChain(mockChainConfig);
      const chains = await bridgeService.getSupportedChains();
      
      expect(chains).toEqual([mockChainConfig]);
    });

    it('should remove chain', async () => {
      await bridgeService.initializeChain(mockChainConfig);
      await bridgeService.removeChain(mockChainId);
      
      expect(bridgeService['chains'].has(mockChainId)).toBe(false);
    });
  });

  describe('Bridge Operations', () => {
    beforeEach(async () => {
      await bridgeService.initializeChain(mockChainConfig);
      await bridgeService.initializeChain({
        ...mockChainConfig,
        chainId: mockTargetChainId
      });
    });

    it('should bridge assets successfully', async () => {
      mockContract.lock.mockResolvedValue({ hash: 'mock-source-tx' });
      
      const transaction = await bridgeService.bridgeAssets(
        mockChainId,
        mockTargetChainId,
        mockAmount
      );
      
      expect(transaction).toBeDefined();
      expect(transaction.status).toBe('pending');
      expect(mockContract.lock).toHaveBeenCalled();
    });

    it('should handle bridge errors', async () => {
      mockContract.lock.mockRejectedValue(new Error('Bridge failed'));
      
      await expect(bridgeService.bridgeAssets(
        mockChainId,
        mockTargetChainId,
        mockAmount
      )).rejects.toThrow('Failed to bridge assets');
    });

    it('should get transaction status', async () => {
      bridgeService['transactions'].set(mockTransactionId, mockTransaction);
      
      const status = await bridgeService.getTransactionStatus(mockTransactionId);
      
      expect(status).toEqual(mockTransaction);
    });

    it('should get chain transactions', async () => {
      bridgeService['transactions'].set(mockTransactionId, mockTransaction);
      
      const transactions = await bridgeService.getChainTransactions(mockChainId);
      
      expect(transactions).toEqual([mockTransaction]);
    });

    it('should update transaction status', async () => {
      bridgeService['transactions'].set(mockTransactionId, mockTransaction);
      
      await bridgeService.updateTransactionStatus(
        mockTransactionId,
        'completed',
        'mock-target-tx'
      );
      
      const updated = bridgeService['transactions'].get(mockTransactionId);
      expect(updated?.status).toBe('completed');
      expect(updated?.targetTxHash).toBe('mock-target-tx');
    });
  });

  describe('Balance and Fee Operations', () => {
    beforeEach(async () => {
      await bridgeService.initializeChain(mockChainConfig);
    });

    it('should get bridge balance', async () => {
      mockContract.balanceOf.mockResolvedValue(mockAmount);
      
      const balance = await bridgeService.getBridgeBalance(mockChainId);
      
      expect(balance).toBe(mockAmount);
      expect(mockContract.balanceOf).toHaveBeenCalled();
    });

    it('should estimate bridge fee', async () => {
      const mockFee = '100000000000000000'; // 0.1 ETH
      mockContract.estimateFee.mockResolvedValue(mockFee);
      
      const fee = await bridgeService.estimateBridgeFee(
        mockChainId,
        mockTargetChainId,
        mockAmount
      );
      
      expect(fee).toBe(mockFee);
      expect(mockContract.estimateFee).toHaveBeenCalled();
    });
  });

  describe('Message Verification', () => {
    beforeEach(async () => {
      await bridgeService.initializeChain(mockChainConfig);
      await bridgeService.initializeChain({
        ...mockChainConfig,
        chainId: mockTargetChainId
      });
    });

    it('should verify bridge message', async () => {
      const mockMessage = 'mock-message';
      mockContract.verifyMessage.mockResolvedValue(true);
      
      const isValid = await bridgeService.verifyBridgeMessage(
        mockChainId,
        mockTargetChainId,
        mockMessage,
        mockSignature
      );
      
      expect(isValid).toBe(true);
      expect(mockContract.verifyMessage).toHaveBeenCalled();
    });

    it('should handle invalid messages', async () => {
      const mockMessage = 'mock-message';
      mockContract.verifyMessage.mockResolvedValue(false);
      
      const isValid = await bridgeService.verifyBridgeMessage(
        mockChainId,
        mockTargetChainId,
        mockMessage,
        mockSignature
      );
      
      expect(isValid).toBe(false);
    });
  });
}); 