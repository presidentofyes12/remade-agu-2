import { IPFSService } from './ipfsService';
import { NostrStorageService } from './nostrStorageService';
import { ContentFingerprintService } from './contentFingerprintService';
import { ErrorHandler } from '../utils/errorHandler';
import { RetryMechanism } from '../utils/retryMechanism';
import { LibraryItem } from '../types/library';
import { logger } from '../utils/logger';

export class LibraryService {
  private ipfsService: IPFSService;
  private nostrStorageService: NostrStorageService;
  private contentFingerprintService: ContentFingerprintService;
  private errorHandler: ErrorHandler;
  private retryMechanism: RetryMechanism;

  constructor() {
    this.ipfsService = new IPFSService();
    this.nostrStorageService = new NostrStorageService();
    this.contentFingerprintService = new ContentFingerprintService();
    this.errorHandler = ErrorHandler.getInstance();
    this.retryMechanism = RetryMechanism.getInstance();
  }

  async addItem(item: Omit<LibraryItem, 'id' | 'contentHash' | 'timestamp' | 'ipfsHash'>): Promise<LibraryItem> {
    try {
      const result = await this.retryMechanism.withRetry(async () => {
        // Generate content hash
        const contentHash = await this.contentFingerprintService.generateHash(item);
        
        // Create full item with generated fields
        const fullItem: LibraryItem = {
          ...item,
          id: crypto.randomUUID(),
          contentHash,
          timestamp: Date.now(),
          ipfsHash: undefined
        };

        // Try to store in IPFS first
        try {
          fullItem.ipfsHash = await this.ipfsService.store(item);
        } catch (error) {
          logger.warn('Failed to store item in IPFS, continuing without backup', { error });
        }

        return fullItem;
      });
      return result;
    } catch (error) {
      this.errorHandler.handleError(error, {
        operation: 'LibraryService.addItem',
        timestamp: Date.now(),
        additionalInfo: { item }
      });
      throw error;
    }
  }

  async getItem(id: string): Promise<LibraryItem | null> {
    try {
      const { result } = await this.retryMechanism.executeWithRetry(async () => {
        // Try to get from Nostr first
        const item = await this.nostrStorageService.getLibraryItem(id);
        if (item) return item;

        // If not found in Nostr, try IPFS
        const ipfsItem = await this.ipfsService.retrieve(id);
        if (ipfsItem) return ipfsItem;

        return null;
      });
      return result;
    } catch (error) {
      this.errorHandler.handleError(error, {
        operation: 'LibraryService.getItem',
        timestamp: Date.now(),
        additionalInfo: { id }
      });
      throw error;
    }
  }

  async listItems(tags?: string[]): Promise<LibraryItem[]> {
    try {
      const { result } = await this.retryMechanism.executeWithRetry(async () => {
        // Try to get from Nostr first
        const items = await this.nostrStorageService.listLibraryItems(tags);
        if (items.length > 0) return items;

        // If not found in Nostr, try IPFS
        const ipfsItems = await this.ipfsService.listItems(tags);
        if (ipfsItems.length > 0) return ipfsItems;

        return [];
      });
      return result;
    } catch (error) {
      this.errorHandler.handleError(error, {
        operation: 'LibraryService.listItems',
        timestamp: Date.now(),
        additionalInfo: { tags }
      });
      throw error;
    }
  }

  async deleteItem(id: string): Promise<void> {
    try {
      await this.retryMechanism.withRetry(async () => {
        // Get the item to check for IPFS hash
        const item = await this.nostrStorageService.getLibraryItem(id);
        if (!item) {
          throw new Error(`Item not found: ${id}`);
        }

        // Delete from Nostr
        await this.nostrStorageService.deleteLibraryItem(id);

        // If item has IPFS hash, delete from IPFS
        if (item.ipfsHash) {
          try {
            await this.ipfsService.delete(item.ipfsHash);
          } catch (error) {
            logger.warn('Failed to delete item from IPFS', { error, ipfsHash: item.ipfsHash });
          }
        }
      });
    } catch (error) {
      this.errorHandler.handleError(error, {
        operation: 'LibraryService.deleteItem',
        timestamp: Date.now(),
        additionalInfo: { id }
      });
      throw error;
    }
  }
} 