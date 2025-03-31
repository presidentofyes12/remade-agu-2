import { ethers } from 'ethers';
import { BridgeService } from '../bridge/BridgeService';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { IKeyManager } from '../../types/KeyManager';
import { WalletConnector } from '../wallet/WalletConnector';

jest.mock('../../utils/errorHandler');
jest.mock('../../utils/logger');
jest.mock('../wallet/WalletConnector');
jest.mock('../wallet/KeyManager');

describe('BridgeService', () => {
  let bridgeService: BridgeService;
  let mockWalletConnector: jest.Mocked<WalletConnector>;
  let mockKeyManager: jest.Mocked<IKeyManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWalletConnector = new WalletConnector() as jest.Mocked<WalletConnector>;
    mockKeyManager = {
      getPublicKey: jest.fn(),
      signWithSecondaryKey: jest.fn(),
      getSecondaryKey: jest.fn(),
      isAdmin: jest.fn()
    } as jest.Mocked<IKeyManager>;
    bridgeService = new BridgeService(mockWalletConnector, mockKeyManager);
  });

  describe('initializeChain', () => {
    it('should initialize chain successfully', async () => {
      const mockConfig = {
        chainId: 1,
        name: 'Test Chain',
        rpcUrl: 'http://test.com',
        bridgeAddress: '0x123',
        tokenAddress: '0x456',
        bridgeContract: '0x789',
        bridgeABI: []
      };

      mockKeyManager.getSecondaryKey.mockResolvedValue('0x123');
      mockKeyManager.signWithSecondaryKey.mockResolvedValue('0xabc');

      await bridgeService.initializeChain(mockConfig);

      expect(mockKeyManager.getSecondaryKey).toHaveBeenCalledWith('admin');
      expect(mockKeyManager.signWithSecondaryKey).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const mockConfig = {
        chainId: 1,
        name: 'Test Chain',
        rpcUrl: 'http://test.com',
        bridgeAddress: '0x123',
        tokenAddress: '0x456',
        bridgeContract: '0x789',
        bridgeABI: []
      };

      mockKeyManager.getSecondaryKey.mockRejectedValue(new Error('Admin key error'));

      await expect(bridgeService.initializeChain(mockConfig)).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('bridgeAssets', () => {
    it('should bridge assets successfully', async () => {
      const mockConfig = {
        chainId: 1,
        name: 'Test Chain',
        rpcUrl: 'http://test.com',
        bridgeAddress: '0x123',
        tokenAddress: '0x456',
        bridgeContract: '0x789',
        bridgeABI: []
      };

      mockWalletConnector.getAddress.mockResolvedValue('0x123');
      mockKeyManager.getSecondaryKey.mockResolvedValue('0x123');
      mockKeyManager.signWithSecondaryKey.mockResolvedValue('0xabc');

      await bridgeService.initializeChain(mockConfig);

      const result = await bridgeService.bridgeAssets(1, 2, '1.0');

      expect(result).toBeDefined();
      expect(result.sourceChain).toBe(1);
      expect(result.targetChain).toBe(2);
      expect(result.amount).toBe('1.0');
      expect(result.status).toBe('pending');
    });

    it('should handle bridge errors', async () => {
      const mockConfig = {
        chainId: 1,
        name: 'Test Chain',
        rpcUrl: 'http://test.com',
        bridgeAddress: '0x123',
        tokenAddress: '0x456',
        bridgeContract: '0x789',
        bridgeABI: []
      };

      await bridgeService.initializeChain(mockConfig);

      await expect(bridgeService.bridgeAssets(1, 2, '1.0')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('getTransactionStatus', () => {
    it('should get transaction status successfully', async () => {
      const mockConfig = {
        chainId: 1,
        name: 'Test Chain',
        rpcUrl: 'http://test.com',
        bridgeAddress: '0x123',
        tokenAddress: '0x456',
        bridgeContract: '0x789',
        bridgeABI: []
      };

      await bridgeService.initializeChain(mockConfig);

      const result = await bridgeService.getTransactionStatus('test-id');
      expect(result).toBeNull(); // Initially no transactions
    });
  });

  describe('getChainTransactions', () => {
    it('should get chain transactions successfully', async () => {
      const mockConfig = {
        chainId: 1,
        name: 'Test Chain',
        rpcUrl: 'http://test.com',
        bridgeAddress: '0x123',
        tokenAddress: '0x456',
        bridgeContract: '0x789',
        bridgeABI: []
      };

      await bridgeService.initializeChain(mockConfig);

      const result = await bridgeService.getChainTransactions(1);
      expect(result).toEqual([]); // Initially no transactions
    });
  });

  describe('getSupportedChains', () => {
    it('should get supported chains successfully', async () => {
      const mockConfig = {
        chainId: 1,
        name: 'Test Chain',
        rpcUrl: 'http://test.com',
        bridgeAddress: '0x123',
        tokenAddress: '0x456',
        bridgeContract: '0x789',
        bridgeABI: []
      };

      await bridgeService.initializeChain(mockConfig);

      const result = await bridgeService.getSupportedChains();
      expect(result).toEqual([mockConfig]);
    });
  });

  describe('getBridgeBalance', () => {
    it('should get bridge balance successfully', async () => {
      const mockConfig = {
        chainId: 1,
        name: 'Test Chain',
        rpcUrl: 'http://test.com',
        bridgeAddress: '0x123',
        tokenAddress: '0x456',
        bridgeContract: '0x789',
        bridgeABI: []
      };

      await bridgeService.initializeChain(mockConfig);

      const result = await bridgeService.getBridgeBalance(1);
      expect(result).toBeDefined();
    });

    it('should handle balance retrieval errors', async () => {
      const mockConfig = {
        chainId: 1,
        name: 'Test Chain',
        rpcUrl: 'http://test.com',
        bridgeAddress: '0x123',
        tokenAddress: '0x456',
        bridgeContract: '0x789',
        bridgeABI: []
      };

      await bridgeService.initializeChain(mockConfig);

      await expect(bridgeService.getBridgeBalance(999)).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });
}); 