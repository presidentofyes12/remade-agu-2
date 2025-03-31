import { EventSigner } from '../EventSigner';
import { errorHandler } from '../../errorHandler';
import { logger } from '../../logger';
import { EVENT_KINDS } from '../schemas';

jest.mock('../../errorHandler');
jest.mock('../../logger');

describe('EventSigner', () => {
  let eventSigner: EventSigner;
  let mockPrivateKey: string;
  let mockPublicKey: string;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    mockPublicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    eventSigner = EventSigner.getInstance();
  });

  describe('signEvent', () => {
    it('should sign event successfully', async () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' })
      };

      const signedEvent = await eventSigner.signEvent(event, mockPrivateKey);

      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
      expect(signedEvent.pubkey).toBe(mockPublicKey);
    });

    it('should handle signing errors', async () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' })
      };

      jest.spyOn(eventSigner as any, 'generateId').mockImplementation(() => {
        throw new Error('ID generation failed');
      });

      await expect(
        eventSigner.signEvent(event, mockPrivateKey)
      ).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('verifyEvent', () => {
    it('should verify event successfully', async () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' }),
        id: '0x456',
        sig: '0x789'
      };

      const isValid = await eventSigner.verifyEvent(event);
      expect(isValid).toBe(true);
    });

    it('should reject invalid event', async () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' }),
        id: '0x456',
        sig: '0x789'
      };

      jest.spyOn(eventSigner as any, 'verifySignature').mockResolvedValue(false);

      const isValid = await eventSigner.verifyEvent(event);
      expect(isValid).toBe(false);
    });

    it('should handle verification errors', async () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' }),
        id: '0x456',
        sig: '0x789'
      };

      jest.spyOn(eventSigner as any, 'verifySignature').mockImplementation(() => {
        throw new Error('Verification failed');
      });

      await expect(eventSigner.verifyEvent(event)).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('generateId', () => {
    it('should generate valid event ID', () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' })
      };

      const id = eventSigner['generateId'](event);
      expect(id).toBeDefined();
      expect(id.length).toBe(64);
      expect(id).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('should handle ID generation errors', () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' })
      };

      jest.spyOn(global, 'crypto').mockImplementation(() => {
        throw new Error('Crypto operation failed');
      });

      expect(() => eventSigner['generateId'](event)).toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('verifySignature', () => {
    it('should verify signature successfully', async () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' }),
        id: '0x456',
        sig: '0x789'
      };

      const isValid = await eventSigner['verifySignature'](event);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: mockPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' }),
        id: '0x456',
        sig: '0x789'
      };

      jest.spyOn(global, 'crypto').mockImplementation(() => {
        throw new Error('Crypto operation failed');
      });

      const isValid = await eventSigner['verifySignature'](event);
      expect(isValid).toBe(false);
    });
  });
}); 