import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { errorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { ConceptMapping } from '../contracts/ConceptMapping';
import { ConceptValues } from '../contracts/ConceptValues';

export interface Metadata {
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  attributes: {
    type: string;
    network: string;
    token: string;
  };
  validation?: {
    required: string[];
    types: Record<string, string>;
  };
}

export interface MetadataVersion {
  id: string;
  metadataId: string;
  data: Metadata;
  createdAt: number;
  createdBy: string;
}

export interface MetadataWithId extends Metadata {
  id: string;
}

export class MetadataService extends EventEmitter {
  private static instance: MetadataService;
  private conceptMapping: ConceptMapping;
  private conceptValues: ConceptValues;
  private metadataStore: Map<string, MetadataWithId>;
  private versionStore: Map<string, MetadataVersion[]>;

  private constructor() {
    super();
    this.metadataStore = new Map();
    this.versionStore = new Map();
  }

  public static getInstance(): MetadataService {
    if (!MetadataService.instance) {
      MetadataService.instance = new MetadataService();
    }
    return MetadataService.instance;
  }

  public async initialize(conceptMappingAddress: string, conceptValuesAddress: string): Promise<void> {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      this.conceptMapping = new ethers.Contract(
        conceptMappingAddress,
        ConceptMapping.abi,
        provider
      ) as ConceptMapping;
      this.conceptValues = new ethers.Contract(
        conceptValuesAddress,
        ConceptValues.abi,
        provider
      ) as ConceptValues;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.initialize',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async createMetadata(metadata: Metadata): Promise<MetadataWithId> {
    try {
      if (!await this.validateMetadata(metadata)) {
        throw new Error('Invalid metadata');
      }

      const id = ethers.utils.id(JSON.stringify(metadata));
      const metadataWithId: MetadataWithId = {
        ...metadata,
        id,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.metadataStore.set(id, metadataWithId);
      this.emit('MetadataCreated', metadataWithId);

      return metadataWithId;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.createMetadata',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async getMetadata(id: string): Promise<MetadataWithId> {
    try {
      const metadata = this.metadataStore.get(id);
      if (!metadata) {
        throw new Error('Metadata not found');
      }
      return metadata;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.getMetadata',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async updateMetadata(id: string, metadata: Metadata): Promise<MetadataWithId> {
    try {
      if (!await this.validateMetadata(metadata)) {
        throw new Error('Invalid metadata');
      }

      const existingMetadata = this.metadataStore.get(id);
      if (!existingMetadata) {
        throw new Error('Metadata not found');
      }

      const updatedMetadata: MetadataWithId = {
        ...metadata,
        id,
        createdAt: existingMetadata.createdAt,
        updatedAt: Date.now()
      };

      this.metadataStore.set(id, updatedMetadata);
      this.emit('MetadataUpdated', updatedMetadata);

      return updatedMetadata;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.updateMetadata',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async deleteMetadata(id: string): Promise<void> {
    try {
      if (!this.metadataStore.has(id)) {
        throw new Error('Metadata not found');
      }

      this.metadataStore.delete(id);
      this.versionStore.delete(id);
      this.emit('MetadataDeleted', id);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.deleteMetadata',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async listMetadata(): Promise<MetadataWithId[]> {
    try {
      return Array.from(this.metadataStore.values());
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.listMetadata',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async searchMetadata(query: string): Promise<MetadataWithId[]> {
    try {
      const searchTerm = query.toLowerCase();
      return Array.from(this.metadataStore.values()).filter(metadata => 
        metadata.name.toLowerCase().includes(searchTerm) ||
        metadata.description.toLowerCase().includes(searchTerm) ||
        metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.searchMetadata',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async validateMetadata(metadata: Metadata): Promise<boolean> {
    try {
      if (!metadata.validation) {
        return true;
      }

      // Check required fields
      for (const field of metadata.validation.required) {
        if (!(field in metadata)) {
          return false;
        }
      }

      // Check field types
      for (const [field, type] of Object.entries(metadata.validation.types)) {
        const value = metadata[field as keyof Metadata];
        if (value === undefined) continue;

        switch (type) {
          case 'string':
            if (typeof value !== 'string') return false;
            break;
          case 'number':
            if (typeof value !== 'number') return false;
            break;
          case 'array':
            if (!Array.isArray(value)) return false;
            break;
          case 'object':
            if (typeof value !== 'object' || value === null) return false;
            break;
        }
      }

      return true;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.validateMetadata',
        timestamp: Date.now()
      });
      return false;
    }
  }

  public async createVersion(metadataId: string, data: Metadata): Promise<MetadataVersion> {
    try {
      if (!this.metadataStore.has(metadataId)) {
        throw new Error('Metadata not found');
      }

      const version: MetadataVersion = {
        id: ethers.utils.id(JSON.stringify({ metadataId, data, timestamp: Date.now() })),
        metadataId,
        data,
        createdAt: Date.now(),
        createdBy: await this.getCurrentUser()
      };

      const versions = this.versionStore.get(metadataId) || [];
      versions.push(version);
      this.versionStore.set(metadataId, versions);

      return version;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.createVersion',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async getVersionHistory(metadataId: string): Promise<MetadataVersion[]> {
    try {
      return this.versionStore.get(metadataId) || [];
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.getVersionHistory',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public async getVersion(versionId: string): Promise<MetadataVersion> {
    try {
      for (const versions of this.versionStore.values()) {
        const version = versions.find(v => v.id === versionId);
        if (version) return version;
      }
      throw new Error('Version not found');
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.getVersion',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  private async getCurrentUser(): Promise<string> {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      return await signer.getAddress();
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'MetadataService.getCurrentUser',
        timestamp: Date.now()
      });
      throw error;
    }
  }
} 