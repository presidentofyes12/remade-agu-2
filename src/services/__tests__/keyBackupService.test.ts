import { KeyBackupService } from '../keyBackupService';
import { PrivacyService } from '../privacyService';
import { KeyBackupContract, BackupRequest, BackupMetadata } from '../../types/keyBackup';
import { ContractTransactionResponse } from 'ethers';

jest.mock('../privacyService');

describe('KeyBackupService', () => {
  let keyBackupService: KeyBackupService;
  let mockContract: jest.Mocked<KeyBackupContract>;
  let mockPrivacyService: jest.Mocked<PrivacyService>;
  let mockConfig: {
    marketplaceAdminThreshold: bigint;
    daoAdminThreshold: bigint;
    votingPeriod: bigint;
    maxActiveRequests: number;
    backupExpirationPeriod: bigint;
  };

  beforeEach(() => {
    mockContract = {
      requestBackup: jest.fn(),
      voteOnBackup: jest.fn(),
      executeBackup: jest.fn(),
      getBackupRequest: jest.fn(),
      getBackupMetadata: jest.fn(),
      getActiveRequests: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<KeyBackupContract>;

    mockPrivacyService = {
      generateKeyPair: jest.fn(),
      createSecondaryKey: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<PrivacyService>;

    mockConfig = {
      marketplaceAdminThreshold: BigInt(60),
      daoAdminThreshold: BigInt(60),
      votingPeriod: BigInt(86400), // 24 hours
      maxActiveRequests: 5,
      backupExpirationPeriod: BigInt(604800) // 7 days
    };

    keyBackupService = KeyBackupService.getInstance(mockContract, mockPrivacyService, mockConfig);
  });

  afterEach(() => {
    keyBackupService.cleanup();
  });

  it('requests a backup successfully', async () => {
    const mockRequestId = 'request-1';
    mockContract.getActiveRequests.mockResolvedValue([]);
    mockContract.requestBackup.mockResolvedValue(mockRequestId);

    const result = await keyBackupService.requestBackup(
      '0x123',
      'full',
      'Test justification',
      BigInt(86400)
    );

    expect(result).toBe(mockRequestId);
    expect(mockContract.requestBackup).toHaveBeenCalledWith(
      '0x123',
      'full',
      'Test justification',
      BigInt(86400)
    );
  });

  it('throws error when maximum active requests reached', async () => {
    mockContract.getActiveRequests.mockResolvedValue(['1', '2', '3', '4', '5']);

    await expect(
      keyBackupService.requestBackup('0x123', 'full', 'Test justification', BigInt(86400))
    ).rejects.toThrow('Maximum number of active backup requests reached');
  });

  it('votes on a backup request', async () => {
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

    mockContract.voteOnBackup.mockResolvedValue(mockTx);

    await keyBackupService.voteOnBackup('request-1', true, 'marketplace');

    expect(mockContract.voteOnBackup).toHaveBeenCalledWith('request-1', true, 'marketplace');
    expect(mockTx.wait).toHaveBeenCalled();
  });

  it('executes an approved backup request', async () => {
    const mockRequest: BackupRequest = {
      requestId: 'request-1',
      requesterAddress: '0x123',
      keyHash: '0x456',
      backupType: 'full',
      justification: 'Test justification',
      status: 'approved',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      votes: {
        marketplaceAdmins: {
          for: BigInt(4),
          against: BigInt(1),
          totalVoters: BigInt(5)
        },
        daoAdmins: {
          for: BigInt(3),
          against: BigInt(1),
          totalVoters: BigInt(4)
        }
      }
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

    mockContract.getBackupRequest.mockResolvedValue(mockRequest);
    mockContract.executeBackup.mockResolvedValue(mockTx);

    await keyBackupService.executeBackup('request-1');

    expect(mockContract.executeBackup).toHaveBeenCalledWith('request-1');
    expect(mockTx.wait).toHaveBeenCalled();
  });

  it('throws error when executing unapproved backup request', async () => {
    const mockRequest: BackupRequest = {
      requestId: 'request-1',
      requesterAddress: '0x123',
      keyHash: '0x456',
      backupType: 'full',
      justification: 'Test justification',
      status: 'pending',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      votes: {
        marketplaceAdmins: {
          for: BigInt(0),
          against: BigInt(0),
          totalVoters: BigInt(0)
        },
        daoAdmins: {
          for: BigInt(0),
          against: BigInt(0),
          totalVoters: BigInt(0)
        }
      }
    };

    mockContract.getBackupRequest.mockResolvedValue(mockRequest);

    await expect(keyBackupService.executeBackup('request-1')).rejects.toThrow(
      'Backup request is not approved'
    );
  });

  it('throws error when executing expired backup request', async () => {
    const mockRequest: BackupRequest = {
      requestId: 'request-1',
      requesterAddress: '0x123',
      keyHash: '0x456',
      backupType: 'full',
      justification: 'Test justification',
      status: 'approved',
      createdAt: BigInt(Date.now() - 86400000),
      expiresAt: BigInt(Date.now() - 1),
      votes: {
        marketplaceAdmins: {
          for: BigInt(4),
          against: BigInt(1),
          totalVoters: BigInt(5)
        },
        daoAdmins: {
          for: BigInt(3),
          against: BigInt(1),
          totalVoters: BigInt(4)
        }
      }
    };

    mockContract.getBackupRequest.mockResolvedValue(mockRequest);

    await expect(keyBackupService.executeBackup('request-1')).rejects.toThrow(
      'Backup request has expired'
    );
  });

  it('gets backup request from cache when available', async () => {
    const mockRequest: BackupRequest = {
      requestId: 'request-1',
      requesterAddress: '0x123',
      keyHash: '0x456',
      backupType: 'full',
      justification: 'Test justification',
      status: 'pending',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      votes: {
        marketplaceAdmins: {
          for: BigInt(0),
          against: BigInt(0),
          totalVoters: BigInt(0)
        },
        daoAdmins: {
          for: BigInt(0),
          against: BigInt(0),
          totalVoters: BigInt(0)
        }
      }
    };

    // First call to populate cache
    mockContract.getBackupRequest.mockResolvedValue(mockRequest);
    await keyBackupService.getBackupRequest('request-1');

    // Second call should use cache
    mockContract.getBackupRequest.mockClear();
    const result = await keyBackupService.getBackupRequest('request-1');

    expect(result).toEqual(mockRequest);
    expect(mockContract.getBackupRequest).not.toHaveBeenCalled();
  });

  it('gets backup metadata from cache when available', async () => {
    const mockMetadata: BackupMetadata = {
      keyHash: '0x123',
      backupHash: '0x456',
      encryptedData: 'encrypted-data',
      createdAt: BigInt(Date.now()),
      expiresAt: BigInt(Date.now() + 86400000),
      backupType: 'full',
      backupVersion: 1
    };

    // First call to populate cache
    mockContract.getBackupMetadata.mockResolvedValue(mockMetadata);
    await keyBackupService.getBackupMetadata('0x456');

    // Second call should use cache
    mockContract.getBackupMetadata.mockClear();
    const result = await keyBackupService.getBackupMetadata('0x456');

    expect(result).toEqual(mockMetadata);
    expect(mockContract.getBackupMetadata).not.toHaveBeenCalled();
  });

  it('maintains singleton instance', () => {
    const instance1 = KeyBackupService.getInstance(mockContract, mockPrivacyService, mockConfig);
    const instance2 = KeyBackupService.getInstance(mockContract, mockPrivacyService, mockConfig);

    expect(instance1).toBe(instance2);
  });
}); 