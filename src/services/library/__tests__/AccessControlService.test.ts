import { AccessControlService, PrivilegedChannel, AgeVerification } from '../AccessControlService';
import { MetadataService, AccessControlRule, PublicationRelationship, Citation } from '../MetadataService';
import { ethers } from 'ethers';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ContentMetadata } from '../ContentFingerprintService';

// Mock ethers
jest.mock('ethers', () => ({
  hexlify: jest.fn(),
  randomBytes: jest.fn(),
  toUtf8Bytes: jest.fn(),
  keccak256: jest.fn()
}));

// Mock MetadataService
jest.mock('../MetadataService', () => ({
  MetadataService: jest.fn().mockImplementation(() => ({
    addAccessRule: jest.fn(),
    getAccessRules: jest.fn()
  }))
}));

describe('AccessControlService', () => {
  let accessControlService: AccessControlService;
  let mockMetadataService: jest.Mocked<MetadataService>;
  let mockUserId: string;
  let mockPublicationId: string;
  let mockAccessRule: AccessControlRule;

  const mockChannelId = '0x1234567890abcdef';
  const mockEncryptionKey = 'mock-encryption-key';
  const mockMembers = ['user1', 'user2'];

  const mockChannel: PrivilegedChannel = {
    id: mockChannelId,
    name: 'Test Channel',
    members: mockMembers,
    encryptionKey: mockEncryptionKey,
    createdAt: Date.now()
  };

  const mockAgeVerification: AgeVerification = {
    age: 18,
    verifiedAt: Date.now(),
    issuer: 'test-issuer'
  };

  const mockContentMetadata: ContentMetadata = {
    contentHash: 'test-hash',
    timestamp: Date.now(),
    title: 'Test Content',
    author: 'Test Author',
    mediaType: 'article',
    merkleRoot: 'test-merkle-root',
    ageRating: 0,
    privilegeLevel: 'public'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMetadataService = {
      addContentMetadata: jest.fn().mockImplementation(() => Promise.resolve()),
      addRelationship: jest.fn().mockImplementation(() => Promise.resolve()),
      getRelationships: jest.fn().mockReturnValue([] as PublicationRelationship[]),
      addAccessRule: jest.fn().mockImplementation(() => Promise.resolve()),
      getAccessRules: jest.fn().mockReturnValue([] as AccessControlRule[]),
      getContentMetadata: jest.fn().mockImplementation(() => Promise.resolve(mockContentMetadata)),
      checkAgeAccess: jest.fn().mockImplementation(() => Promise.resolve(true)),
      checkPrivilegeAccess: jest.fn().mockImplementation(() => Promise.resolve(true)),
      getCitationNetwork: jest.fn().mockImplementation(() => Promise.resolve([] as Citation[])),
      getAuthorNetwork: jest.fn().mockReturnValue([] as string[]),
      getDomainRelationships: jest.fn().mockReturnValue([] as string[]),
      addCitation: jest.fn().mockImplementation(() => Promise.resolve()),
      verifyCitation: jest.fn().mockImplementation(() => Promise.resolve()),
      getVerifiedCitations: jest.fn().mockImplementation(() => Promise.resolve([] as Citation[])),
      getUnverifiedCitations: jest.fn().mockImplementation(() => Promise.resolve([] as Citation[]))
    } as unknown as jest.Mocked<MetadataService>;

    accessControlService = new AccessControlService(mockMetadataService);
    mockUserId = 'test-user-id';
    mockPublicationId = 'test-publication-id';
    mockAccessRule = {
      type: 'age',
      value: 18,
      metadata: {
        issuer: 'test-issuer',
        timestamp: Date.now(),
        expiry: Date.now() + 86400000 // 24 hours from now
      }
    };
    
    // Setup ethers mocks
    (ethers.randomBytes as unknown as jest.Mock).mockReturnValue(new Uint8Array([1, 2, 3, 4]));
    (ethers.hexlify as unknown as jest.Mock).mockReturnValue(mockChannelId);
  });

  describe('Channel Management', () => {
    it('should create a privileged channel', async () => {
      const channel = await accessControlService.createChannel(
        'test-channel',
        [mockUserId],
        'test-encryption-key'
      );

      expect(channel).toBeDefined();
      expect(channel.name).toBe('test-channel');
      expect(channel.members).toContain(mockUserId);
    });

    it('should check privileged access', async () => {
      await accessControlService.createChannel(
        'test-channel',
        [mockUserId],
        'test-encryption-key'
      );

      const hasAccess = await accessControlService.checkPrivilegedAccess(mockUserId);
      expect(hasAccess).toBe(true);
    });

    it('should get user channels', async () => {
      await accessControlService.createChannel(
        'test-channel',
        [mockUserId],
        'test-encryption-key'
      );

      const channels = await accessControlService.getUserChannels(mockUserId);
      expect(channels).toHaveLength(1);
      expect(channels[0].name).toBe('test-channel');
    });
  });

  describe('Age Verification', () => {
    it('should verify user age', async () => {
      const result = await accessControlService.verifyAge(mockUserId, 18);
      expect(result).toBe(true);

      const verification = accessControlService.getAgeVerification(mockUserId);
      expect(verification).toBeDefined();
      expect(verification?.age).toBe(18);
    });

    it('should get age verification for user', async () => {
      await accessControlService.verifyAge(mockUserId, 18);
      const verification = accessControlService.getAgeVerification(mockUserId);
      expect(verification).toBeDefined();
      expect(verification?.age).toBe(18);
    });

    it('should return undefined for non-verified user', () => {
      const verification = accessControlService.getAgeVerification('non-verified');
      expect(verification).toBeUndefined();
    });
  });

  describe('Access Control', () => {
    it('should check access for public content', async () => {
      mockMetadataService.getAccessRules.mockReturnValue([]);
      const hasAccess = await accessControlService.checkAccess(mockPublicationId, mockUserId);
      expect(hasAccess).toBe(true);
    });

    it('should check access for age-restricted content', async () => {
      mockMetadataService.getAccessRules.mockReturnValue([mockAccessRule]);
      await accessControlService.verifyAge(mockUserId, 18);
      
      const hasAccess = await accessControlService.checkAccess(mockPublicationId, mockUserId);
      expect(hasAccess).toBe(true);
    });

    it('should deny access for age-restricted content without verification', async () => {
      mockMetadataService.getAccessRules.mockReturnValue([mockAccessRule]);
      
      const hasAccess = await accessControlService.checkAccess(mockPublicationId, mockUserId);
      expect(hasAccess).toBe(false);
    });

    it('should add access rule', async () => {
      await accessControlService.addAccessRule(mockPublicationId, mockAccessRule);
      expect(mockMetadataService.addAccessRule).toHaveBeenCalledWith(mockPublicationId, mockAccessRule);
    });
  });
}); 