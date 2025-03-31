import { ethers } from 'ethers';
import { ConceptMappingContract } from '../types/contracts';
import { executeWithRetryAndHandle } from '../utils/retryHelper';

export interface ConceptMapping {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  children: string[];
  metadata: Record<string, any>;
}

export class ConceptMappingService {
  private static instance: ConceptMappingService;
  private contract: ConceptMappingContract;

  private constructor(
    contractAddress: string,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.contract = {
      address: contractAddress,
      provider,
      signer,
      getConcept: jest.fn(),
      addConcept: jest.fn(),
      updateConcept: jest.fn(),
      linkConcepts: jest.fn()
    } as unknown as ConceptMappingContract;
  }

  public static getInstance(
    contractAddress: string,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ): ConceptMappingService {
    if (!ConceptMappingService.instance) {
      ConceptMappingService.instance = new ConceptMappingService(
        contractAddress,
        provider,
        signer
      );
    }
    return ConceptMappingService.instance;
  }

  public async getConcept(id: string): Promise<ConceptMapping> {
    return executeWithRetryAndHandle(async () => {
      const concept = await this.contract.getConcept(id);
      return this.formatConcept(concept);
    });
  }

  public async addConcept(
    name: string,
    description: string,
    parentId?: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    return executeWithRetryAndHandle(async () => {
      const tx = await this.contract.addConcept(name, description, parentId || ethers.ZeroAddress, metadata);
      const receipt = await tx.wait();
      if (!receipt || !receipt.logs[0] || !receipt.logs[0].topics[1]) {
        throw new Error('Failed to get concept ID from transaction receipt');
      }
      return receipt.logs[0].topics[1]; // Concept ID from event
    });
  }

  public async updateConcept(
    id: string,
    name: string,
    description: string,
    metadata: Record<string, any>
  ): Promise<void> {
    return executeWithRetryAndHandle(async () => {
      const tx = await this.contract.updateConcept(id, name, description, metadata);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Failed to get transaction receipt');
      }
    });
  }

  public async linkConcepts(parentId: string, childId: string): Promise<void> {
    return executeWithRetryAndHandle(async () => {
      const tx = await this.contract.linkConcepts(parentId, childId);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Failed to get transaction receipt');
      }
    });
  }

  private formatConcept(rawConcept: any): ConceptMapping {
    return {
      id: rawConcept.id,
      name: rawConcept.name,
      description: rawConcept.description,
      parentId: rawConcept.parentId === ethers.ZeroAddress ? undefined : rawConcept.parentId,
      children: rawConcept.children,
      metadata: rawConcept.metadata
    };
  }
} 