import { ethers } from 'ethers';
import React from 'react';
import { 
  ProposalTemplateManager, 
  ProposalTemplate, 
  ProposalField,
  ProposalType,
  ProposalTemplateEvents,
  ProposalTemplateConfig
} from '../types/proposalTemplates';
import { errorHandler } from '../utils/errorHandler';
import { retryMechanism } from '../utils/retryMechanism';
import { LoadingStateService } from './loadingStateService';

export class ProposalTemplateService implements ProposalTemplateManager {
  private static instance: ProposalTemplateService;
  private loadingStateService: LoadingStateService;
  private config: ProposalTemplateConfig;
  private eventListeners: Map<keyof ProposalTemplateEvents, Set<(event: ProposalTemplateEvents[keyof ProposalTemplateEvents]) => void>>;
  private templates: Map<string, ProposalTemplate>;

  private constructor(
    loadingStateService: LoadingStateService,
    config: ProposalTemplateConfig
  ) {
    this.loadingStateService = loadingStateService;
    this.config = config;
    this.eventListeners = new Map();
    this.templates = new Map();
  }

  public static getInstance(
    loadingStateService: LoadingStateService,
    config: ProposalTemplateConfig
  ): ProposalTemplateService {
    if (!ProposalTemplateService.instance) {
      ProposalTemplateService.instance = new ProposalTemplateService(
        loadingStateService,
        config
      );
    }
    return ProposalTemplateService.instance;
  }

  public async createTemplate(
    template: Omit<ProposalTemplate, 'id' | 'metadata'>
  ): Promise<string> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      // Validate template
      if (!await this.validateTemplate(template as ProposalTemplate)) {
        throw new Error('Invalid template structure');
      }

      // Generate unique ID
      const id = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(template) + Date.now())
      );

      // Create metadata
      const metadata = {
        version: '1.0.0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        creator: await this.getCurrentUser(),
        tags: []
      };

      // Create full template
      const fullTemplate: ProposalTemplate = {
        ...template,
        id,
        metadata
      };

      // Store template
      this.templates.set(id, fullTemplate);

      // Emit event
      this.emitEvent('TemplateCreated', {
        id,
        type: template.type,
        creator: metadata.creator,
        timestamp: BigInt(Date.now())
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
      return id;
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async updateTemplate(
    id: string,
    template: Partial<ProposalTemplate>
  ): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const existingTemplate = this.templates.get(id);
      if (!existingTemplate) {
        throw new Error('Template not found');
      }

      // Validate update delay
      const now = Date.now();
      if (now - existingTemplate.metadata.updatedAt < this.config.templateUpdateDelay * 1000) {
        throw new Error('Template update too soon');
      }

      // Create updated template
      const updatedTemplate: ProposalTemplate = {
        ...existingTemplate,
        ...template,
        metadata: {
          ...existingTemplate.metadata,
          version: this.incrementVersion(existingTemplate.metadata.version),
          updatedAt: now
        }
      };

      // Validate updated template
      if (!await this.validateTemplate(updatedTemplate)) {
        throw new Error('Invalid template structure');
      }

      // Store updated template
      this.templates.set(id, updatedTemplate);

      // Emit event
      this.emitEvent('TemplateUpdated', {
        id,
        version: updatedTemplate.metadata.version,
        updater: await this.getCurrentUser(),
        timestamp: BigInt(now)
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async deleteTemplate(id: string): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const template = this.templates.get(id);
      if (!template) {
        throw new Error('Template not found');
      }

      // Validate deletion delay
      const now = Date.now();
      if (now - template.metadata.updatedAt < this.config.templateDeletionDelay * 1000) {
        throw new Error('Template deletion too soon');
      }

      // Remove template
      this.templates.delete(id);

      // Emit event
      this.emitEvent('TemplateDeleted', {
        id,
        deleter: await this.getCurrentUser(),
        timestamp: BigInt(now)
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async getTemplate(id: string): Promise<ProposalTemplate | undefined> {
    return this.templates.get(id);
  }

  public async getTemplatesByType(type: ProposalType): Promise<ProposalTemplate[]> {
    return Array.from(this.templates.values()).filter(t => t.type === type);
  }

  public async getAllTemplates(): Promise<ProposalTemplate[]> {
    return Array.from(this.templates.values());
  }

  public async validateTemplate(template: ProposalTemplate): Promise<boolean> {
    try {
      // Check required fields
      if (!template.type || !template.name || !template.description || !template.fields) {
        return false;
      }

      // Validate fields
      for (const field of template.fields) {
        if (!this.validateFieldStructure(field)) {
          return false;
        }
      }

      // Validate stages
      for (const [stage, config] of Object.entries(template.stages)) {
        if (!this.validateStageConfig(config)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      errorHandler.handleError(error);
      return false;
    }
  }

  public async validateField(field: ProposalField, value: any): Promise<boolean> {
    try {
      // Check required field
      if (field.required && value === undefined) {
        return false;
      }

      // Validate based on type
      switch (field.type) {
        case 'number':
          if (typeof value !== 'number') return false;
          if (field.validation) {
            if (field.validation.min !== undefined && value < field.validation.min) return false;
            if (field.validation.max !== undefined && value > field.validation.max) return false;
          }
          break;

        case 'address':
          if (!ethers.isAddress(value)) return false;
          break;

        case 'date':
          if (isNaN(Date.parse(value))) return false;
          break;

        case 'select':
          if (!field.validation?.options?.includes(value)) return false;
          break;

        case 'multiselect':
          if (!Array.isArray(value)) return false;
          if (field.validation?.options) {
            for (const item of value) {
              if (!field.validation.options.includes(item)) return false;
            }
          }
          break;
      }

      return true;
    } catch (error) {
      errorHandler.handleError(error);
      return false;
    }
  }

  public async generateProposalForm(templateId: string): Promise<React.ReactElement> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // This is a placeholder - actual form generation would be implemented here
    return React.createElement('div', null, 'Form generation not implemented');
  }

  public async getTemplateFields(templateId: string): Promise<ProposalField[]> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }
    return template.fields;
  }

  public on<K extends keyof ProposalTemplateEvents>(
    event: K,
    listener: (event: ProposalTemplateEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: ProposalTemplateEvents[keyof ProposalTemplateEvents]) => void);
  }

  public off<K extends keyof ProposalTemplateEvents>(
    event: K,
    listener: (event: ProposalTemplateEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: ProposalTemplateEvents[keyof ProposalTemplateEvents]) => void);
  }

  private validateFieldStructure(field: ProposalField): boolean {
    return (
      typeof field.name === 'string' &&
      typeof field.type === 'string' &&
      typeof field.label === 'string' &&
      typeof field.description === 'string' &&
      typeof field.required === 'boolean'
    );
  }

  private validateStageConfig(config: any): boolean {
    return (
      typeof config.duration === 'number' &&
      typeof config.quorum === 'number' &&
      typeof config.threshold === 'number' &&
      typeof config.tokenDistribution === 'number' &&
      config.quorum >= 0 &&
      config.quorum <= 100 &&
      config.threshold >= 0 &&
      config.threshold <= 100 &&
      config.tokenDistribution >= 0 &&
      config.tokenDistribution <= 100
    );
  }

  private incrementVersion(version: string): string {
    const [major, minor, patch] = version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }

  private async getCurrentUser(): Promise<string> {
    // This would be implemented to get the current user's address
    return '0x0000000000000000000000000000000000000000';
  }

  private emitEvent<K extends keyof ProposalTemplateEvents>(
    event: K,
    data: ProposalTemplateEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
} 