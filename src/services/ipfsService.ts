import { LibraryItem } from '../types/library';

export interface IPFSContent {
  id: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
}

export class IPFSService {
  private gateway: string;
  private storage: Map<string, IPFSContent>;

  constructor(gateway: string = 'https://ipfs.io/ipfs/') {
    this.gateway = gateway;
    this.storage = new Map();
  }

  async storeContent(content: Omit<IPFSContent, 'id'>): Promise<string> {
    try {
      // In a real implementation, this would interact with an IPFS node
      // For now, we'll simulate with a mock hash
      const mockHash = `Qm${Math.random().toString(36).substring(2, 15)}`;
      const id = `ipfs-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      const ipfsContent: IPFSContent = {
        ...content,
        id
      };

      this.storage.set(mockHash, ipfsContent);
      return mockHash;
    } catch (error) {
      console.error('Error storing content on IPFS:', error);
      throw error;
    }
  }

  async retrieveContent(hash: string): Promise<IPFSContent> {
    try {
      const content = this.storage.get(hash);
      if (!content) {
        throw new Error('Content not found');
      }
      return content;
    } catch (error) {
      console.error('Error retrieving content from IPFS:', error);
      throw error;
    }
  }

  async removeContent(hash: string): Promise<void> {
    try {
      this.storage.delete(hash);
    } catch (error) {
      console.error('Error removing content from IPFS:', error);
      throw error;
    }
  }

  async listContent(): Promise<IPFSContent[]> {
    try {
      return Array.from(this.storage.values());
    } catch (error) {
      console.error('Error listing IPFS content:', error);
      throw error;
    }
  }

  getContentUrl(hash: string): string {
    return `${this.gateway}${hash}`;
  }
} 