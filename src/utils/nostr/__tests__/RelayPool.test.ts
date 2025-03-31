import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RelayPool, RelayPoolConfig, RelayStatus } from '../RelayPool';
import { NostrEvent, RelayConfig } from '../NostrEventHandler';
import { errorHandler } from '../../errorHandler';
import { logger } from '../../logger';
import { EVENT_KINDS } from '../schemas';

// Mock WebSocket
const mockWebSocket = {
  OPEN: 1,
  CLOSED: 3,
  CONNECTING: 0,
  CLOSING: 2,
  readyState: 1,
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
  onopen: null as (() => void) | null,
  onerror: null as ((error: Event) => void) | null,
  onclose: null as (() => void) | null,
  onmessage: null as ((event: MessageEvent) => void) | null
};

// Mock WebSocket constructor
const MockWebSocket = jest.fn().mockImplementation(() => mockWebSocket) as unknown as typeof WebSocket;
Object.assign(MockWebSocket, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
});

jest.mock('../../errorHandler', () => ({
  errorHandler: {
    handleError: jest.fn()
  }
}));

jest.mock('../../retryMechanism', () => ({
  retryMechanism: {
    withRetry: jest.fn()
  }
}));

jest.mock('../../logger');

describe('RelayPool', () => {
  let relayPool: RelayPool;
  const mockRelayConfig: RelayConfig = {
    url: 'wss://test.relay',
    read: true,
    write: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    relayPool = RelayPool.getInstance();
    global.WebSocket = MockWebSocket;
  });

  describe('Connection Management', () => {
    it('should connect to relays', async () => {
      const mockRelays: RelayConfig[] = [mockRelayConfig];
      await relayPool.connect(mockRelays);

      expect(MockWebSocket).toHaveBeenCalledWith(mockRelayConfig.url);
      expect(mockWebSocket.addEventListener).toHaveBeenCalled();
    });

    it('should disconnect from relays', () => {
      relayPool['connections'].set(mockRelayConfig.url, mockWebSocket as unknown as WebSocket);

      relayPool.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const mockRelays: RelayConfig[] = [mockRelayConfig];
      const mockError = new Event('error');

      const connectPromise = relayPool.connect(mockRelays);
      mockWebSocket.onerror?.(mockError);

      await expect(connectPromise).rejects.toThrow();
    });
  });

  describe('Event Publishing', () => {
    it('should publish events', async () => {
      relayPool['connections'].set(mockRelayConfig.url, mockWebSocket as unknown as WebSocket);

      const mockEvent: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: Date.now(),
        kind: 1,
        tags: [],
        content: 'test content',
        sig: 'test-sig'
      };

      await relayPool.publish(mockEvent);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(['EVENT', mockEvent])
      );
    });

    it('should handle publish errors', async () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Send failed');
      });
      relayPool['connections'].set(mockRelayConfig.url, mockWebSocket as unknown as WebSocket);

      const mockEvent: NostrEvent = {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: Date.now(),
        kind: 1,
        tags: [],
        content: 'test content',
        sig: 'test-sig'
      };

      await expect(relayPool.publish(mockEvent)).rejects.toThrow();
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to filters', async () => {
      relayPool['connections'].set(mockRelayConfig.url, mockWebSocket as unknown as WebSocket);

      const mockFilters = [{ kinds: [1] }];
      await relayPool.subscribe(mockFilters);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(['REQ', 'sub', ...mockFilters])
      );
    });

    it('should handle subscription errors', async () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Subscribe failed');
      });
      relayPool['connections'].set(mockRelayConfig.url, mockWebSocket as unknown as WebSocket);

      const mockFilters = [{ kinds: [1] }];
      await expect(relayPool.subscribe(mockFilters)).rejects.toThrow();
    });
  });

  describe('Status Management', () => {
    it('should get relay status', () => {
      const mockStatus: RelayStatus = {
        url: mockRelayConfig.url,
        connected: true,
        lastConnected: Date.now(),
        latency: 100
      };
      relayPool['status'].set(mockRelayConfig.url, mockStatus);

      const status = relayPool.getStatus();
      expect(status).toEqual([mockStatus]);
    });

    it('should handle disconnected relays', () => {
      const mockStatus: RelayStatus = {
        url: mockRelayConfig.url,
        connected: false,
        lastError: 'Connection failed'
      };
      relayPool['status'].set(mockRelayConfig.url, mockStatus);

      const status = relayPool.getStatus();
      expect(status).toEqual([mockStatus]);
    });
  });

  describe('Configuration', () => {
    it('should respect max relays limit', async () => {
      const mockConfig: Partial<RelayPoolConfig> = {
        maxRelays: 2
      };
      relayPool = RelayPool.getInstance(mockConfig);

      const mockRelays: RelayConfig[] = [
        { ...mockRelayConfig, url: 'wss://relay1' },
        { ...mockRelayConfig, url: 'wss://relay2' },
        { ...mockRelayConfig, url: 'wss://relay3' }
      ];

      await relayPool.connect(mockRelays);

      expect(MockWebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('reconnection monitoring', () => {
    it('should attempt to reconnect on disconnection', async () => {
      jest.useFakeTimers();

      const mockRelays: RelayConfig[] = [{
        url: 'wss://relay.example.com',
        read: true,
        write: true
      }];
      await relayPool.connect(mockRelays);

      const closeCall = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      );
      if (!closeCall) {
        throw new Error('Close event listener not found');
      }
      const closeHandler = closeCall[1] as () => void;
      closeHandler();

      jest.advanceTimersByTime(5000);
      expect(mockWebSocket.addEventListener).toHaveBeenCalledTimes(8); // 4 for initial connection + 4 for reconnection

      jest.useRealTimers();
    });

    it('should stop reconnection attempts after max retries', async () => {
      jest.useFakeTimers();

      const mockRelays: RelayConfig[] = [{
        url: 'wss://relay.example.com',
        read: true,
        write: true
      }];
      await relayPool.connect(mockRelays);

      const closeCall = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      );
      if (!closeCall) {
        throw new Error('Close event listener not found');
      }
      const closeHandler = closeCall[1] as () => void;

      for (let i = 0; i < 5; i++) {
        closeHandler();
        jest.advanceTimersByTime(5000);
      }

      expect(mockWebSocket.addEventListener).toHaveBeenCalledTimes(20); // 4 for initial connection + (4 * 4) for reconnection attempts

      jest.useRealTimers();
    });
  });
}); 