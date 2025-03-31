import { DAOCache } from '../daoCache';
import { errorHandler } from '../../errorHandler';
import { logger } from '../../logger';

jest.mock('../../errorHandler');
jest.mock('../../logger');

describe('DAOCache', () => {
  let daoCache: DAOCache;
  let mockData: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockData = {
      id: '0x123',
      name: 'Test DAO',
      description: 'Test Description',
      address: '0x456',
      chainId: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    daoCache = DAOCache.getInstance();
  });

  describe('get', () => {
    it('should retrieve cached data successfully', async () => {
      await daoCache.set('0x123', mockData);
      const retrieved = await daoCache.get('0x123');

      expect(retrieved).toEqual(mockData);
    });

    it('should return null for non-existent key', async () => {
      const retrieved = await daoCache.get('0x123');
      expect(retrieved).toBeNull();
    });

    it('should handle retrieval errors', async () => {
      jest.spyOn(daoCache as any, 'getEntry').mockImplementation(() => {
        throw new Error('Retrieval failed');
      });

      await expect(daoCache.get('0x123')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should set data in cache successfully', async () => {
      await daoCache.set('0x123', mockData);
      const retrieved = await daoCache.get('0x123');

      expect(retrieved).toEqual(mockData);
    });

    it('should handle setting errors', async () => {
      jest.spyOn(daoCache as any, 'setEntry').mockImplementation(() => {
        throw new Error('Setting failed');
      });

      await expect(daoCache.set('0x123', mockData)).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should evict oldest entry when cache is full', async () => {
      const config = { maxSize: 2 };
      daoCache = DAOCache.getInstance(config);

      await daoCache.set('0x123', mockData);
      await daoCache.set('0x456', { ...mockData, id: '0x456' });
      await daoCache.set('0x789', { ...mockData, id: '0x789' });

      const retrieved = await daoCache.get('0x123');
      expect(retrieved).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete cached data successfully', async () => {
      await daoCache.set('0x123', mockData);
      await daoCache.delete('0x123');

      const retrieved = await daoCache.get('0x123');
      expect(retrieved).toBeNull();
    });

    it('should handle deletion errors', async () => {
      jest.spyOn(daoCache as any, 'deleteEntry').mockImplementation(() => {
        throw new Error('Deletion failed');
      });

      await expect(daoCache.delete('0x123')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all cached data successfully', async () => {
      await daoCache.set('0x123', mockData);
      await daoCache.set('0x456', { ...mockData, id: '0x456' });

      await daoCache.clear();

      const retrieved1 = await daoCache.get('0x123');
      const retrieved2 = await daoCache.get('0x456');

      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    });

    it('should handle clearing errors', async () => {
      jest.spyOn(daoCache as any, 'clearEntries').mockImplementation(() => {
        throw new Error('Clearing failed');
      });

      await expect(daoCache.clear()).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('has', () => {
    it('should check if key exists in cache', async () => {
      await daoCache.set('0x123', mockData);

      const exists = await daoCache.has('0x123');
      const notExists = await daoCache.has('0x456');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it('should handle checking errors', async () => {
      jest.spyOn(daoCache as any, 'hasEntry').mockImplementation(() => {
        throw new Error('Checking failed');
      });

      await expect(daoCache.has('0x123')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('getSize', () => {
    it('should return correct cache size', async () => {
      await daoCache.set('0x123', mockData);
      await daoCache.set('0x456', { ...mockData, id: '0x456' });

      const size = daoCache.getSize();
      expect(size).toBe(2);
    });
  });

  describe('isExpired', () => {
    it('should check if entry is expired', () => {
      const entry = {
        data: mockData,
        timestamp: Date.now() - 3600000 // 1 hour ago
      };

      const isExpired = daoCache['isExpired'](entry);
      expect(isExpired).toBe(true);
    });

    it('should return false for non-expired entry', () => {
      const entry = {
        data: mockData,
        timestamp: Date.now()
      };

      const isExpired = daoCache['isExpired'](entry);
      expect(isExpired).toBe(false);
    });
  });

  describe('evictOldest', () => {
    it('should evict oldest entry', async () => {
      const config = { maxSize: 2 };
      daoCache = DAOCache.getInstance(config);

      await daoCache.set('0x123', { ...mockData, timestamp: Date.now() - 3600000 });
      await daoCache.set('0x456', { ...mockData, id: '0x456', timestamp: Date.now() });
      await daoCache.set('0x789', { ...mockData, id: '0x789', timestamp: Date.now() });

      const retrieved = await daoCache.get('0x123');
      expect(retrieved).toBeNull();
    });
  });
}); 