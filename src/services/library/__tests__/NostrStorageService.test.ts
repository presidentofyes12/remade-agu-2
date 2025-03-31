import { NostrStorageService, NostrPublicationEvent, NostrMetadataEvent, NostrAccessEvent } from '../NostrStorageService';
import { Publication } from '../LibraryService';
import { SimplePool, Event } from 'nostr-tools';

// Mock nostr-tools
jest.mock('nostr-tools', () => ({
  SimplePool: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    publish: jest.fn(),
    sub: jest.fn(),
    close: jest.fn()
  })),
  Filter: jest.fn(),
  Event: jest.fn()
}));

jest.mock('nostr-tools/pure', () => ({
  getPublicKey: jest.fn(),
  finalizeEvent: jest.fn()
}));

describe('NostrStorageService', () => {
  let nostrService: NostrStorageService;
  const mockRelays = ['wss://relay1.com', 'wss://relay2.com'];
  const mockPrivateKey = 'mock-private-key';
  const mockPublicKey = 'mock-public-key';

  const mockPublication: Publication = {
    content: 'Test content',
    metadata: {
      title: 'Test Publication',
      author: 'Test Author',
      mediaType: 'article',
      timestamp: Date.now(),
      ageRating: 13,
      privilegeLevel: 'public'
    }
  };

  const mockPublicationEvent: NostrPublicationEvent = {
    id: 'mock-event-id',
    pubkey: mockPublicKey,
    created_at: Date.now(),
    kind: 30023,
    sig: 'mock-signature',
    content: JSON.stringify(mockPublication),
    tags: [
      ['title', mockPublication.metadata.title],
      ['author', mockPublication.metadata.author],
      ['mediaType', mockPublication.metadata.mediaType],
      ['ageRating', mockPublication.metadata.ageRating.toString()],
      ['privilegeLevel', mockPublication.metadata.privilegeLevel],
      ['contentHash', 'mock-hash'],
      ['merkleRoot', 'mock-merkle-root']
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    nostrService = new NostrStorageService(mockRelays, mockPrivateKey);
  });

  describe('Initialization', () => {
    it('should initialize with relays and private key', () => {
      expect(nostrService).toBeDefined();
      expect(SimplePool).toHaveBeenCalled();
    });

    it('should update relays', () => {
      const newRelays = ['wss://new-relay.com'];
      nostrService.updateRelays(newRelays);
      expect(SimplePool).toHaveBeenCalled();
    });
  });

  describe('Publication Storage', () => {
    it('should store a publication successfully', async () => {
      const mockPool = (SimplePool as jest.Mock).mock.results[0].value;
      mockPool.publish.mockResolvedValue(['mock-relay']);
      (require('nostr-tools/pure').finalizeEvent as jest.Mock).mockReturnValue(mockPublicationEvent);

      const id = await nostrService.storePublication(mockPublication);

      expect(id).toBe(mockPublicationEvent.id);
      expect(mockPool.publish).toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      const mockPool = (SimplePool as jest.Mock).mock.results[0].value;
      mockPool.publish.mockRejectedValue(new Error('Storage failed'));

      await expect(nostrService.storePublication(mockPublication))
        .rejects
        .toThrow('Failed to store publication');
    });
  });

  describe('Publication Retrieval', () => {
    it('should retrieve a publication successfully', async () => {
      const mockPool = (SimplePool as jest.Mock).mock.results[0].value;
      mockPool.get.mockResolvedValue(mockPublicationEvent);

      const publication = await nostrService.getPublication(mockPublicationEvent.id);

      expect(publication).toEqual(mockPublication);
      expect(mockPool.get).toHaveBeenCalled();
    });

    it('should handle retrieval errors', async () => {
      const mockPool = (SimplePool as jest.Mock).mock.results[0].value;
      mockPool.get.mockRejectedValue(new Error('Retrieval failed'));

      await expect(nostrService.getPublication(mockPublicationEvent.id))
        .rejects
        .toThrow('Failed to retrieve publication');
    });
  });

  describe('Metadata Management', () => {
    it('should store metadata successfully', async () => {
      const mockPool = (SimplePool as jest.Mock).mock.results[0].value;
      const mockMetadataEvent: NostrMetadataEvent = {
        id: 'mock-metadata-id',
        pubkey: mockPublicKey,
        created_at: Date.now(),
        kind: 30024,
        sig: 'mock-signature',
        content: 'mock-content',
        tags: [
          ['publicationId', 'mock-publication-id'],
          ['type', 'author'],
          ['targetId', 'mock-target-id'],
          ['verified', 'true']
        ]
      };

      mockPool.publish.mockResolvedValue(['mock-relay']);
      (require('nostr-tools/pure').finalizeEvent as jest.Mock).mockReturnValue(mockMetadataEvent);

      const id = await nostrService.storeMetadata(
        'mock-publication-id',
        'author',
        'mock-target-id',
        true
      );

      expect(id).toBe(mockMetadataEvent.id);
      expect(mockPool.publish).toHaveBeenCalled();
    });

    it('should fetch metadata successfully', async () => {
      const mockPool = (SimplePool as jest.Mock).mock.results[0].value;
      const mockMetadataEvents: NostrMetadataEvent[] = [{
        id: 'mock-metadata-id',
        pubkey: mockPublicKey,
        created_at: Date.now(),
        kind: 30024,
        sig: 'mock-signature',
        content: 'mock-content',
        tags: [
          ['publicationId', 'mock-publication-id'],
          ['type', 'author'],
          ['targetId', 'mock-target-id'],
          ['verified', 'true']
        ]
      }];

      mockPool.get.mockResolvedValue(mockMetadataEvents);

      const metadata = await nostrService.fetchMetadata('mock-publication-id');

      expect(metadata).toEqual(mockMetadataEvents);
      expect(mockPool.get).toHaveBeenCalled();
    });
  });

  describe('Access Control', () => {
    it('should store access rules successfully', async () => {
      const mockPool = (SimplePool as jest.Mock).mock.results[0].value;
      const mockAccessEvent: NostrAccessEvent = {
        id: 'mock-access-id',
        pubkey: mockPublicKey,
        created_at: Date.now(),
        kind: 30025,
        sig: 'mock-signature',
        content: 'mock-content',
        tags: [
          ['publicationId', 'mock-publication-id'],
          ['type', 'age'],
          ['value', '18'],
          ['issuer', 'mock-issuer'],
          ['expiry', '1234567890']
        ]
      };

      mockPool.publish.mockResolvedValue(['mock-relay']);
      (require('nostr-tools/pure').finalizeEvent as jest.Mock).mockReturnValue(mockAccessEvent);

      const id = await nostrService.storeAccessRule(
        'mock-publication-id',
        'age',
        '18',
        'mock-issuer',
        1234567890
      );

      expect(id).toBe(mockAccessEvent.id);
      expect(mockPool.publish).toHaveBeenCalled();
    });

    it('should fetch access rules successfully', async () => {
      const mockPool = (SimplePool as jest.Mock).mock.results[0].value;
      const mockAccessEvents: NostrAccessEvent[] = [{
        id: 'mock-access-id',
        pubkey: mockPublicKey,
        created_at: Date.now(),
        kind: 30025,
        sig: 'mock-signature',
        content: 'mock-content',
        tags: [
          ['publicationId', 'mock-publication-id'],
          ['type', 'age'],
          ['value', '18'],
          ['issuer', 'mock-issuer'],
          ['expiry', '1234567890']
        ]
      }];

      mockPool.get.mockResolvedValue(mockAccessEvents);

      const accessRules = await nostrService.fetchAccessRules('mock-publication-id');

      expect(accessRules).toEqual(mockAccessEvents);
      expect(mockPool.get).toHaveBeenCalled();
    });
  });
}); 