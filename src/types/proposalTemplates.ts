import { ethers } from 'ethers';
import React from 'react';

export type ProposalType = 
  | 'funding'
  | 'parameter'
  | 'emergency'
  | 'governance'
  | 'custom';

export type ProposalStage = 
  | 'draft'
  | 'discussion'
  | 'review'
  | 'voting'
  | 'execution'
  | 'completion'
  | 'cancelled'
  | 'failed';

export interface ProposalField {
  name: string;
  type: 'text' | 'number' | 'address' | 'date' | 'select' | 'multiselect';
  label: string;
  description: string;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
  defaultValue?: any;
}

export interface ProposalTemplate {
  id: string;
  type: ProposalType;
  name: string;
  description: string;
  fields: ProposalField[];
  stages: {
    [key in ProposalStage]?: {
      duration: number; // in seconds
      quorum: number; // percentage
      threshold: number; // percentage
      tokenDistribution: number; // percentage
    };
  };
  metadata: {
    version: string;
    createdAt: number;
    updatedAt: number;
    creator: string;
    tags: string[];
  };
}

export interface ProposalTemplateEvents {
  TemplateCreated: {
    id: string;
    type: ProposalType;
    creator: string;
    timestamp: bigint;
  };
  TemplateUpdated: {
    id: string;
    version: string;
    updater: string;
    timestamp: bigint;
  };
  TemplateDeleted: {
    id: string;
    deleter: string;
    timestamp: bigint;
  };
}

export interface ProposalTemplateConfig {
  maxTemplatesPerType: number;
  minTemplateVersion: string;
  templateUpdateDelay: number; // in seconds
  templateDeletionDelay: number; // in seconds
}

export interface ProposalTemplateManager {
  // Template Management
  createTemplate(template: Omit<ProposalTemplate, 'id' | 'metadata'>): Promise<string>;
  updateTemplate(id: string, template: Partial<ProposalTemplate>): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  getTemplate(id: string): Promise<ProposalTemplate | undefined>;
  getTemplatesByType(type: ProposalType): Promise<ProposalTemplate[]>;
  getAllTemplates(): Promise<ProposalTemplate[]>;
  
  // Template Validation
  validateTemplate(template: ProposalTemplate): Promise<boolean>;
  validateField(field: ProposalField, value: any): Promise<boolean>;
  
  // Template Usage
  generateProposalForm(templateId: string): Promise<React.ReactElement>;
  getTemplateFields(templateId: string): Promise<ProposalField[]>;
  
  // Event Listeners
  on<K extends keyof ProposalTemplateEvents>(
    event: K,
    listener: (event: ProposalTemplateEvents[K]) => void
  ): void;
  
  off<K extends keyof ProposalTemplateEvents>(
    event: K,
    listener: (event: ProposalTemplateEvents[K]) => void
  ): void;
} 