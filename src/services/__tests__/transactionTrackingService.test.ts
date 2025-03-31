import { TransactionTrackingService } from '../transactionTrackingService';
import { NotificationService } from '../notificationService';
import { TransactionTrackingContract, TransactionInfo, TransactionType, TransactionStatus } from '../../types/transactionTracking';
import { ethers } from 'ethers';

jest.mock('../notificationService');

describe('TransactionTrackingService', () => {
  let transactionTrackingService: TransactionTrackingService;
  let mockContract: jest.Mocked<TransactionTrackingContract>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockConfig: {
    maxConfirmations: number;
    confirmationInterval: number;
    maxRetries: number;
    retryDelay: number;
    statusUpdateInterval: number;
  };

  beforeEach(() => {
    mockContract = {
      trackTransaction: jest.fn(),
      updateTransactionStatus: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionsByStatus: jest.fn(),
      getTransactionsByType: jest.fn(),
      getTransactionsByAddress: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<TransactionTrackingContract>;

    mockNotificationService = {
      createNotification: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<NotificationService>;

    mockProvider = {
      getTransactionReceipt: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<ethers.Provider>;

    mockConfig = {
      maxConfirmations: 12,
      confirmationInterval: 5,
      maxRetries: 3,
      retryDelay: 1,
      statusUpdateInterval: 10
    };

    transactionTrackingService = TransactionTrackingService.getInstance(
      mockContract,
      mockNotificationService,
      mockProvider,
      mockConfig
    );
  });

  afterEach(() => {
    transactionTrackingService.cleanup();
  });

  it('tracks a transaction successfully', async () => {
    const mockTransactionId = 'tx-1';
    mockContract.trackTransaction.mockResolvedValue(mockTransactionId);

    const result = await transactionTrackingService.trackTransaction(
      '0x123',
      'keyRotation',
      { keyId: 'key-1' }
    );

    expect(result).toBe(mockTransactionId);
    expect(mockContract.trackTransaction).toHaveBeenCalledWith(
      '0x123',
      'keyRotation',
      expect.any(String)
    );
  });

  it('updates transaction status to pending when receipt is not available', async () => {
    const mockTransaction: TransactionInfo = {
      id: 'tx-1',
      hash: '0x123',
      type: 'keyRotation',
      status: 'processing',
      from: '0x456',
      to: '0x789',
      value: BigInt(0),
      data: '0x',
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      nonce: 1,
      timestamp: BigInt(Date.now()),
      metadata: {}
    };

    mockContract.getTransaction.mockResolvedValue(mockTransaction);
    mockProvider.getTransactionReceipt.mockResolvedValue(null);
    mockContract.updateTransactionStatus.mockResolvedValue({
      wait: jest.fn().mockResolvedValue(undefined),
      hash: '0x123',
      from: '0x456',
      to: '0x789',
      data: '0x',
      blockNumber: 1,
      blockHash: '0xabc',
      timestamp: 1234567890,
      confirmations: 1,
      value: BigInt(0),
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      maxFeePerGas: BigInt(1000000000),
      maxPriorityFeePerGas: BigInt(1000000000),
      type: 2,
      accessList: [],
      chainId: 1,
      nonce: 1,
      signature: {
        r: '0x123',
        s: '0x456',
        v: 27
      }
    } as unknown as ethers.ContractTransactionResponse);

    await transactionTrackingService['updateTransactionStatus']('tx-1');

    expect(mockContract.updateTransactionStatus).toHaveBeenCalledWith(
      'tx-1',
      'pending'
    );
  });

  it('updates transaction status to failed when receipt status is 0', async () => {
    const mockTransaction: TransactionInfo = {
      id: 'tx-1',
      hash: '0x123',
      type: 'keyRotation',
      status: 'processing',
      from: '0x456',
      to: '0x789',
      value: BigInt(0),
      data: '0x',
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      nonce: 1,
      timestamp: BigInt(Date.now()),
      metadata: {}
    };

    mockContract.getTransaction.mockResolvedValue(mockTransaction);
    mockProvider.getTransactionReceipt.mockResolvedValue({
      status: 0,
      blockNumber: 1,
      confirmations: jest.fn().mockResolvedValue(1)
    } as unknown as ethers.TransactionReceipt);
    mockContract.updateTransactionStatus.mockResolvedValue({
      wait: jest.fn().mockResolvedValue(undefined),
      hash: '0x123',
      from: '0x456',
      to: '0x789',
      data: '0x',
      blockNumber: 1,
      blockHash: '0xabc',
      timestamp: 1234567890,
      confirmations: 1,
      value: BigInt(0),
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      maxFeePerGas: BigInt(1000000000),
      maxPriorityFeePerGas: BigInt(1000000000),
      type: 2,
      accessList: [],
      chainId: 1,
      nonce: 1,
      signature: {
        r: '0x123',
        s: '0x456',
        v: 27
      }
    } as unknown as ethers.ContractTransactionResponse);

    await transactionTrackingService['updateTransactionStatus']('tx-1');

    expect(mockContract.updateTransactionStatus).toHaveBeenCalledWith(
      'tx-1',
      'failed',
      undefined,
      undefined,
      'Transaction reverted'
    );
  });

  it('updates transaction status to confirmed when confirmations are sufficient', async () => {
    const mockTransaction: TransactionInfo = {
      id: 'tx-1',
      hash: '0x123',
      type: 'keyRotation',
      status: 'processing',
      from: '0x456',
      to: '0x789',
      value: BigInt(0),
      data: '0x',
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      nonce: 1,
      timestamp: BigInt(Date.now()),
      metadata: {}
    };

    mockContract.getTransaction.mockResolvedValue(mockTransaction);
    mockProvider.getTransactionReceipt.mockResolvedValue({
      status: 1,
      blockNumber: 1,
      confirmations: jest.fn().mockResolvedValue(12)
    } as unknown as ethers.TransactionReceipt);
    mockContract.updateTransactionStatus.mockResolvedValue({
      wait: jest.fn().mockResolvedValue(undefined),
      hash: '0x123',
      from: '0x456',
      to: '0x789',
      data: '0x',
      blockNumber: 1,
      blockHash: '0xabc',
      timestamp: 1234567890,
      confirmations: 1,
      value: BigInt(0),
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      maxFeePerGas: BigInt(1000000000),
      maxPriorityFeePerGas: BigInt(1000000000),
      type: 2,
      accessList: [],
      chainId: 1,
      nonce: 1,
      signature: {
        r: '0x123',
        s: '0x456',
        v: 27
      }
    } as unknown as ethers.ContractTransactionResponse);

    await transactionTrackingService['updateTransactionStatus']('tx-1');

    expect(mockContract.updateTransactionStatus).toHaveBeenCalledWith(
      'tx-1',
      'confirmed',
      1,
      12
    );
  });

  it('updates transaction status to processing when confirmations are insufficient', async () => {
    const mockTransaction: TransactionInfo = {
      id: 'tx-1',
      hash: '0x123',
      type: 'keyRotation',
      status: 'pending',
      from: '0x456',
      to: '0x789',
      value: BigInt(0),
      data: '0x',
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      nonce: 1,
      timestamp: BigInt(Date.now()),
      metadata: {}
    };

    mockContract.getTransaction.mockResolvedValue(mockTransaction);
    mockProvider.getTransactionReceipt.mockResolvedValue({
      status: 1,
      blockNumber: 1,
      confirmations: jest.fn().mockResolvedValue(6)
    } as unknown as ethers.TransactionReceipt);
    mockContract.updateTransactionStatus.mockResolvedValue({
      wait: jest.fn().mockResolvedValue(undefined),
      hash: '0x123',
      from: '0x456',
      to: '0x789',
      data: '0x',
      blockNumber: 1,
      blockHash: '0xabc',
      timestamp: 1234567890,
      confirmations: 1,
      value: BigInt(0),
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      maxFeePerGas: BigInt(1000000000),
      maxPriorityFeePerGas: BigInt(1000000000),
      type: 2,
      accessList: [],
      chainId: 1,
      nonce: 1,
      signature: {
        r: '0x123',
        s: '0x456',
        v: 27
      }
    } as unknown as ethers.ContractTransactionResponse);

    await transactionTrackingService['updateTransactionStatus']('tx-1');

    expect(mockContract.updateTransactionStatus).toHaveBeenCalledWith(
      'tx-1',
      'processing',
      1,
      6
    );
  });

  it('gets transaction from cache when available', async () => {
    const mockTransaction: TransactionInfo = {
      id: 'tx-1',
      hash: '0x123',
      type: 'keyRotation',
      status: 'confirmed',
      from: '0x456',
      to: '0x789',
      value: BigInt(0),
      data: '0x',
      gasLimit: BigInt(21000),
      gasPrice: BigInt(1000000000),
      nonce: 1,
      timestamp: BigInt(Date.now()),
      metadata: {}
    };

    // First call to populate cache
    mockContract.getTransaction.mockResolvedValue(mockTransaction);
    await transactionTrackingService.getTransaction('tx-1');

    // Second call should use cache
    mockContract.getTransaction.mockClear();
    const result = await transactionTrackingService.getTransaction('tx-1');

    expect(result).toEqual(mockTransaction);
    expect(mockContract.getTransaction).not.toHaveBeenCalled();
  });

  it('gets transactions by status', async () => {
    const mockTransactionIds = ['tx-1', 'tx-2'];
    mockContract.getTransactionsByStatus.mockResolvedValue(mockTransactionIds);

    const result = await transactionTrackingService.getTransactionsByStatus('confirmed');

    expect(result).toEqual(mockTransactionIds);
    expect(mockContract.getTransactionsByStatus).toHaveBeenCalledWith('confirmed');
  });

  it('gets transactions by type', async () => {
    const mockTransactionIds = ['tx-1', 'tx-2'];
    mockContract.getTransactionsByType.mockResolvedValue(mockTransactionIds);

    const result = await transactionTrackingService.getTransactionsByType('keyRotation');

    expect(result).toEqual(mockTransactionIds);
    expect(mockContract.getTransactionsByType).toHaveBeenCalledWith('keyRotation');
  });

  it('gets transactions by address', async () => {
    const mockTransactionIds = ['tx-1', 'tx-2'];
    mockContract.getTransactionsByAddress.mockResolvedValue(mockTransactionIds);

    const result = await transactionTrackingService.getTransactionsByAddress('0x123');

    expect(result).toEqual(mockTransactionIds);
    expect(mockContract.getTransactionsByAddress).toHaveBeenCalledWith('0x123');
  });

  it('maintains singleton instance', () => {
    const instance1 = TransactionTrackingService.getInstance(
      mockContract,
      mockNotificationService,
      mockProvider,
      mockConfig
    );
    const instance2 = TransactionTrackingService.getInstance(
      mockContract,
      mockNotificationService,
      mockProvider,
      mockConfig
    );

    expect(instance1).toBe(instance2);
  });
}); 