import { ethers } from 'ethers';
import { ContentMetadata } from './ContentFingerprintService';

export interface PublicationRelationship {
  type: 'author' | 'citation' | 'domain';
  targetHash: string;
  metadata: {
    timestamp: number;
    verified: boolean;
    [key: string]: any;
  };
}

export interface AccessControlRule {
  type: 'age' | 'privilege' | 'role';
  value: number | string;
  metadata: {
    issuer: string;
    timestamp: number;
    expiry?: number;
  };
}

export interface Citation {
  type: 'author' | 'citation' | 'domain';
  targetHash: string;
  verified: boolean;
  timestamp: number;
}

export class MetadataService {
  private relationships: Map<string, PublicationRelationship[]> = new Map();
  private accessRules: Map<string, AccessControlRule[]> = new Map();
  private contentMetadata: Map<string, ContentMetadata> = new Map();
  private citations: Map<string, Citation[]> = new Map();

  /**
   * Add content metadata
   */
  async addContentMetadata(metadata: ContentMetadata): Promise<void> {
    this.contentMetadata.set(metadata.contentHash, metadata);
  }

  /**
   * Add a relationship between publications
   */
  async addRelationship(
    sourceHash: string,
    targetHash: string,
    type: PublicationRelationship['type'],
    metadata: PublicationRelationship['metadata']
  ): Promise<void> {
    const relationship: PublicationRelationship = {
      type,
      targetHash,
      metadata
    };

    const existingRelationships = this.relationships.get(sourceHash) || [];
    existingRelationships.push(relationship);
    this.relationships.set(sourceHash, existingRelationships);
  }

  /**
   * Add an access control rule
   */
  async addAccessRule(
    contentHash: string,
    rule: AccessControlRule
  ): Promise<void> {
    const existingRules = this.accessRules.get(contentHash) || [];
    existingRules.push(rule);
    this.accessRules.set(contentHash, existingRules);
  }

  /**
   * Get all relationships for a publication
   */
  getRelationships(contentHash: string): PublicationRelationship[] {
    return this.relationships.get(contentHash) || [];
  }

  /**
   * Get all access rules for a publication
   */
  getAccessRules(contentHash: string): AccessControlRule[] {
    return this.accessRules.get(contentHash) || [];
  }

  /**
   * Get content metadata
   */
  async getContentMetadata(contentHash: string): Promise<ContentMetadata> {
    const metadata = this.contentMetadata.get(contentHash);
    if (!metadata) {
      throw new Error('Content metadata not found');
    }
    return metadata;
  }

  /**
   * Check if a user has access to content based on age
   */
  async checkAgeAccess(
    contentHash: string,
    userAge: number
  ): Promise<boolean> {
    const rules = this.getAccessRules(contentHash);
    const ageRules = rules.filter(rule => rule.type === 'age');
    
    if (ageRules.length === 0) return true;
    
    const requiredAge = Math.max(...ageRules.map(rule => rule.value as number));
    return userAge >= requiredAge;
  }

  /**
   * Check if a user has access based on privilege level
   */
  async checkPrivilegeAccess(
    contentHash: string,
    userPrivilege: string
  ): Promise<boolean> {
    const rules = this.getAccessRules(contentHash);
    const privilegeRules = rules.filter(rule => rule.type === 'privilege');
    
    if (privilegeRules.length === 0) return true;
    
    return privilegeRules.some(rule => rule.value === userPrivilege);
  }

  /**
   * Get citation network for a publication
   */
  async getCitationNetwork(contentHash: string): Promise<Citation[]> {
    return this.citations.get(contentHash) || [];
  }

  /**
   * Get author network for a publication
   */
  getAuthorNetwork(contentHash: string): string[] {
    const relationships = this.getRelationships(contentHash);
    const authors = relationships
      .filter(rel => rel.type === 'author')
      .map(rel => rel.targetHash);
    
    return authors;
  }

  /**
   * Get domain relationships for a publication
   */
  getDomainRelationships(contentHash: string): string[] {
    const relationships = this.getRelationships(contentHash);
    const domains = relationships
      .filter(rel => rel.type === 'domain')
      .map(rel => rel.targetHash);
    
    return domains;
  }

  async addCitation(
    sourceHash: string,
    targetHash: string,
    type: 'author' | 'citation' | 'domain',
    verified: boolean = false
  ): Promise<void> {
    const citation: Citation = {
      type,
      targetHash,
      verified,
      timestamp: Date.now()
    };

    const existingCitations = this.citations.get(sourceHash) || [];
    this.citations.set(sourceHash, [...existingCitations, citation]);
  }

  async verifyCitation(
    sourceHash: string,
    targetHash: string,
    type: 'author' | 'citation' | 'domain'
  ): Promise<void> {
    const citations = this.citations.get(sourceHash) || [];
    const citationIndex = citations.findIndex(
      c => c.targetHash === targetHash && c.type === type
    );

    if (citationIndex !== -1) {
      citations[citationIndex].verified = true;
      this.citations.set(sourceHash, citations);
    }
  }

  async getVerifiedCitations(contentHash: string): Promise<Citation[]> {
    const citations = this.citations.get(contentHash) || [];
    return citations.filter(c => c.verified);
  }

  async getUnverifiedCitations(contentHash: string): Promise<Citation[]> {
    const citations = this.citations.get(contentHash) || [];
    return citations.filter(c => !c.verified);
  }
} 