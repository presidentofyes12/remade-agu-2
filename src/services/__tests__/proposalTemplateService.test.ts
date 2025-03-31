import { ethers } from 'ethers';
import { ProposalTemplateService } from '../proposalTemplateService';
import { LoadingStateService } from '../loadingStateService';
import { ProposalType, ProposalTemplate, ProposalField } from '../../types/proposalTemplates';

jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  keccak256: jest.fn()
}));

describe('ProposalTemplateService', () => {
  let service: ProposalTemplateService;
  let loadingStateService: jest.Mocked<LoadingStateService>;
  let config: any;

  beforeEach(() => {
    loadingStateService = {
      startOperation: jest.fn(),
      completeOperation: jest.fn(),
      getOperationState: jest.fn(),
      getOperationProgress: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as any;

    config = {
      templateUpdateDelay: 60,
      templateDeletionDelay: 300
    };

    service = ProposalTemplateService.getInstance(loadingStateService, config);
  });

  describe('createTemplate', () => {
    const mockTemplate: Omit<ProposalTemplate, 'id' | 'metadata'> = {
      type: 'governance' as ProposalType,
      name: 'Test Template',
      description: 'Test Description',
      fields: [
        {
          name: 'testField',
          type: 'text',
          label: 'Test Field',
          description: 'Test Field Description',
          required: true
        }
      ],
      stages: {
        draft: {
          duration: 86400,
          quorum: 50,
          threshold: 60,
          tokenDistribution: 100
        }
      }
    };

    it('should create a template successfully', async () => {
      const mockId = '0x123';
      (ethers.keccak256 as unknown as jest.Mock).mockReturnValue(mockId);

      const result = await service.createTemplate(mockTemplate);

      expect(result).toBe(mockId);
      expect(loadingStateService.startOperation).toHaveBeenCalledWith('contractInteraction');
      expect(loadingStateService.completeOperation).toHaveBeenCalledWith('contractInteraction', true);
    });

    it('should throw error for invalid template', async () => {
      const invalidTemplate = { ...mockTemplate, fields: [] };

      await expect(service.createTemplate(invalidTemplate)).rejects.toThrow('Invalid template structure');
      expect(loadingStateService.completeOperation).toHaveBeenCalledWith('contractInteraction', false, expect.any(String));
    });
  });

  describe('updateTemplate', () => {
    const mockId = '0x123';
    const mockTemplate: ProposalTemplate = {
      id: mockId,
      type: 'governance' as ProposalType,
      name: 'Test Template',
      description: 'Test Description',
      fields: [
        {
          name: 'testField',
          type: 'text',
          label: 'Test Field',
          description: 'Test Field Description',
          required: true
        }
      ],
      stages: {
        draft: {
          duration: 86400,
          quorum: 50,
          threshold: 60,
          tokenDistribution: 100
        }
      },
      metadata: {
        version: '1.0.0',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
        creator: '0x456',
        tags: []
      }
    };

    beforeEach(() => {
      (service as any).templates.set(mockId, mockTemplate);
    });

    it('should update template successfully', async () => {
      const update = {
        name: 'Updated Template'
      };

      await service.updateTemplate(mockId, update);

      const updatedTemplate = await service.getTemplate(mockId);
      expect(updatedTemplate?.name).toBe('Updated Template');
      expect(updatedTemplate?.metadata.version).toBe('1.0.1');
      expect(loadingStateService.completeOperation).toHaveBeenCalledWith('contractInteraction', true);
    });

    it('should throw error if template not found', async () => {
      await expect(service.updateTemplate('0x999', {})).rejects.toThrow('Template not found');
    });

    it('should throw error if update too soon', async () => {
      const update = {
        name: 'Updated Template'
      };

      await expect(service.updateTemplate(mockId, update)).rejects.toThrow('Template update too soon');
    });
  });

  describe('deleteTemplate', () => {
    const mockId = '0x123';
    const mockTemplate: ProposalTemplate = {
      id: mockId,
      type: 'governance' as ProposalType,
      name: 'Test Template',
      description: 'Test Description',
      fields: [],
      stages: {},
      metadata: {
        version: '1.0.0',
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
        creator: '0x456',
        tags: []
      }
    };

    beforeEach(() => {
      (service as any).templates.set(mockId, mockTemplate);
    });

    it('should delete template successfully', async () => {
      await service.deleteTemplate(mockId);

      const deletedTemplate = await service.getTemplate(mockId);
      expect(deletedTemplate).toBeUndefined();
      expect(loadingStateService.completeOperation).toHaveBeenCalledWith('contractInteraction', true);
    });

    it('should throw error if template not found', async () => {
      await expect(service.deleteTemplate('0x999')).rejects.toThrow('Template not found');
    });
  });

  describe('validateField', () => {
    it('should validate number field correctly', async () => {
      const field: ProposalField = {
        name: 'testField',
        type: 'number',
        label: 'Test Field',
        description: 'Test Description',
        required: true,
        validation: {
          min: 0,
          max: 100
        }
      };

      expect(await service.validateField(field, 50)).toBe(true);
      expect(await service.validateField(field, -1)).toBe(false);
      expect(await service.validateField(field, 101)).toBe(false);
    });

    it('should validate address field correctly', async () => {
      const field: ProposalField = {
        name: 'testField',
        type: 'address',
        label: 'Test Field',
        description: 'Test Description',
        required: true
      };

      expect(await service.validateField(field, '0x1234567890123456789012345678901234567890')).toBe(true);
      expect(await service.validateField(field, 'invalid-address')).toBe(false);
    });

    it('should validate select field correctly', async () => {
      const field: ProposalField = {
        name: 'testField',
        type: 'select',
        label: 'Test Field',
        description: 'Test Description',
        required: true,
        validation: {
          options: ['option1', 'option2']
        }
      };

      expect(await service.validateField(field, 'option1')).toBe(true);
      expect(await service.validateField(field, 'option3')).toBe(false);
    });

    it('should validate multiselect field correctly', async () => {
      const field: ProposalField = {
        name: 'testField',
        type: 'multiselect',
        label: 'Test Field',
        description: 'Test Description',
        required: true,
        validation: {
          options: ['option1', 'option2']
        }
      };

      expect(await service.validateField(field, ['option1', 'option2'])).toBe(true);
      expect(await service.validateField(field, ['option3'])).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should handle event listeners correctly', () => {
      const listener = jest.fn();
      service.on('TemplateCreated', listener);
      service.off('TemplateCreated', listener);

      expect((service as any).eventListeners.get('TemplateCreated')?.size).toBe(0);
    });
  });
}); 