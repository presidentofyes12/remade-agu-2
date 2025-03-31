import { ethers } from 'ethers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { Buffer } from 'buffer';

export interface ContentMetadata {
  title: string;
  author: string;
  mediaType: 'book' | 'article' | 'paper';
  timestamp: number;
  contentHash: string;
  merkleRoot: string;
  ageRating: number;
  privilegeLevel: 'public' | 'restricted' | 'privileged';
}

export class ContentFingerprintService {
  private merkleTree: StandardMerkleTree<string[]> | null = null;
  private contentHashes: Map<string, ContentMetadata> = new Map();

  constructor() {
    // Initialize with empty tree
    this.merkleTree = StandardMerkleTree.of([['']], ['string']);
  }

  /**
   * Generate a content hash for different media types
   */
  async generateContentHash(content: string, mediaType: ContentMetadata['mediaType']): Promise<string> {
    // Normalize content based on media type
    const normalizedContent = this.normalizeContent(content, mediaType);
    
    // Generate hash using keccak256
    const hash = ethers.keccak256(ethers.toUtf8Bytes(normalizedContent));
    return hash;
  }

  /**
   * Normalize content based on media type
   */
  private normalizeContent(content: string, mediaType: ContentMetadata['mediaType']): string {
    switch (mediaType) {
      case 'book':
        // Remove whitespace and normalize line endings
        return content.replace(/\s+/g, ' ').trim();
      case 'article':
        // Remove HTML tags and normalize spacing
        return content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      case 'paper':
        // Remove citations and normalize formatting
        return content.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
      default:
        return content;
    }
  }

  /**
   * Add content to the Merkle tree and generate proof
   */
  async addContent(metadata: Omit<ContentMetadata, 'contentHash' | 'merkleRoot'>): Promise<ContentMetadata> {
    // Generate content hash
    const contentHash = await this.generateContentHash(metadata.title, metadata.mediaType);
    
    // Create full metadata with hash
    const fullMetadata: ContentMetadata = {
      ...metadata,
      contentHash,
      merkleRoot: this.merkleTree!.root
    };

    // Add to content hashes map
    this.contentHashes.set(contentHash, fullMetadata);

    // Update Merkle tree
    const values = Array.from(this.contentHashes.values()).map(m => [m.contentHash]);
    this.merkleTree = StandardMerkleTree.of(values, ['string']);

    return fullMetadata;
  }

  /**
   * Generate Merkle proof for content verification
   */
  async generateProof(contentHash: string): Promise<{
    proof: string[];
    root: string;
  }> {
    const metadata = this.contentHashes.get(contentHash);
    if (!metadata) {
      throw new Error('Content not found');
    }

    const proof = this.merkleTree!.getProof([contentHash]);
    return {
      proof,
      root: this.merkleTree!.root
    };
  }

  /**
   * Verify content inclusion using Merkle proof
   */
  async verifyContent(
    contentHash: string,
    proof: string[],
    root: string
  ): Promise<boolean> {
    return StandardMerkleTree.verify(
      root,
      ['string'],
      [contentHash],
      proof
    );
  }

  /**
   * Get content metadata by hash
   */
  getContentMetadata(contentHash: string): ContentMetadata | undefined {
    return this.contentHashes.get(contentHash);
  }

  /**
   * Get all content hashes
   */
  getAllContentHashes(): string[] {
    return Array.from(this.contentHashes.keys());
  }

  async getMerkleRoot(): Promise<string> {
    return this.merkleTree!.root;
  }
} 