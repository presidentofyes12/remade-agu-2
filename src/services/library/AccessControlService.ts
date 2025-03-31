import { ethers } from 'ethers';
import { MetadataService, AccessControlRule } from './MetadataService';

export interface PrivilegedChannel {
  id: string;
  name: string;
  members: string[];
  encryptionKey: string;
  createdAt: number;
}

export interface AgeVerification {
  age: number;
  verifiedAt: number;
  issuer: string;
}

export class AccessControlService {
  private channels: Map<string, PrivilegedChannel> = new Map();
  private ageVerifications: Map<string, AgeVerification> = new Map();
  private metadataService: MetadataService;

  constructor(metadataService: MetadataService) {
    this.metadataService = metadataService;
  }

  async createChannel(
    name: string,
    members: string[],
    encryptionKey: string
  ): Promise<PrivilegedChannel> {
    const channel: PrivilegedChannel = {
      id: ethers.hexlify(ethers.randomBytes(32)),
      name,
      members,
      encryptionKey,
      createdAt: Date.now()
    };

    this.channels.set(channel.id, channel);
    return channel;
  }

  async checkPrivilegedAccess(userId: string): Promise<boolean> {
    // Check if user is a member of any privileged channel
    for (const channel of this.channels.values()) {
      if (channel.members.includes(userId)) {
        return true;
      }
    }
    return false;
  }

  async getUserChannels(userId: string): Promise<PrivilegedChannel[]> {
    return Array.from(this.channels.values())
      .filter(channel => channel.members.includes(userId));
  }

  async verifyAge(userId: string, age: number): Promise<boolean> {
    const verification: AgeVerification = {
      age,
      verifiedAt: Date.now(),
      issuer: 'system'
    };
    this.ageVerifications.set(userId, verification);
    return true;
  }

  async checkAccess(
    publicationId: string,
    userId: string,
    userAge?: number
  ): Promise<boolean> {
    // Check age restrictions
    if (userAge !== undefined) {
      const verification = this.ageVerifications.get(userId);
      if (verification && verification.age < userAge) {
        return false;
      }
    }

    // Check privileged access
    return await this.checkPrivilegedAccess(userId);
  }

  /**
   * Get age verification for a user
   */
  getAgeVerification(userId: string): AgeVerification | undefined {
    return this.ageVerifications.get(userId);
  }

  /**
   * Add an access control rule
   */
  async addAccessRule(
    contentHash: string,
    rule: AccessControlRule
  ): Promise<void> {
    await this.metadataService.addAccessRule(contentHash, rule);
  }
} 