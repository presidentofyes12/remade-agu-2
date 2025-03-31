import { ethers } from 'ethers';
import { ContractServiceFactory } from '../ContractServiceFactory';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { IWeb3Provider } from '../../types/Web3Provider';
import { IContractService } from '../../types/ContractService';
import { IMockContractService } from '../../types/MockContractService';

jest.mock('../../utils/errorHandler');
jest.mock('../../utils/logger');

describe('ContractServiceFactory', () => {
  let contractServiceFactory: ContractServiceFactory;
  let mockWeb3Provider: jest.Mocked<IWeb3Provider>;
  let mockContractService: jest.Mocked<IMockContractService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockWeb3Provider = {
      isConnected: jest.fn().mockReturnValue(true),
      connect: jest.fn().mockResolvedValue(undefined),
      getProvider: jest.fn().mockResolvedValue({
        getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
        getBlockNumber: jest.fn().mockResolvedValue(1),
        getBalance: jest.fn().mockResolvedValue(ethers.parseEther('1')),
        getTransactionReceipt: jest.fn().mockResolvedValue({ status: 1 })
      } as any),
      getSigner: jest.fn().mockResolvedValue({
        sendTransaction: jest.fn().mockResolvedValue({ hash: '0x123' })
      } as any)
    } as any;

    mockContractService = {
      getContract: jest.fn().mockResolvedValue({
        sendTransaction: jest.fn().mockResolvedValue({ hash: '0x123' }),
        estimateGas: {
          transfer: jest.fn().mockResolvedValue(ethers.parseUnits('100000', 'wei'))
        }
      } as any),
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0x123' }),
      callMethod: jest.fn().mockResolvedValue('0x456'),
      estimateGas: jest.fn().mockResolvedValue(ethers.parseUnits('100000', 'wei')),
      getBalance: jest.fn().mockResolvedValue(ethers.parseEther('1')),
      getTransactionReceipt: jest.fn().mockResolvedValue({ status: 1 }),
      getBlockNumber: jest.fn().mockResolvedValue(1),
      setMockResponse: jest.fn(),
      setMockError: jest.fn(),
      clearMocks: jest.fn(),
      getCallCount: jest.fn().mockReturnValue(0)
    } as any;

    contractServiceFactory = ContractServiceFactory.getInstance(mockWeb3Provider);
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await contractServiceFactory.initialize();
      expect(mockWeb3Provider.isConnected).toHaveBeenCalled();
      expect(mockWeb3Provider.getProvider).toHaveBeenCalled();
      expect(mockWeb3Provider.getSigner).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockWeb3Provider.isConnected.mockReturnValue(false);
      mockWeb3Provider.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(contractServiceFactory.initialize()).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('getContractService', () => {
    it('should get contract service successfully', async () => {
      await contractServiceFactory.initialize();
      const service = contractServiceFactory.getContractService();
      expect(service).toBeDefined();
      expect(service.getContract).toBeDefined();
      expect(service.sendTransaction).toBeDefined();
      expect(service.callMethod).toBeDefined();
      expect(service.estimateGas).toBeDefined();
      expect(service.getBalance).toBeDefined();
      expect(service.getTransactionReceipt).toBeDefined();
      expect(service.getBlockNumber).toBeDefined();
    });

    it('should throw error when service not initialized', () => {
      expect(() => contractServiceFactory.getContractService()).toThrow();
    });
  });

  describe('setTestMode', () => {
    it('should set test mode successfully', () => {
      contractServiceFactory.setTestMode(true, mockContractService);
      const service = contractServiceFactory.getContractService();
      expect(service).toBe(mockContractService);
    });

    it('should disable test mode successfully', () => {
      contractServiceFactory.setTestMode(true, mockContractService);
      contractServiceFactory.setTestMode(false);
      expect(() => contractServiceFactory.getContractService()).toThrow();
    });
  });
}); 