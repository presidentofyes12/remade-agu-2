import { errorHandler } from '../errorHandler';
import { retryMechanism } from '../retryMechanism';
import { EVENT_KINDS } from './schemas';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface RelayConfig {
  url: string;
  read: boolean;
  write: boolean;
}

export interface EventHandlerConfig {
  maxRetries?: number;
  retryDelay?: number;
  relays?: RelayConfig[];
}

export class NostrEventHandler {
  private static instance: NostrEventHandler;
  private eventHandlers: Map<number, Set<(event: NostrEvent) => void>>;
  private relayConnections: Map<string, WebSocket>;
  private config: EventHandlerConfig;

  private constructor(config: EventHandlerConfig = {}) {
    this.eventHandlers = new Map();
    this.relayConnections = new Map();
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      relays: config.relays || []
    };
  }

  public static getInstance(config?: EventHandlerConfig): NostrEventHandler {
    if (!NostrEventHandler.instance) {
      NostrEventHandler.instance = new NostrEventHandler(config);
    }
    return NostrEventHandler.instance;
  }

  public async connect(): Promise<void> {
    return retryMechanism.withRetry(
      async () => {
        try {
          for (const relay of this.config.relays || []) {
            if (!this.relayConnections.has(relay.url)) {
              await this.connectToRelay(relay);
            }
          }
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'nostrConnect',
            timestamp: Date.now()
          });
        }
      }
    );
  }

  public disconnect(): void {
    try {
      for (const [url, connection] of this.relayConnections.entries()) {
        connection.close();
        this.relayConnections.delete(url);
      }
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'nostrDisconnect',
        timestamp: Date.now()
      });
    }
  }

  public on(kind: number, handler: (event: NostrEvent) => void): void {
    try {
      if (!this.eventHandlers.has(kind)) {
        this.eventHandlers.set(kind, new Set());
      }
      this.eventHandlers.get(kind)?.add(handler);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'nostrOn',
        timestamp: Date.now(),
        additionalInfo: { kind }
      });
    }
  }

  public off(kind: number, handler: (event: NostrEvent) => void): void {
    try {
      this.eventHandlers.get(kind)?.delete(handler);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'nostrOff',
        timestamp: Date.now(),
        additionalInfo: { kind }
      });
    }
  }

  public async publish(event: NostrEvent): Promise<void> {
    return retryMechanism.withRetry(
      async () => {
        try {
          const message = JSON.stringify(['EVENT', event]);
          for (const [url, connection] of this.relayConnections.entries()) {
            if (connection.readyState === WebSocket.OPEN) {
              connection.send(message);
            }
          }
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'nostrPublish',
            timestamp: Date.now(),
            additionalInfo: { eventId: event.id }
          });
        }
      }
    );
  }

  public async subscribe(filters: any[]): Promise<void> {
    return retryMechanism.withRetry(
      async () => {
        try {
          const message = JSON.stringify(['REQ', 'sub', ...filters]);
          for (const [url, connection] of this.relayConnections.entries()) {
            if (connection.readyState === WebSocket.OPEN) {
              connection.send(message);
            }
          }
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'nostrSubscribe',
            timestamp: Date.now(),
            additionalInfo: { filters }
          });
        }
      }
    );
  }

  private async connectToRelay(relay: RelayConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const connection = new WebSocket(relay.url);

        connection.onopen = () => {
          this.relayConnections.set(relay.url, connection);
          resolve();
        };

        connection.onerror = (error) => {
          this.relayConnections.delete(relay.url);
          reject(error);
        };

        connection.onmessage = (event) => {
          try {
            const [type, subId, eventData] = JSON.parse(event.data);
            if (type === 'EVENT' && eventData) {
              this.handleEvent(eventData);
            }
          } catch (error) {
            errorHandler.handleError(error, {
              operation: 'nostrMessageHandler',
              timestamp: Date.now(),
              additionalInfo: { relayUrl: relay.url }
            });
          }
        };

        connection.onclose = () => {
          this.relayConnections.delete(relay.url);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleEvent(event: NostrEvent): void {
    try {
      const handlers = this.eventHandlers.get(event.kind);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            errorHandler.handleError(error, {
              operation: 'nostrEventHandler',
              timestamp: Date.now(),
              additionalInfo: { eventId: event.id, kind: event.kind }
            });
          }
        });
      }
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'nostrHandleEvent',
        timestamp: Date.now(),
        additionalInfo: { eventId: event.id }
      });
    }
  }
}

export const nostrHandler = NostrEventHandler.getInstance(); 