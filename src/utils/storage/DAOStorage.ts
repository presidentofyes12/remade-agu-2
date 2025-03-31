import { errorHandler } from '../errorHandler';
import { retryMechanism } from '../retryMechanism';

export interface DAOData {
  id: string;
  name: string;
  description: string;
  address: string;
  chainId: number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface StorageConfig {
  prefix?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export class DAOStorage {
  private static instance: DAOStorage;
  private readonly prefix: string;
  private readonly storage: Storage;

  private constructor(config: StorageConfig = {}) {
    this.prefix = config.prefix || 'dao_';
    this.storage = window.localStorage;
  }

  public static getInstance(config: StorageConfig = {}): DAOStorage {
    if (!DAOStorage.instance) {
      DAOStorage.instance = new DAOStorage(config);
    }
    return DAOStorage.instance;
  }

  public async saveDAO(data: DAOData): Promise<void> {
    return retryMechanism.withRetry(
      async () => {
        try {
          const key = this.getKey(data.id);
          const serialized = JSON.stringify(data);
          this.storage.setItem(key, serialized);
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'saveDAO',
            timestamp: Date.now(),
            additionalInfo: { daoId: data.id }
          });
        }
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        shouldRetry: (error) => error instanceof Error && error.message.includes('QuotaExceededError')
      }
    );
  }

  public async getDAO(id: string): Promise<DAOData | null> {
    return retryMechanism.withRetry(
      async () => {
        try {
          const key = this.getKey(id);
          const serialized = this.storage.getItem(key);
          if (!serialized) {
            return null;
          }
          return JSON.parse(serialized);
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'getDAO',
            timestamp: Date.now(),
            additionalInfo: { daoId: id }
          });
        }
      }
    );
  }

  public async getAllDAOs(): Promise<DAOData[]> {
    return retryMechanism.withRetry(
      async () => {
        try {
          const daos: DAOData[] = [];
          for (let i = 0; i < this.storage.length; i++) {
            const key = this.storage.key(i);
            if (key?.startsWith(this.prefix)) {
              const serialized = this.storage.getItem(key);
              if (serialized) {
                daos.push(JSON.parse(serialized));
              }
            }
          }
          return daos;
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'getAllDAOs',
            timestamp: Date.now()
          });
        }
      }
    );
  }

  public async deleteDAO(id: string): Promise<void> {
    return retryMechanism.withRetry(
      async () => {
        try {
          const key = this.getKey(id);
          this.storage.removeItem(key);
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'deleteDAO',
            timestamp: Date.now(),
            additionalInfo: { daoId: id }
          });
        }
      }
    );
  }

  public async updateDAO(id: string, updates: Partial<DAOData>): Promise<void> {
    return retryMechanism.withRetry(
      async () => {
        try {
          const existing = await this.getDAO(id);
          if (!existing) {
            throw new Error(`DAO with ID ${id} not found`);
          }

          const updated = {
            ...existing,
            ...updates,
            updatedAt: Date.now()
          };

          await this.saveDAO(updated);
        } catch (error) {
          throw errorHandler.handleError(error, {
            operation: 'updateDAO',
            timestamp: Date.now(),
            additionalInfo: { daoId: id, updates }
          });
        }
      }
    );
  }

  private getKey(id: string): string {
    return `${this.prefix}${id}`;
  }
}

export const daoStorage = DAOStorage.getInstance(); 