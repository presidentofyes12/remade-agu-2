import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetadataService, PublicationRelationship, AccessControlRule, Citation } from '../MetadataService';
import { ContentMetadata } from '../ContentFingerprintService';

describe('MetadataService', () => {
  let metadataService: MetadataService;
  const mockContentHash = '0x123';
  const mockTargetHash = '0x456';
  const mockMetadata: ContentMetadata = {
    contentHash: mockContentHash,
    title: 'Test Content',
    author: '0x789',
    mediaType: 'article',
    timestamp: Date.now(),
    merkleRoot: '0xabc',
    ageRating: 18,
    privilegeLevel: 'public'
  };

  beforeEach(() => {
    metadataService = new MetadataService();
  });

  describe('Content Metadata', () => {
    it('should add and retrieve content metadata', async () => {
      await metadataService.addContentMetadata(mockMetadata);
      const retrieved = await metadataService.getContentMetadata(mockContentHash);
      expect(retrieved).toEqual(mockMetadata);
    });

    it('should throw error when metadata not found', async () => {
      await expect(metadataService.getContentMetadata('0x999'))
        .rejects
        .toThrow('Content metadata not found');
    });

    it('should handle invalid content hash', async () => {
      await expect(metadataService.getContentMetadata(''))
        .rejects
        .toThrow('Content metadata not found');
    });
  });

  describe('Relationships', () => {
    it('should add and retrieve relationships', async () => {
      const relationshipMetadata: PublicationRelationship['metadata'] = {
        timestamp: Date.now(),
        verified: true
      };

      const relationshipType: PublicationRelationship['type'] = 'author';
      await metadataService.addRelationship(
        mockContentHash,
        mockTargetHash,
        relationshipType,
        relationshipMetadata
      );

      const relationships = metadataService.getRelationships(mockContentHash);
      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toEqual({
        type: relationshipType,
        targetHash: mockTargetHash,
        metadata: relationshipMetadata
      });
    });

    it('should handle multiple relationships of same type', async () => {
      const relationshipMetadata: PublicationRelationship['metadata'] = {
        timestamp: Date.now(),
        verified: true
      };

      const relationshipType: PublicationRelationship['type'] = 'author';
      await metadataService.addRelationship(
        mockContentHash,
        mockTargetHash,
        relationshipType,
        relationshipMetadata
      );

      const anotherTargetHash = '0x789';
      await metadataService.addRelationship(
        mockContentHash,
        anotherTargetHash,
        relationshipType,
        relationshipMetadata
      );

      const relationships = metadataService.getRelationships(mockContentHash);
      expect(relationships).toHaveLength(2);
      expect(relationships.map(r => r.targetHash)).toEqual([mockTargetHash, anotherTargetHash]);
    });

    it('should get author network', async () => {
      const relationshipMetadata: PublicationRelationship['metadata'] = {
        timestamp: Date.now(),
        verified: true
      };

      const relationshipType: PublicationRelationship['type'] = 'author';
      await metadataService.addRelationship(
        mockContentHash,
        mockTargetHash,
        relationshipType,
        relationshipMetadata
      );

      const authors = metadataService.getAuthorNetwork(mockContentHash);
      expect(authors).toEqual([mockTargetHash]);
    });

    it('should get domain relationships', async () => {
      const relationshipMetadata: PublicationRelationship['metadata'] = {
        timestamp: Date.now(),
        verified: true
      };

      const relationshipType: PublicationRelationship['type'] = 'domain';
      await metadataService.addRelationship(
        mockContentHash,
        mockTargetHash,
        relationshipType,
        relationshipMetadata
      );

      const domains = metadataService.getDomainRelationships(mockContentHash);
      expect(domains).toEqual([mockTargetHash]);
    });
  });

  describe('Access Rules', () => {
    it('should add and retrieve access rules', async () => {
      const rule: AccessControlRule = {
        type: 'age',
        value: 18,
        metadata: {
          issuer: '0x789',
          timestamp: Date.now(),
          expiry: Date.now() + 86400000 // 24 hours
        }
      };

      await metadataService.addAccessRule(mockContentHash, rule);
      const rules = metadataService.getAccessRules(mockContentHash);
      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual(rule);
    });

    it('should check age access', async () => {
      const rule: AccessControlRule = {
        type: 'age',
        value: 18,
        metadata: {
          issuer: '0x789',
          timestamp: Date.now()
        }
      };

      await metadataService.addAccessRule(mockContentHash, rule);
      
      const hasAccess = await metadataService.checkAgeAccess(mockContentHash, 20);
      expect(hasAccess).toBe(true);

      const noAccess = await metadataService.checkAgeAccess(mockContentHash, 16);
      expect(noAccess).toBe(false);
    });

    it('should check privilege access', async () => {
      const rule: AccessControlRule = {
        type: 'privilege',
        value: 'admin',
        metadata: {
          issuer: '0x789',
          timestamp: Date.now()
        }
      };

      await metadataService.addAccessRule(mockContentHash, rule);
      
      const hasAccess = await metadataService.checkPrivilegeAccess(mockContentHash, 'admin');
      expect(hasAccess).toBe(true);

      const noAccess = await metadataService.checkPrivilegeAccess(mockContentHash, 'user');
      expect(noAccess).toBe(false);
    });

    it('should handle multiple access rules', async () => {
      const ageRule: AccessControlRule = {
        type: 'age',
        value: 18,
        metadata: {
          issuer: '0x789',
          timestamp: Date.now()
        }
      };

      const privilegeRule: AccessControlRule = {
        type: 'privilege',
        value: 'admin',
        metadata: {
          issuer: '0x789',
          timestamp: Date.now()
        }
      };

      await metadataService.addAccessRule(mockContentHash, ageRule);
      await metadataService.addAccessRule(mockContentHash, privilegeRule);

      const rules = metadataService.getAccessRules(mockContentHash);
      expect(rules).toHaveLength(2);
      expect(rules.map(r => r.type)).toEqual(['age', 'privilege']);
    });
  });

  describe('Citations', () => {
    it('should add and retrieve citations', async () => {
      const citationType: Citation['type'] = 'citation';
      await metadataService.addCitation(mockContentHash, mockTargetHash, citationType);
      const citations = await metadataService.getCitationNetwork(mockContentHash);
      expect(citations).toHaveLength(1);
      expect(citations[0]).toEqual({
        type: citationType,
        targetHash: mockTargetHash,
        verified: false,
        timestamp: expect.any(Number)
      });
    });

    it('should verify citations', async () => {
      const citationType: Citation['type'] = 'citation';
      await metadataService.addCitation(mockContentHash, mockTargetHash, citationType);
      await metadataService.verifyCitation(mockContentHash, mockTargetHash, citationType);
      
      const verifiedCitations = await metadataService.getVerifiedCitations(mockContentHash);
      expect(verifiedCitations).toHaveLength(1);
      expect(verifiedCitations[0].verified).toBe(true);
    });

    it('should handle non-existent citations', async () => {
      const citationType: Citation['type'] = 'citation';
      await metadataService.verifyCitation(mockContentHash, mockTargetHash, citationType);
      
      const verifiedCitations = await metadataService.getVerifiedCitations(mockContentHash);
      expect(verifiedCitations).toHaveLength(0);
    });

    it('should handle multiple citations', async () => {
      const citationType: Citation['type'] = 'citation';
      const anotherTargetHash = '0x789';
      
      await metadataService.addCitation(mockContentHash, mockTargetHash, citationType);
      await metadataService.addCitation(mockContentHash, anotherTargetHash, citationType);
      
      const citations = await metadataService.getCitationNetwork(mockContentHash);
      expect(citations).toHaveLength(2);
      expect(citations.map(c => c.targetHash)).toEqual([mockTargetHash, anotherTargetHash]);
    });
  });
}); 