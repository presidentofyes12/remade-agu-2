import { errorHandler } from '../errorHandler';
import { DAOData } from '../storage/DAOStorage';

export interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class DAOCache {
  private static instance: DAOCache;
  private cache: Map<string, CacheEntry<DAOData>>;
  private readonly maxSize: number;
  private readonly ttl: number;

  private constructor(config: CacheConfig = { maxSize: 100, ttl: 5 * 60 * 1000 }) {
    this.cache = new Map();
    this.maxSize = config.maxSize;
    this.ttl = config.ttl;
  }

  public static getInstance(config?: CacheConfig): DAOCache {
    if (!DAOCache.instance) {
      DAOCache.instance = new DAOCache(config);
    }
    return DAOCache.instance;
  }

  public get(id: string): DAOData | null {
    try {
      const entry = this.cache.get(id);
      if (!entry) {
        return null;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(id);
        return null;
      }

      return entry.data;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'cacheGet',
        timestamp: Date.now(),
        additionalInfo: { daoId: id }
      });
      return null;
    }
  }

  public set(id: string, data: DAOData): void {
    try {
      if (this.cache.size >= this.maxSize) {
        this.evictOldest();
      }

      this.cache.set(id, {
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'cacheSet',
        timestamp: Date.now(),
        additionalInfo: { daoId: id }
      });
    }
  }

  public delete(id: string): void {
    try {
      this.cache.delete(id);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'cacheDelete',
        timestamp: Date.now(),
        additionalInfo: { daoId: id }
      });
    }
  }

  public clear(): void {
    try {
      this.cache.clear();
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'cacheClear',
        timestamp: Date.now()
      });
    }
  }

  public has(id: string): boolean {
    try {
      const entry = this.cache.get(id);
      if (!entry) {
        return false;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(id);
        return false;
      }

      return true;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'cacheHas',
        timestamp: Date.now(),
        additionalInfo: { daoId: id }
      });
      return false;
    }
  }

  public getSize(): number {
    return this.cache.size;
  }

  private isExpired(entry: CacheEntry<DAOData>): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

export const daoCache = DAOCache.getInstance(); 