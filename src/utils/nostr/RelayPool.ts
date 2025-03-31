import { errorHandler } from '../errorHandler';
import { retryMechanism } from '../retryMechanism';
import { NostrEvent, RelayConfig } from './NostrEventHandler';

export interface RelayPoolConfig {
  maxRelays: number;
  connectionTimeout: number;
  reconnectInterval: number;
  maxRetries: number;
}

export interface RelayStatus {
  url: string;
  connected: boolean;
  lastConnected?: number;
  lastError?: string;
  latency?: number;
}

export class RelayPool {
  private static instance: RelayPool;
  private connections: Map<string, WebSocket>;
  private status: Map<string, RelayStatus>;
  private config: RelayPoolConfig;
  private reconnectTimer: number | null;

  private constructor(config: Partial<RelayPoolConfig> = {}) {
    this.connections = new Map();
    this.status = new Map();
    this.config = {
      maxRelays: config.maxRelays || 10,
      connectionTimeout: config.connectionTimeout || 5000,
      reconnectInterval: config.reconnectInterval || 5000,
      maxRetries: config.maxRetries || 3
    };
    this.reconnectTimer = null;
  }

  public static getInstance(config?: Partial<RelayPoolConfig>): RelayPool {
    if (!RelayPool.instance) {
      RelayPool.instance = new RelayPool(config);
    }
    return RelayPool.instance;
  }

  public async connect(relays: RelayConfig[]): Promise<void> {
    try {
      // Limit number of relays
      const limitedRelays = relays.slice(0, this.config.maxRelays);

      // Connect to each relay
      await Promise.all(
        limitedRelays.map(relay => this.connectToRelay(relay))
      );

      // Start reconnection monitoring
      this.startReconnectionMonitoring();
    } catch (error) {
      throw errorHandler.handleError(error, {
        operation: 'relayPoolConnect',
        timestamp: Date.now()
      });
    }
  }

  public disconnect(): void {
    try {
      // Clear reconnection timer
      if (this.reconnectTimer !== null) {
        window.clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Close all connections
      for (const [url, connection] of this.connections.entries()) {
        connection.close();
        this.connections.delete(url);
        this.status.delete(url);
      }
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'relayPoolDisconnect',
        timestamp: Date.now()
      });
    }
  }

  public async publish(event: NostrEvent): Promise<void> {
    return retryMechanism.withRetry(
      async () => {
        try {
          const message = JSON.stringify(['EVENT', event]);
          const promises: Promise<void>[] = [];

          for (const [url, connection] of this.connections.entries()) {
            if (connection.readyState === WebSocket.OPEN) {
              promises.push(
                new Promise((resolve, reject) => {
                  const timeout = setTimeout(() => {
                    reject(new Error(`Publish timeout for relay ${url}`));
                  }, this.config.connectionTimeout);

                  const messageHandler = (event: MessageEvent) => {
                    try {
                      const [type, subId, eventData] = JSON.parse(event.data);
                      if (type === 'OK' && eventData) {
                        connection.removeEventListener('message', messageHandler);
                        clearTimeout(timeout);
                        resolve();
                      }
                    } catch (error) {
                      connection.removeEventListener('message', messageHandler);
                      clearTimeout(timeout);
                      reject(error);
                    }
                  };

                  connection.addEventListener('message', messageHandler);
                  connection.send(message);
                })
              );
            }
          }

          await Promise.race(promises);
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'relayPoolPublish',
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
          for (const [url, connection] of this.connections.entries()) {
            if (connection.readyState === WebSocket.OPEN) {
              connection.send(message);
            }
          }
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'relayPoolSubscribe',
            timestamp: Date.now(),
            additionalInfo: { filters }
          });
        }
      }
    );
  }

  public getStatus(): RelayStatus[] {
    return Array.from(this.status.values());
  }

  private async connectToRelay(relay: RelayConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const connection = new WebSocket(relay.url);
        const startTime = Date.now();

        connection.onopen = () => {
          const latency = Date.now() - startTime;
          this.connections.set(relay.url, connection);
          this.status.set(relay.url, {
            url: relay.url,
            connected: true,
            lastConnected: Date.now(),
            latency
          });
          resolve();
        };

        connection.onerror = (error) => {
          this.handleConnectionError(relay.url, error);
          reject(error);
        };

        connection.onclose = () => {
          this.handleConnectionClose(relay.url);
        };

        connection.onmessage = (event) => {
          this.handleMessage(relay.url, event);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleConnectionError(url: string, error: Event): void {
    this.status.set(url, {
      url,
      connected: false,
      lastError: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  private handleConnectionClose(url: string): void {
    this.connections.delete(url);
    const status = this.status.get(url);
    if (status) {
      status.connected = false;
      status.lastError = 'Connection closed';
    }
  }

  private handleMessage(url: string, event: MessageEvent): void {
    try {
      const [type, subId, eventData] = JSON.parse(event.data);
      if (type === 'EVENT' && eventData) {
        // Emit event for handling by the event handler
        this.emit('event', eventData);
      }
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'relayPoolMessageHandler',
        timestamp: Date.now(),
        additionalInfo: { relayUrl: url }
      });
    }
  }

  private startReconnectionMonitoring(): void {
    if (this.reconnectTimer !== null) {
      window.clearInterval(this.reconnectTimer);
    }

    this.reconnectTimer = window.setInterval(() => {
      this.checkAndReconnect();
    }, this.config.reconnectInterval);
  }

  private async checkAndReconnect(): Promise<void> {
    try {
      for (const [url, status] of this.status.entries()) {
        if (!status.connected) {
          await this.reconnectToRelay(url);
        }
      }
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'relayPoolReconnect',
        timestamp: Date.now()
      });
    }
  }

  private async reconnectToRelay(url: string): Promise<void> {
    try {
      const status = this.status.get(url);
      if (!status) {
        return;
      }

      const connection = this.connections.get(url);
      if (connection) {
        connection.close();
        this.connections.delete(url);
      }

      await this.connectToRelay({
        url,
        read: true,
        write: true
      });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'relayPoolReconnectToRelay',
        timestamp: Date.now(),
        additionalInfo: { relayUrl: url }
      });
    }
  }

  private emit(event: string, data: any): void {
    // This would be implemented to emit events to listeners
    // For now, it's a placeholder
  }
}

export const relayPool = RelayPool.getInstance(); 