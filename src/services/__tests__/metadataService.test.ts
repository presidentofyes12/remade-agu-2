import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MetadataService } from '../metadataService';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../utils/errorHandler');
jest.mock('../../utils/logger');

// Test utilities
class MetadataTestFactory {
  static createMockMetadata() {
    return {
      name: 'Test DAO',
      description: 'A test DAO for testing purposes',
      version: '1.0.0',
      author: 'Test Author',
      tags: ['test', 'dao'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attributes: {
        type: 'governance',
        network: 'ethereum',
        token: 'TEST'
      }
    };
  }

  static createMockMetadataWithValidation() {
    return {
      ...this.createMockMetadata(),
      validation: {
        required: ['name', 'description', 'version'],
        types: {
          name: 'string',
          description: 'string',
          version: 'string',
          author: 'string',
          tags: 'array',
          createdAt: 'number',
          updatedAt: 'number',
          attributes: 'object'
        }
      }
    };
  }
}

describe('MetadataService', () => {
  let metadataService: MetadataService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize service
    metadataService = MetadataService.getInstance();
  });

  describe('Initialization', () => {
    it('should maintain singleton instance', () => {
      const instance1 = MetadataService.getInstance();
      const instance2 = MetadataService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Metadata Operations', () => {
    const metadata = MetadataTestFactory.createMockMetadata();
    const metadataId = 'test-metadata-id';

    it('should create metadata successfully', async () => {
      const result = await metadataService.createMetadata(metadata);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.data).toEqual(metadata);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should get metadata by id successfully', async () => {
      const result = await metadataService.getMetadata(metadataId);

      expect(result).toBeDefined();
      expect(result.id).toBe(metadataId);
      expect(result.data).toBeDefined();
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should update metadata successfully', async () => {
      const updatedMetadata = {
        ...metadata,
        description: 'Updated description'
      };

      const result = await metadataService.updateMetadata(
        metadataId,
        updatedMetadata
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(metadataId);
      expect(result.data).toEqual(updatedMetadata);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should delete metadata successfully', async () => {
      await metadataService.deleteMetadata(metadataId);

      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should list metadata successfully', async () => {
      const result = await metadataService.listMetadata();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should search metadata successfully', async () => {
      const query = 'test';
      const result = await metadataService.searchMetadata(query);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    const metadata = MetadataTestFactory.createMockMetadataWithValidation();

    it('should validate metadata successfully', async () => {
      const result = await metadataService.validateMetadata(metadata);

      expect(result).toBe(true);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should reject invalid metadata', async () => {
      const invalidMetadata = {
        ...metadata,
        name: undefined
      };

      const result = await metadataService.validateMetadata(invalidMetadata);

      expect(result).toBe(false);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should validate metadata type', async () => {
      const invalidTypeMetadata = {
        ...metadata,
        version: 1.0 // Should be string
      };

      const result = await metadataService.validateMetadata(invalidTypeMetadata);

      expect(result).toBe(false);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });
  });

  describe('Version Control', () => {
    const metadata = MetadataTestFactory.createMockMetadata();
    const metadataId = 'test-metadata-id';

    it('should create version successfully', async () => {
      const version = await metadataService.createVersion(
        metadataId,
        metadata
      );

      expect(version).toBeDefined();
      expect(version.id).toBeDefined();
      expect(version.metadataId).toBe(metadataId);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should get version history successfully', async () => {
      const history = await metadataService.getVersionHistory(metadataId);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should get specific version successfully', async () => {
      const versionId = 'test-version-id';
      const version = await metadataService.getVersion(versionId);

      expect(version).toBeDefined();
      expect(version.id).toBe(versionId);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle metadata creation errors', async () => {
      const invalidMetadata = {
        name: undefined // Missing required field
      };

      await expect(metadataService.createMetadata(invalidMetadata))
        .rejects
        .toThrow('Invalid metadata');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle metadata retrieval errors', async () => {
      const nonExistentId = 'non-existent-id';

      await expect(metadataService.getMetadata(nonExistentId))
        .rejects
        .toThrow('Metadata not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle metadata update errors', async () => {
      const nonExistentId = 'non-existent-id';
      const metadata = MetadataTestFactory.createMockMetadata();

      await expect(metadataService.updateMetadata(nonExistentId, metadata))
        .rejects
        .toThrow('Metadata not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle metadata deletion errors', async () => {
      const nonExistentId = 'non-existent-id';

      await expect(metadataService.deleteMetadata(nonExistentId))
        .rejects
        .toThrow('Metadata not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle version creation errors', async () => {
      const nonExistentId = 'non-existent-id';
      const metadata = MetadataTestFactory.createMockMetadata();

      await expect(metadataService.createVersion(nonExistentId, metadata))
        .rejects
        .toThrow('Metadata not found');

      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should emit metadata created event', async () => {
      const listener = jest.fn();
      metadataService.on('MetadataCreated', listener);

      const metadata = MetadataTestFactory.createMockMetadata();
      await metadataService.createMetadata(metadata);

      expect(listener).toHaveBeenCalled();
    });

    it('should emit metadata updated event', async () => {
      const listener = jest.fn();
      metadataService.on('MetadataUpdated', listener);

      const metadata = MetadataTestFactory.createMockMetadata();
      const metadataId = 'test-metadata-id';
      await metadataService.updateMetadata(metadataId, metadata);

      expect(listener).toHaveBeenCalled();
    });

    it('should emit metadata deleted event', async () => {
      const listener = jest.fn();
      metadataService.on('MetadataDeleted', listener);

      const metadataId = 'test-metadata-id';
      await metadataService.deleteMetadata(metadataId);

      expect(listener).toHaveBeenCalled();
    });

    it('should remove event listeners', async () => {
      const listener = jest.fn();
      metadataService.on('MetadataCreated', listener);

      const metadata = MetadataTestFactory.createMockMetadata();
      await metadataService.createMetadata(metadata);

      expect(listener).toHaveBeenCalled();

      metadataService.off('MetadataCreated', listener);
      await metadataService.createMetadata(metadata);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
}); 