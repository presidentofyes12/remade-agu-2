import { create } from 'ipfs-http-client';
import { Buffer } from 'buffer';
import { Publication } from './LibraryService';

export class IPFSService {
  private ipfs: any;
  private gateway: string;

  constructor(gateway: string = 'https://ipfs.io') {
    this.gateway = gateway;
    // Initialize IPFS client
    this.ipfs = create({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https',
      headers: {
        authorization: `Basic ${Buffer.from(
          `${process.env.REACT_APP_INFURA_PROJECT_ID}:${process.env.REACT_APP_INFURA_PROJECT_SECRET}`
        ).toString('base64')}`
      }
    });
  }

  async uploadPublication(publication: Publication): Promise<string> {
    try {
      // Convert publication to JSON
      const data = JSON.stringify(publication);
      const buffer = Buffer.from(data);
      
      // Upload to IPFS
      const result = await this.ipfs.add(buffer);
      return result.path;
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw new Error('Failed to upload publication to IPFS');
    }
  }

  async getPublication(cid: string): Promise<Publication> {
    try {
      // Fetch from IPFS
      const stream = await this.ipfs.cat(cid);
      const chunks = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const data = Buffer.concat(chunks).toString();
      return JSON.parse(data);
    } catch (error) {
      console.error('Error fetching from IPFS:', error);
      throw new Error('Failed to fetch publication from IPFS');
    }
  }

  getGatewayUrl(cid: string): string {
    return `${this.gateway}/ipfs/${cid}`;
  }

  async pinPublication(cid: string): Promise<void> {
    try {
      await this.ipfs.pin.add(cid);
    } catch (error) {
      console.error('Error pinning to IPFS:', error);
      throw new Error('Failed to pin publication to IPFS');
    }
  }

  async unpinPublication(cid: string): Promise<void> {
    try {
      await this.ipfs.pin.rm(cid);
    } catch (error) {
      console.error('Error unpinning from IPFS:', error);
      throw new Error('Failed to unpin publication from IPFS');
    }
  }
} 