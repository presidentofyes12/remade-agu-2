import { NostrEventHandler } from '../NostrEventHandler';
import { errorHandler } from '../../errorHandler';
import { logger } from '../../logger';
import { EVENT_KINDS } from '../schemas';

jest.mock('../../errorHandler');
jest.mock('../../logger');

describe('NostrEventHandler', () => {
  let nostrEventHandler: NostrEventHandler;
  let mockWebSocket: jest.Mocked<WebSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: WebSocket.OPEN
    } as any;

    global.WebSocket = jest.fn(() => mockWebSocket) as any;
    nostrEventHandler = NostrEventHandler.getInstance();
  });

  describe('connect', () => {
    it('should connect to relay successfully', async () => {
      await nostrEventHandler.connect('wss://relay.example.com');

      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle connection errors', async () => {
      mockWebSocket.addEventListener.mockImplementation((event, callback) => {
        if (event === 'error') {
          callback(new Error('Connection failed'));
        }
      });

      await expect(nostrEventHandler.connect('wss://relay.example.com')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from relay successfully', async () => {
      await nostrEventHandler.connect('wss://relay.example.com');
      await nostrEventHandler.disconnect('wss://relay.example.com');

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should handle disconnection errors', async () => {
      mockWebSocket.close.mockImplementation(() => {
        throw new Error('Disconnection failed');
      });

      await nostrEventHandler.connect('wss://relay.example.com');
      await expect(nostrEventHandler.disconnect('wss://relay.example.com')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to events successfully', async () => {
      await nostrEventHandler.connect('wss://relay.example.com');
      await nostrEventHandler.subscribe('wss://relay.example.com', {
        kinds: [EVENT_KINDS.DAO_CREATION]
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('REQ')
      );
    });

    it('should handle subscription errors', async () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Subscription failed');
      });

      await nostrEventHandler.connect('wss://relay.example.com');
      await expect(
        nostrEventHandler.subscribe('wss://relay.example.com', {
          kinds: [EVENT_KINDS.DAO_CREATION]
        })
      ).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should publish event successfully', async () => {
      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: '0x123',
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' }),
        id: '0x456',
        sig: '0x789'
      };

      await nostrEventHandler.connect('wss://relay.example.com');
      await nostrEventHandler.publish('wss://relay.example.com', event);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('EVENT')
      );
    });

    it('should handle publication errors', async () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Publication failed');
      });

      const event = {
        kind: EVENT_KINDS.DAO_CREATION,
        pubkey: '0x123',
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({ name: 'Test DAO' }),
        id: '0x456',
        sig: '0x789'
      };

      await nostrEventHandler.connect('wss://relay.example.com');
      await expect(
        nostrEventHandler.publish('wss://relay.example.com', event)
      ).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('handleMessage', () => {
    it('should handle incoming message successfully', async () => {
      const message = {
        type: 'EVENT',
        data: {
          kind: EVENT_KINDS.DAO_CREATION,
          pubkey: '0x123',
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
          content: JSON.stringify({ name: 'Test DAO' }),
          id: '0x456',
          sig: '0x789'
        }
      };

      const mockHandler = jest.fn();
      nostrEventHandler.on(EVENT_KINDS.DAO_CREATION, mockHandler);

      await nostrEventHandler.connect('wss://relay.example.com');
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];

      messageHandler({ data: JSON.stringify(message) });

      expect(mockHandler).toHaveBeenCalledWith(message.data);
    });

    it('should handle invalid message format', async () => {
      await nostrEventHandler.connect('wss://relay.example.com');
      const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )[1];

      messageHandler({ data: 'invalid json' });

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });
}); 