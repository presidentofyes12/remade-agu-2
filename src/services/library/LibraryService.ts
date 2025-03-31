import { ContentFingerprintService, ContentMetadata } from './ContentFingerprintService';
import { MetadataService, Citation } from './MetadataService';
import { AccessControlService, PrivilegedChannel } from './AccessControlService';
import { NostrStorageService } from './NostrStorageService';
import { IPFSService } from './IPFSService';

export interface Publication {
  content: string;
  metadata: {
    title: string;
    author: string;
    mediaType: 'book' | 'article' | 'paper';
    timestamp: number;
    ageRating: number;
    privilegeLevel: 'public' | 'restricted' | 'privileged';
    ipfsCid?: string; // Optional IPFS CID for backup storage
  };
}

export interface RelayConfig {
  url: string;
  isAdminRelay: boolean;
  requiresAuth?: boolean;
  authToken?: string;
}

export class LibraryService {
  private contentFingerprintService: ContentFingerprintService;
  private metadataService: MetadataService;
  private accessControlService: AccessControlService;
  private nostrStorageService: NostrStorageService;
  private ipfsService: IPFSService;
  private useIPFS: boolean;
  private useAdminRelays: boolean;
  private adminRelays: RelayConfig[];

  constructor(
    relays: RelayConfig[],
    privateKey: string,
    useIPFS: boolean = true,
    useAdminRelays: boolean = false
  ) {
    this.contentFingerprintService = new ContentFingerprintService();
    this.metadataService = new MetadataService();
    this.accessControlService = new AccessControlService(this.metadataService);
    
    // Filter relays based on admin settings
    const publicRelays = relays.filter(r => !r.isAdminRelay).map(r => r.url);
    const adminRelays = relays.filter(r => r.isAdminRelay).map(r => r.url);
    
    // Use admin relays if enabled, otherwise use public relays
    const activeRelays = useAdminRelays ? adminRelays : publicRelays;
    
    this.nostrStorageService = new NostrStorageService(activeRelays, privateKey);
    this.ipfsService = new IPFSService();
    this.useIPFS = useIPFS;
    this.useAdminRelays = useAdminRelays;
    this.adminRelays = relays;
  }

  /**
   * Add a new publication
   */
  async addPublication(publication: Publication): Promise<string> {
    try {
      // Generate content hash
      const contentHash = await this.contentFingerprintService.generateContentHash(
        publication.content,
        publication.metadata.mediaType
      );
      
      // Store metadata relationships
      await this.metadataService.addContentMetadata({
        title: publication.metadata.title,
        author: publication.metadata.author,
        mediaType: publication.metadata.mediaType,
        timestamp: publication.metadata.timestamp,
        contentHash,
        merkleRoot: await this.contentFingerprintService.getMerkleRoot(),
        ageRating: publication.metadata.ageRating,
        privilegeLevel: publication.metadata.privilegeLevel
      });

      // Store in Nostr first (primary storage)
      const nostrId = await this.nostrStorageService.storePublication(publication);

      // Store in IPFS as backup if enabled
      if (this.useIPFS) {
        try {
          const ipfsCid = await this.ipfsService.uploadPublication(publication);
          await this.ipfsService.pinPublication(ipfsCid);
          
          // Update publication with IPFS CID
          publication.metadata.ipfsCid = ipfsCid;
          
          // Update in Nostr with IPFS CID
          await this.nostrStorageService.updatePublication(nostrId, publication);
        } catch (error) {
          console.warn('Failed to store in IPFS backup:', error);
          // Continue without IPFS backup
        }
      }

      return nostrId;
    } catch (error) {
      console.error('Error adding publication:', error);
      throw new Error('Failed to add publication');
    }
  }

  /**
   * Get a publication by ID
   */
  async getPublication(id: string): Promise<Publication> {
    try {
      // Always try Nostr first (primary storage)
      try {
        return await this.nostrStorageService.getPublication(id);
      } catch (error) {
        console.warn('Failed to fetch from Nostr:', error);
      }

      // If Nostr fails and IPFS is enabled, try IPFS as backup
      if (this.useIPFS) {
        try {
          return await this.ipfsService.getPublication(id);
        } catch (error) {
          console.warn('Failed to fetch from IPFS backup:', error);
        }
      }

      throw new Error('Publication not found in any storage');
    } catch (error) {
      console.error('Error getting publication:', error);
      throw new Error('Failed to get publication');
    }
  }

  /**
   * Check if a user has access to a publication
   */
  async checkAccess(
    publicationId: string,
    userId: string,
    userAge?: number
  ): Promise<boolean> {
    try {
      const publication = await this.getPublication(publicationId);
      
      // Check age restrictions
      if (userAge && publication.metadata.ageRating > userAge) {
        return false;
      }

      // Check privilege level
      if (publication.metadata.privilegeLevel === 'privileged') {
        return await this.accessControlService.checkPrivilegedAccess(userId);
      }

      return true;
    } catch (error) {
      console.error('Error checking access:', error);
      return false;
    }
  }

  /**
   * Create a privileged communication channel
   */
  async createPrivilegedChannel(
    name: string,
    members: string[],
    encryptionKey: string
  ): Promise<PrivilegedChannel> {
    return this.accessControlService.createChannel(name, members, encryptionKey);
  }

  /**
   * Verify age using zero-knowledge proof
   */
  async verifyAge(userId: string, age: number): Promise<boolean> {
    return this.accessControlService.verifyAge(userId, age);
  }

  /**
   * Get all privileged channels for a user
   */
  async getUserPrivilegedChannels(userId: string): Promise<PrivilegedChannel[]> {
    return this.accessControlService.getUserChannels(userId);
  }

  /**
   * Get publication metadata
   */
  async getPublicationMetadata(publicationId: string): Promise<ContentMetadata> {
    return this.metadataService.getContentMetadata(publicationId);
  }

  /**
   * Get citation network
   */
  async getCitationNetwork(publicationId: string): Promise<Citation[]> {
    return this.metadataService.getCitationNetwork(publicationId);
  }

  /**
   * Toggle admin relay usage
   */
  setUseAdminRelays(useAdminRelays: boolean): void {
    this.useAdminRelays = useAdminRelays;
    const activeRelays = useAdminRelays 
      ? this.adminRelays.filter(r => r.isAdminRelay).map(r => r.url)
      : this.adminRelays.filter(r => !r.isAdminRelay).map(r => r.url);
    
    this.nostrStorageService.updateRelays(activeRelays);
  }

  /**
   * Get current relay configuration
   */
  getRelayConfig(): {
    useAdminRelays: boolean;
    relays: RelayConfig[];
  } {
    return {
      useAdminRelays: this.useAdminRelays,
      relays: this.adminRelays
    };
  }
} 