import { DAOStorage } from '../DAOStorage';
import { errorHandler } from '../../errorHandler';
import { logger } from '../../logger';
import { retryMechanism } from '../../retryMechanism';

jest.mock('../../errorHandler');
jest.mock('../../logger');
jest.mock('../../retryMechanism');

describe('DAOStorage', () => {
  let daoStorage: DAOStorage;
  let mockLocalStorage: { [key: string]: string };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage = {};
    global.localStorage = {
      getItem: jest.fn((key) => mockLocalStorage[key]),
      setItem: jest.fn((key, value) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: jest.fn((key) => {
        delete mockLocalStorage[key];
      }),
      clear: jest.fn(() => {
        mockLocalStorage = {};
      }),
      length: 0,
      key: jest.fn()
    } as any;

    daoStorage = DAOStorage.getInstance();
  });

  describe('saveDAO', () => {
    it('should save DAO data successfully', async () => {
      const daoData = {
        id: '0x123',
        name: 'Test DAO',
        description: 'Test Description',
        address: '0x456',
        chainId: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { test: 'data' }
      };

      await daoStorage.saveDAO(daoData);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('dao_0x123'),
        expect.any(String)
      );
      expect(retryMechanism.withRetry).toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      const daoData = {
        id: '0x123',
        name: 'Test DAO',
        description: 'Test Description',
        address: '0x456',
        chainId: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      jest.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage failed');
      });

      await expect(daoStorage.saveDAO(daoData)).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('getDAO', () => {
    it('should retrieve DAO data successfully', async () => {
      const daoData = {
        id: '0x123',
        name: 'Test DAO',
        description: 'Test Description',
        address: '0x456',
        chainId: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await daoStorage.saveDAO(daoData);
      const retrieved = await daoStorage.getDAO('0x123');

      expect(retrieved).toEqual(daoData);
      expect(retryMechanism.withRetry).toHaveBeenCalled();
    });

    it('should return null for non-existent DAO', async () => {
      const retrieved = await daoStorage.getDAO('0x123');
      expect(retrieved).toBeNull();
    });

    it('should handle retrieval errors', async () => {
      jest.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('Retrieval failed');
      });

      await expect(daoStorage.getDAO('0x123')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('getAllDAOs', () => {
    it('should retrieve all DAOs successfully', async () => {
      const daoData1 = {
        id: '0x123',
        name: 'Test DAO 1',
        description: 'Test Description 1',
        address: '0x456',
        chainId: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const daoData2 = {
        id: '0x789',
        name: 'Test DAO 2',
        description: 'Test Description 2',
        address: '0xabc',
        chainId: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await daoStorage.saveDAO(daoData1);
      await daoStorage.saveDAO(daoData2);

      const retrieved = await daoStorage.getAllDAOs();

      expect(retrieved).toHaveLength(2);
      expect(retrieved).toContainEqual(daoData1);
      expect(retrieved).toContainEqual(daoData2);
      expect(retryMechanism.withRetry).toHaveBeenCalled();
    });

    it('should handle retrieval errors', async () => {
      jest.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('Retrieval failed');
      });

      await expect(daoStorage.getAllDAOs()).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('deleteDAO', () => {
    it('should delete DAO successfully', async () => {
      const daoData = {
        id: '0x123',
        name: 'Test DAO',
        description: 'Test Description',
        address: '0x456',
        chainId: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await daoStorage.saveDAO(daoData);
      await daoStorage.deleteDAO('0x123');

      const retrieved = await daoStorage.getDAO('0x123');
      expect(retrieved).toBeNull();
      expect(retryMechanism.withRetry).toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      jest.spyOn(localStorage, 'removeItem').mockImplementation(() => {
        throw new Error('Deletion failed');
      });

      await expect(daoStorage.deleteDAO('0x123')).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('updateDAO', () => {
    it('should update DAO successfully', async () => {
      const daoData = {
        id: '0x123',
        name: 'Test DAO',
        description: 'Test Description',
        address: '0x456',
        chainId: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await daoStorage.saveDAO(daoData);

      const updatedData = {
        ...daoData,
        name: 'Updated DAO',
        updatedAt: Date.now()
      };

      await daoStorage.updateDAO(updatedData);

      const retrieved = await daoStorage.getDAO('0x123');
      expect(retrieved.name).toBe('Updated DAO');
      expect(retryMechanism.withRetry).toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      jest.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Update failed');
      });

      const daoData = {
        id: '0x123',
        name: 'Test DAO',
        description: 'Test Description',
        address: '0x456',
        chainId: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await expect(daoStorage.updateDAO(daoData)).rejects.toThrow();
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });
}); 