import { errorHandler } from './errorHandler';
import { logger } from './logger';

export interface MockConfig {
  delay?: number;
  shouldFail?: boolean;
  error?: Error;
  data?: any;
}

export class TestUtils {
  private static instance: TestUtils;
  private mocks: Map<string, MockConfig>;

  private constructor() {
    this.mocks = new Map();
  }

  public static getInstance(): TestUtils {
    if (!TestUtils.instance) {
      TestUtils.instance = new TestUtils();
    }
    return TestUtils.instance;
  }

  public mockFunction(name: string, config: MockConfig = {}): void {
    try {
      this.mocks.set(name, {
        delay: 0,
        shouldFail: false,
        ...config
      });
      logger.debug(`Mocked function: ${name}`, { config });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'mockFunction',
        timestamp: Date.now(),
        additionalInfo: { name, config }
      });
    }
  }

  public async executeMock(name: string, ...args: any[]): Promise<any> {
    try {
      const mock = this.mocks.get(name);
      if (!mock) {
        throw new Error(`No mock found for function: ${name}`);
      }

      if (mock.delay) {
        await new Promise(resolve => setTimeout(resolve, mock.delay));
      }

      if (mock.shouldFail) {
        throw mock.error || new Error(`Mocked error for function: ${name}`);
      }

      return mock.data;
    } catch (error) {
      const executionError = errorHandler.handleError(error, {
        operation: 'executeMock',
        timestamp: Date.now(),
        additionalInfo: { name, args }
      });
      logger.error('Failed to execute mock', executionError);
      throw executionError;
    }
  }

  public clearMocks(): void {
    try {
      this.mocks.clear();
      logger.debug('Cleared all mocks');
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'clearMocks',
        timestamp: Date.now()
      });
    }
  }

  public clearMock(name: string): void {
    try {
      this.mocks.delete(name);
      logger.debug(`Cleared mock for function: ${name}`);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'clearMock',
        timestamp: Date.now(),
        additionalInfo: { name }
      });
    }
  }

  public async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<boolean> {
    try {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (await condition()) {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      return false;
    } catch (error) {
      const waitError = errorHandler.handleError(error, {
        operation: 'waitForCondition',
        timestamp: Date.now(),
        additionalInfo: { timeout, interval }
      });
      logger.error('Failed to wait for condition', waitError);
      throw waitError;
    }
  }

  public async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error as Error;
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      throw lastError || new Error('Operation failed after all attempts');
    } catch (error) {
      const retryError = errorHandler.handleError(error, {
        operation: 'retryOperation',
        timestamp: Date.now(),
        additionalInfo: { maxAttempts, delay }
      });
      logger.error('Failed to retry operation', retryError);
      throw retryError;
    }
  }

  public createMockEvent(type: string, detail: any = {}): Event {
    try {
      return new CustomEvent(type, { detail });
    } catch (error) {
      const eventError = errorHandler.handleError(error, {
        operation: 'createMockEvent',
        timestamp: Date.now(),
        additionalInfo: { type, detail }
      });
      logger.error('Failed to create mock event', eventError);
      throw eventError;
    }
  }

  public mockLocalStorage(): void {
    try {
      const storage: Record<string, string> = {};
      const mockStorage = {
        getItem: (key: string): string | null => storage[key] || null,
        setItem: (key: string, value: string): void => {
          storage[key] = value;
        },
        removeItem: (key: string): void => {
          delete storage[key];
        },
        clear: (): void => {
          Object.keys(storage).forEach(key => delete storage[key]);
        },
        get length(): number {
          return Object.keys(storage).length;
        },
        key: (index: number): string | null => {
          const keys = Object.keys(storage);
          return keys[index] || null;
        }
      };

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true
      });

      logger.debug('Mocked localStorage');
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'mockLocalStorage',
        timestamp: Date.now()
      });
    }
  }

  public mockWebSocket(): void {
    try {
      class MockWebSocket {
        public readyState: number = WebSocket.CONNECTING;
        public url: string;
        private eventHandlers: Map<string, Set<Function>> = new Map();

        constructor(url: string) {
          this.url = url;
          setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            this.triggerEvent('open');
          }, 0);
        }

        public addEventListener(event: string, handler: Function): void {
          if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
          }
          this.eventHandlers.get(event)?.add(handler);
        }

        public removeEventListener(event: string, handler: Function): void {
          this.eventHandlers.get(event)?.delete(handler);
        }

        public send(data: string): void {
          this.triggerEvent('message', { data });
        }

        public close(): void {
          this.readyState = WebSocket.CLOSED;
          this.triggerEvent('close');
        }

        private triggerEvent(event: string, data?: any): void {
          this.eventHandlers.get(event)?.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              errorHandler.handleError(error, {
                operation: 'mockWebSocketTriggerEvent',
                timestamp: Date.now(),
                additionalInfo: { event, data }
              });
            }
          });
        }
      }

      Object.defineProperty(window, 'WebSocket', {
        value: MockWebSocket,
        writable: true
      });

      logger.debug('Mocked WebSocket');
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'mockWebSocket',
        timestamp: Date.now()
      });
    }
  }
}

export const testUtils = TestUtils.getInstance(); 