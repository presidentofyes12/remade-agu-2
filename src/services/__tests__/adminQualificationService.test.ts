import { AdminQualificationService, AdminQualification, AdminQualificationType, TripartiteResult } from '../../../../agu-app-03-24-25-18-08/dao-frontend/src/services/adminQualificationService';
import { ethers } from 'ethers';
import { JsonRpcProvider } from 'ethers';

// Mock ethers
jest.mock('ethers', () => ({
  Contract: jest.fn(),
  JsonRpcProvider: jest.fn(),
  Wallet: jest.fn().mockImplementation(() => ({
    getAddress: jest.fn(),
    signMessage: jest.fn(),
    signTransaction: jest.fn(),
    connect: jest.fn()
  }))
}));

describe('AdminQualificationService', () => {
  let adminService: AdminQualificationService;
  let mockProvider: jest.Mocked<JsonRpcProvider>;
  let mockSigner: jest.Mocked<ethers.Wallet>;
  let mockTripartiteProxy: jest.Mocked<ethers.Contract>;
  let mockDaoToken: jest.Mocked<ethers.Contract>;
  let mockTripartiteComputations: jest.Mocked<ethers.Contract>;

  const mockAddress = '0x1234567890abcdef';
  const mockRelayUrl = 'wss://test-relay.com';
  const mockProxyAddress = '0xabcdef1234567890';
  const mockDaoTokenAddress = '0x9876543210fedcba';
  const mockTripartiteAddress = '0xfedcba9876543210';

  const mockAdminQualification: AdminQualification = {
    address: mockAddress,
    qualificationType: 'elected',
    isActive: true,
    dateQualified: Date.now()
  };

  const mockTripartiteResult: TripartiteResult = {
    first: BigInt(100),
    second: BigInt(200),
    third: BigInt(300),
    result: BigInt(600)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mocks
    mockProvider = new JsonRpcProvider() as jest.Mocked<JsonRpcProvider>;
    mockSigner = new ethers.Wallet(mockAddress) as jest.Mocked<ethers.Wallet>;
    
    mockTripartiteProxy = {
      hasRole: jest.fn(),
      grantRole: jest.fn(),
      revokeRole: jest.fn(),
      getRoleMemberCount: jest.fn(),
      getRoleMember: jest.fn()
    } as unknown as jest.Mocked<ethers.Contract>;
    
    mockDaoToken = {
      balanceOf: jest.fn(),
      totalSupply: jest.fn()
    } as unknown as jest.Mocked<ethers.Contract>;
    
    mockTripartiteComputations = {
      computeTripartiteValue: jest.fn()
    } as unknown as jest.Mocked<ethers.Contract>;

    (ethers.Contract as jest.Mock).mockImplementation((address, abi, signer) => {
      if (address === mockProxyAddress) return mockTripartiteProxy;
      if (address === mockDaoTokenAddress) return mockDaoToken;
      if (address === mockTripartiteAddress) return mockTripartiteComputations;
      return {};
    });

    adminService = new AdminQualificationService(
      mockProvider,
      mockSigner,
      mockProxyAddress,
      mockDaoTokenAddress,
      mockTripartiteAddress
    );
  });

  describe('Admin Status Checks', () => {
    it('should check if address is admin', async () => {
      mockTripartiteProxy.hasRole.mockResolvedValue(true);
      
      const isAdmin = await adminService.isAdmin(mockAddress);
      
      expect(isAdmin).toBe(true);
      expect(mockTripartiteProxy.hasRole).toHaveBeenCalled();
    });

    it('should determine admin type as elected', async () => {
      mockTripartiteProxy.hasRole.mockResolvedValue(true);
      mockDaoToken.balanceOf.mockResolvedValue(BigInt(1000));
      
      const adminType = await adminService['determineAdminType'](mockAddress);
      
      expect(adminType).toBe('elected');
    });

    it('should determine admin type as relay', async () => {
      mockTripartiteProxy.hasRole.mockResolvedValue(true);
      mockDaoToken.balanceOf.mockResolvedValue(BigInt(0));
      
      const adminType = await adminService['determineAdminType'](mockAddress);
      
      expect(adminType).toBe('relay');
    });
  });

  describe('Relay Operations', () => {
    it('should check if address is relay operator', async () => {
      mockTripartiteProxy.hasRole.mockResolvedValue(true);
      
      const isRelay = await adminService.isRelayOperator(mockAddress);
      
      expect(isRelay).toBe(true);
      expect(mockTripartiteProxy.hasRole).toHaveBeenCalled();
    });

    it('should register relay admin successfully', async () => {
      mockTripartiteProxy.hasRole.mockResolvedValue(false);
      mockTripartiteProxy.grantRole.mockResolvedValue({ hash: 'mock-tx' });
      
      const success = await adminService.registerRelayAdmin(mockAddress, mockRelayUrl);
      
      expect(success).toBe(true);
      expect(mockTripartiteProxy.grantRole).toHaveBeenCalled();
    });

    it('should validate relay URL', () => {
      const isValid = adminService['isValidRelayUrl'](mockRelayUrl);
      expect(isValid).toBe(true);
    });

    it('should reject invalid relay URL', () => {
      const isValid = adminService['isValidRelayUrl']('invalid-url');
      expect(isValid).toBe(false);
    });
  });

  describe('Admin Management', () => {
    it('should get admins by type', async () => {
      mockTripartiteProxy.getRoleMemberCount.mockResolvedValue(BigInt(2));
      mockTripartiteProxy.getRoleMember.mockResolvedValue(mockAddress);
      
      const admins = await adminService.getAdminsByType('elected');
      
      expect(admins).toEqual([mockAddress]);
      expect(mockTripartiteProxy.getRoleMemberCount).toHaveBeenCalled();
      expect(mockTripartiteProxy.getRoleMember).toHaveBeenCalled();
    });

    it('should get qualification details', async () => {
      mockTripartiteProxy.hasRole.mockResolvedValue(true);
      mockDaoToken.balanceOf.mockResolvedValue(BigInt(1000));
      
      const details = await adminService.getQualificationDetails(mockAddress);
      
      expect(details).toBeDefined();
      expect(details?.address).toBe(mockAddress);
      expect(details?.qualificationType).toBe('elected');
      expect(details?.isActive).toBe(true);
    });

    it('should return null for non-admin address', async () => {
      mockTripartiteProxy.hasRole.mockResolvedValue(false);
      
      const details = await adminService.getQualificationDetails(mockAddress);
      
      expect(details).toBeNull();
    });
  });

  describe('Tripartite Computations', () => {
    it('should compute tripartite result', async () => {
      mockTripartiteComputations.computeTripartiteValue.mockResolvedValue(mockTripartiteResult);
      
      const result = await adminService.computeTripartiteValue(
        BigInt(100),
        BigInt(200),
        BigInt(300)
      );
      
      expect(result).toEqual(mockTripartiteResult);
      expect(mockTripartiteComputations.computeTripartiteValue).toHaveBeenCalled();
    });

    it('should handle computation errors', async () => {
      mockTripartiteComputations.computeTripartiteValue.mockRejectedValue(new Error('Computation failed'));
      
      await expect(adminService.computeTripartiteValue(
        BigInt(100),
        BigInt(200),
        BigInt(300)
      )).rejects.toThrow('Failed to compute tripartite result');
    });
  });
}); 