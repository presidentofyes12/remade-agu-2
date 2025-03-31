import { ContentFingerprintService, ContentMetadata } from '../ContentFingerprintService';
import { ethers } from 'ethers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

// Mock ethers
jest.mock('ethers', () => ({
  keccak256: jest.fn(),
  toUtf8Bytes: jest.fn()
}));

// Mock @openzeppelin/merkle-tree
jest.mock('@openzeppelin/merkle-tree', () => ({
  StandardMerkleTree: {
    of: jest.fn().mockImplementation(() => ({
      getProof: jest.fn(),
      verify: jest.fn(),
      root: 'mock-root'
    }))
  }
}));

describe('ContentFingerprintService', () => {
  let fingerprintService: ContentFingerprintService;

  const mockContent = 'Test content';
  const mockHash = '0x1234567890abcdef';
  const mockUtf8Bytes = new Uint8Array([1, 2, 3, 4]);

  const mockMetadata: Omit<ContentMetadata, 'contentHash' | 'merkleRoot'> = {
    title: 'Test Publication',
    author: 'Test Author',
    mediaType: 'article',
    timestamp: Date.now(),
    ageRating: 13,
    privilegeLevel: 'public'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fingerprintService = new ContentFingerprintService();
    
    // Setup ethers mocks
    (ethers.toUtf8Bytes as unknown as jest.Mock).mockReturnValue(mockUtf8Bytes);
    (ethers.keccak256 as unknown as jest.Mock).mockReturnValue(mockHash);
  });

  describe('Initialization', () => {
    it('should initialize with empty merkle tree', () => {
      expect(fingerprintService).toBeDefined();
      expect(StandardMerkleTree.of).toHaveBeenCalledWith([['']], ['string']);
    });
  });

  describe('Content Hash Generation', () => {
    it('should generate content hash for book', async () => {
      const hash = await fingerprintService.generateContentHash(mockContent, 'book');
      
      expect(hash).toBe(mockHash);
      expect(ethers.toUtf8Bytes).toHaveBeenCalledWith(mockContent.replace(/\s+/g, ' ').trim());
      expect(ethers.keccak256).toHaveBeenCalledWith(mockUtf8Bytes);
    });

    it('should generate content hash for article', async () => {
      const htmlContent = '<p>Test <b>content</b></p>';
      const hash = await fingerprintService.generateContentHash(htmlContent, 'article');
      
      expect(hash).toBe(mockHash);
      expect(ethers.toUtf8Bytes).toHaveBeenCalledWith('Test content');
      expect(ethers.keccak256).toHaveBeenCalledWith(mockUtf8Bytes);
    });

    it('should generate content hash for paper', async () => {
      const paperContent = 'Test content [1] with citations [2]';
      const hash = await fingerprintService.generateContentHash(paperContent, 'paper');
      
      expect(hash).toBe(mockHash);
      expect(ethers.toUtf8Bytes).toHaveBeenCalledWith('Test content with citations');
      expect(ethers.keccak256).toHaveBeenCalledWith(mockUtf8Bytes);
    });
  });

  describe('Content Management', () => {
    it('should add content and return metadata with hash and merkle root', async () => {
      const metadata = await fingerprintService.addContent(mockMetadata);

      expect(metadata).toEqual({
        ...mockMetadata,
        contentHash: mockHash,
        merkleRoot: 'mock-root'
      });
    });

    it('should get content metadata by hash', async () => {
      await fingerprintService.addContent(mockMetadata);
      const metadata = fingerprintService.getContentMetadata(mockHash);

      expect(metadata).toEqual({
        ...mockMetadata,
        contentHash: mockHash,
        merkleRoot: 'mock-root'
      });
    });

    it('should return undefined for non-existent content hash', () => {
      const metadata = fingerprintService.getContentMetadata('non-existent-hash');
      expect(metadata).toBeUndefined();
    });

    it('should return all content hashes', async () => {
      await fingerprintService.addContent(mockMetadata);
      const hashes = fingerprintService.getAllContentHashes();

      expect(hashes).toEqual([mockHash]);
    });
  });

  describe('Merkle Tree Operations', () => {
    it('should generate proof for content hash', async () => {
      const mockProof = ['proof1', 'proof2'];
      const mockRoot = 'mock-root';
      const mockTree = (StandardMerkleTree.of as jest.Mock).mock.results[0].value;
      mockTree.getProof.mockReturnValue({ proof: mockProof, root: mockRoot });

      await fingerprintService.addContent(mockMetadata);
      const { proof, root } = await fingerprintService.generateProof(mockHash);

      expect(proof).toEqual(mockProof);
      expect(root).toBe(mockRoot);
      expect(mockTree.getProof).toHaveBeenCalled();
    });

    it('should verify content with proof', async () => {
      const mockProof = ['proof1', 'proof2'];
      const mockRoot = 'mock-root';
      const mockTree = (StandardMerkleTree.of as jest.Mock).mock.results[0].value;
      mockTree.verify.mockReturnValue(true);

      const isValid = await fingerprintService.verifyContent(mockHash, mockProof, mockRoot);

      expect(isValid).toBe(true);
      expect(mockTree.verify).toHaveBeenCalled();
    });

    it('should get merkle root', async () => {
      const mockTree = (StandardMerkleTree.of as jest.Mock).mock.results[0].value;
      const root = await fingerprintService.getMerkleRoot();

      expect(root).toBe('mock-root');
      expect(mockTree.root).toBe('mock-root');
    });
  });
}); 