import { MultiSigService } from '../multiSigService';
import { MultiSigContract, MultiSigRequest, OperationType } from '../../types/multiSignature';
import { ContractTransactionResponse } from 'ethers';

describe('MultiSigService', () => {
  let multiSigService: MultiSigService;
  let mockContract: jest.Mocked<MultiSigContract>;
  let mockConfig: {
    minRequiredSignatures: number;
    maxRequiredSignatures: number;
    votingPeriod: bigint;
    executionDelay: bigint;
    maxActiveRequests: number;
  };

  beforeEach(() => {
    mockContract = {
      createRequest: jest.fn(),
      addSignature: jest.fn(),
      executeRequest: jest.fn(),
      rejectRequest: jest.fn(),
      getRequest: jest.fn(),
      getActiveRequests: jest.fn(),
      getSignatures: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<MultiSigContract>;

    mockConfig = {
      minRequiredSignatures: 2,
      maxRequiredSignatures: 5,
      votingPeriod: BigInt(86400), // 24 hours
      executionDelay: BigInt(3600), // 1 hour
      maxActiveRequests: 5
    };

    multiSigService = MultiSigService.getInstance(mockContract, mockConfig);
  });

  afterEach(() => {
    multiSigService.cleanup();
  });

  it('creates a request successfully', async () => {
    const mockRequestId = 'request-1';
    mockContract.getActiveRequests.mockResolvedValue([]);
    mockContract.createRequest.mockResolvedValue(mockRequestId);

    const result = await multiSigService.createRequest(
      'keyRotation',
      '0x123',
      '0x',
      BigInt(0),
      3
    );

    expect(result).toBe(mockRequestId);
    expect(mockContract.createRequest).toHaveBeenCalledWith(
      'keyRotation',
      '0x123',
      '0x',
      BigInt(0),
      3
    );
  });

  it('throws error when required signatures is below minimum', async () => {
    await expect(
      multiSigService.createRequest('keyRotation', '0x123', '0x', BigInt(0), 1)
    ).rejects.toThrow('Required signatures must be at least 2');
  });

  it('throws error when required signatures is above maximum', async () => {
    await expect(
      multiSigService.createRequest('keyRotation', '0x123', '0x', BigInt(0), 6)
    ).rejects.toThrow('Required signatures cannot exceed 5');
  });

  it('throws error when maximum active requests reached', async () => {
    mockContract.getActiveRequests.mockResolvedValue(['1', '2', '3', '4', '5']);

    await expect(
      multiSigService.createRequest('keyRotation', '0x123', '0x', BigInt(0), 3)
    ).rejects.toThrow('Maximum number of active requests reached');
  });

  it('adds a signature successfully', async () => {
    const mockRequest: MultiSigRequest = {
      requestId: 'request-1',
      operationType: 'keyRotation',
      targetAddress: '0x123',
      data: '0x',
      value: BigInt(0),
      status: 'pending',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      signatures: {},
      requiredSignatures: 3,
      currentSignatures: 0
    };

    const mockTx = {
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
    } as unknown as ContractTransactionResponse;

    mockContract.getRequest.mockResolvedValue(mockRequest);
    mockContract.addSignature.mockResolvedValue(mockTx);

    await multiSigService.addSignature('request-1', '0xsignature');

    expect(mockContract.addSignature).toHaveBeenCalledWith('request-1', '0xsignature');
    expect(mockTx.wait).toHaveBeenCalled();
  });

  it('throws error when adding signature to non-pending request', async () => {
    const mockRequest: MultiSigRequest = {
      requestId: 'request-1',
      operationType: 'keyRotation',
      targetAddress: '0x123',
      data: '0x',
      value: BigInt(0),
      status: 'approved',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      signatures: {},
      requiredSignatures: 3,
      currentSignatures: 0
    };

    mockContract.getRequest.mockResolvedValue(mockRequest);

    await expect(
      multiSigService.addSignature('request-1', '0xsignature')
    ).rejects.toThrow('Request is not pending');
  });

  it('throws error when adding signature to expired request', async () => {
    const mockRequest: MultiSigRequest = {
      requestId: 'request-1',
      operationType: 'keyRotation',
      targetAddress: '0x123',
      data: '0x',
      value: BigInt(0),
      status: 'pending',
      createdAt: BigInt(Date.now() - 86400000),
      expiresAt: BigInt(Date.now() - 1),
      signatures: {},
      requiredSignatures: 3,
      currentSignatures: 0
    };

    mockContract.getRequest.mockResolvedValue(mockRequest);

    await expect(
      multiSigService.addSignature('request-1', '0xsignature')
    ).rejects.toThrow('Request has expired');
  });

  it('executes an approved request successfully', async () => {
    const mockRequest: MultiSigRequest = {
      requestId: 'request-1',
      operationType: 'keyRotation',
      targetAddress: '0x123',
      data: '0x',
      value: BigInt(0),
      status: 'approved',
      createdAt: BigInt(Date.now() - 7200000), // 2 hours ago
      expiresAt: BigInt(Date.now() + 86400000),
      signatures: {},
      requiredSignatures: 3,
      currentSignatures: 3
    };

    const mockTx = {
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
    } as unknown as ContractTransactionResponse;

    mockContract.getRequest.mockResolvedValue(mockRequest);
    mockContract.executeRequest.mockResolvedValue(mockTx);

    await multiSigService.executeRequest('request-1');

    expect(mockContract.executeRequest).toHaveBeenCalledWith('request-1');
    expect(mockTx.wait).toHaveBeenCalled();
  });

  it('throws error when executing non-approved request', async () => {
    const mockRequest: MultiSigRequest = {
      requestId: 'request-1',
      operationType: 'keyRotation',
      targetAddress: '0x123',
      data: '0x',
      value: BigInt(0),
      status: 'pending',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      signatures: {},
      requiredSignatures: 3,
      currentSignatures: 0
    };

    mockContract.getRequest.mockResolvedValue(mockRequest);

    await expect(
      multiSigService.executeRequest('request-1')
    ).rejects.toThrow('Request is not approved');
  });

  it('throws error when executing request before delay period', async () => {
    const mockRequest: MultiSigRequest = {
      requestId: 'request-1',
      operationType: 'keyRotation',
      targetAddress: '0x123',
      data: '0x',
      value: BigInt(0),
      status: 'approved',
      createdAt: BigInt(Date.now() - 1800000), // 30 minutes ago
      expiresAt: BigInt(Date.now() + 86400000),
      signatures: {},
      requiredSignatures: 3,
      currentSignatures: 3
    };

    mockContract.getRequest.mockResolvedValue(mockRequest);

    await expect(
      multiSigService.executeRequest('request-1')
    ).rejects.toThrow('Execution delay period has not passed');
  });

  it('rejects a request successfully', async () => {
    const mockRequest: MultiSigRequest = {
      requestId: 'request-1',
      operationType: 'keyRotation',
      targetAddress: '0x123',
      data: '0x',
      value: BigInt(0),
      status: 'pending',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      signatures: {},
      requiredSignatures: 3,
      currentSignatures: 0
    };

    const mockTx = {
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
    } as unknown as ContractTransactionResponse;

    mockContract.getRequest.mockResolvedValue(mockRequest);
    mockContract.rejectRequest.mockResolvedValue(mockTx);

    await multiSigService.rejectRequest('request-1');

    expect(mockContract.rejectRequest).toHaveBeenCalledWith('request-1');
    expect(mockTx.wait).toHaveBeenCalled();
  });

  it('throws error when rejecting non-pending request', async () => {
    const mockRequest: MultiSigRequest = {
      requestId: 'request-1',
      operationType: 'keyRotation',
      targetAddress: '0x123',
      data: '0x',
      value: BigInt(0),
      status: 'approved',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      signatures: {},
      requiredSignatures: 3,
      currentSignatures: 0
    };

    mockContract.getRequest.mockResolvedValue(mockRequest);

    await expect(
      multiSigService.rejectRequest('request-1')
    ).rejects.toThrow('Request is not pending');
  });

  it('gets request from cache when available', async () => {
    const mockRequest: MultiSigRequest = {
      requestId: 'request-1',
      operationType: 'keyRotation',
      targetAddress: '0x123',
      data: '0x',
      value: BigInt(0),
      status: 'pending',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      signatures: {},
      requiredSignatures: 3,
      currentSignatures: 0
    };

    // First call to populate cache
    mockContract.getRequest.mockResolvedValue(mockRequest);
    await multiSigService.getRequest('request-1');

    // Second call should use cache
    mockContract.getRequest.mockClear();
    const result = await multiSigService.getRequest('request-1');

    expect(result).toEqual(mockRequest);
    expect(mockContract.getRequest).not.toHaveBeenCalled();
  });

  it('gets signatures from cache when available', async () => {
    const mockSignatures = {
      '0x123': {
        signature: '0xabc',
        timestamp: BigInt(Date.now())
      }
    };

    // First call to populate cache
    mockContract.getSignatures.mockResolvedValue(mockSignatures);
    await multiSigService.getSignatures('request-1');

    // Second call should use cache
    mockContract.getSignatures.mockClear();
    const result = await multiSigService.getSignatures('request-1');

    expect(result).toEqual(mockSignatures);
    expect(mockContract.getSignatures).not.toHaveBeenCalled();
  });

  it('maintains singleton instance', () => {
    const instance1 = MultiSigService.getInstance(mockContract, mockConfig);
    const instance2 = MultiSigService.getInstance(mockContract, mockConfig);

    expect(instance1).toBe(instance2);
  });
}); 