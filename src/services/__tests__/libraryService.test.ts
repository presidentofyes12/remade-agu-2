import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LibraryService, LibraryItem } from '../libraryService';
import { IPFSService } from '../ipfsService';
import { NostrStorageService } from '../nostrStorageService';
import { ContentFingerprintService } from '../contentFingerprintService';

describe('LibraryService', () => {
  let libraryService: LibraryService;
  let mockIPFSService: jest.Mocked<IPFSService>;
  let mockNostrStorageService: jest.Mocked<NostrStorageService>;
  let mockFingerprintService: jest.Mocked<ContentFingerprintService>;

  beforeEach(() => {
    mockIPFSService = {
      storeContent: jest.fn(),
      retrieveContent: jest.fn(),
      removeContent: jest.fn(),
      listContent: jest.fn(),
      getContentUrl: jest.fn()
    } as any;

    mockNostrStorageService = {
      storeLibraryItem: jest.fn(),
      updateLibraryItem: jest.fn(),
      getLibraryItem: jest.fn(),
      listLibraryItems: jest.fn(),
      deleteLibraryItem: jest.fn()
    } as any;

    mockFingerprintService = {
      generateHash: jest.fn(),
      verifyHash: jest.fn()
    } as any;

    libraryService = new LibraryService(
      mockIPFSService,
      mockNostrStorageService,
      mockFingerprintService
    );
  });

  describe('addItem', () => {
    it('should add an item to both Nostr and IPFS', async () => {
      const mockItem = {
        title: 'Test Item',
        description: 'Test Description',
        author: 'Test Author',
        tags: ['test']
      };

      const mockContentHash = 'mock-content-hash';
      const mockIPFSHash = 'mock-ipfs-hash';

      mockFingerprintService.generateHash.mockResolvedValue(mockContentHash);
      mockIPFSService.storeContent.mockResolvedValue(mockIPFSHash);

      const result = await libraryService.addItem(mockItem);

      expect(mockFingerprintService.generateHash).toHaveBeenCalledWith(mockItem);
      expect(mockNostrStorageService.storeLibraryItem).toHaveBeenCalled();
      expect(mockIPFSService.storeContent).toHaveBeenCalledWith(mockItem);
      expect(mockNostrStorageService.updateLibraryItem).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.ipfsHash).toBe(mockIPFSHash);
    });

    it('should continue if IPFS backup fails', async () => {
      const mockItem = {
        title: 'Test Item',
        description: 'Test Description',
        author: 'Test Author',
        tags: ['test']
      };

      const mockContentHash = 'mock-content-hash';
      mockFingerprintService.generateHash.mockResolvedValue(mockContentHash);
      mockIPFSService.storeContent.mockRejectedValue(new Error('IPFS Error'));

      const result = await libraryService.addItem(mockItem);

      expect(result).toBeDefined();
      expect(result.ipfsHash).toBeUndefined();
    });
  });

  describe('getItem', () => {
    it('should retrieve item from Nostr first', async () => {
      const mockItem: LibraryItem = {
        id: 'test-id',
        title: 'Test Item',
        description: 'Test Description',
        contentHash: 'mock-hash',
        timestamp: Date.now(),
        author: 'Test Author',
        tags: ['test']
      };

      mockNostrStorageService.getLibraryItem.mockResolvedValue(mockItem);
      mockFingerprintService.generateHash.mockResolvedValue('mock-hash');

      const result = await libraryService.getItem('test-id');

      expect(result).toEqual(mockItem);
      expect(mockIPFSService.listContent).not.toHaveBeenCalled();
    });

    it('should recover from IPFS if not found in Nostr', async () => {
      const mockItem: LibraryItem = {
        id: 'test-id',
        title: 'Test Item',
        description: 'Test Description',
        contentHash: 'mock-hash',
        timestamp: Date.now(),
        author: 'Test Author',
        tags: ['test']
      };

      mockNostrStorageService.getLibraryItem.mockResolvedValue(null);
      mockIPFSService.listContent.mockResolvedValue([mockItem]);
      mockFingerprintService.generateHash.mockResolvedValue('mock-hash');

      const result = await libraryService.getItem('test-id');

      expect(result).toEqual(mockItem);
      expect(mockNostrStorageService.storeLibraryItem).toHaveBeenCalledWith(mockItem);
    });
  });

  describe('listItems', () => {
    it('should list items from Nostr first', async () => {
      const mockItems: LibraryItem[] = [
        {
          id: 'test-id-1',
          title: 'Test Item 1',
          description: 'Test Description 1',
          contentHash: 'mock-hash-1',
          timestamp: Date.now(),
          author: 'Test Author',
          tags: ['test']
        },
        {
          id: 'test-id-2',
          title: 'Test Item 2',
          description: 'Test Description 2',
          contentHash: 'mock-hash-2',
          timestamp: Date.now(),
          author: 'Test Author',
          tags: ['test']
        }
      ];

      mockNostrStorageService.listLibraryItems.mockResolvedValue(mockItems);

      const result = await libraryService.listItems(['test']);

      expect(result).toEqual(mockItems);
      expect(mockIPFSService.listContent).not.toHaveBeenCalled();
    });

    it('should recover from IPFS if no items in Nostr', async () => {
      const mockItems: LibraryItem[] = [
        {
          id: 'test-id-1',
          title: 'Test Item 1',
          description: 'Test Description 1',
          contentHash: 'mock-hash-1',
          timestamp: Date.now(),
          author: 'Test Author',
          tags: ['test']
        }
      ];

      mockNostrStorageService.listLibraryItems.mockResolvedValue([]);
      mockIPFSService.listContent.mockResolvedValue(mockItems);

      const result = await libraryService.listItems(['test']);

      expect(result).toEqual(mockItems);
      expect(mockNostrStorageService.storeLibraryItem).toHaveBeenCalledWith(mockItems[0]);
    });
  });

  describe('deleteItem', () => {
    it('should delete item from both Nostr and IPFS', async () => {
      const mockItem: LibraryItem = {
        id: 'test-id',
        title: 'Test Item',
        description: 'Test Description',
        contentHash: 'mock-hash',
        timestamp: Date.now(),
        author: 'Test Author',
        tags: ['test'],
        ipfsHash: 'mock-ipfs-hash'
      };

      mockNostrStorageService.getLibraryItem.mockResolvedValue(mockItem);

      await libraryService.deleteItem('test-id');

      expect(mockNostrStorageService.deleteLibraryItem).toHaveBeenCalledWith('test-id');
      expect(mockIPFSService.removeContent).toHaveBeenCalledWith('mock-ipfs-hash');
    });

    it('should continue if IPFS deletion fails', async () => {
      const mockItem: LibraryItem = {
        id: 'test-id',
        title: 'Test Item',
        description: 'Test Description',
        contentHash: 'mock-hash',
        timestamp: Date.now(),
        author: 'Test Author',
        tags: ['test'],
        ipfsHash: 'mock-ipfs-hash'
      };

      mockNostrStorageService.getLibraryItem.mockResolvedValue(mockItem);
      mockIPFSService.removeContent.mockRejectedValue(new Error('IPFS Error'));

      await libraryService.deleteItem('test-id');

      expect(mockNostrStorageService.deleteLibraryItem).toHaveBeenCalledWith('test-id');
    });
  });
}); 