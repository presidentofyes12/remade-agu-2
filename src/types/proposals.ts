import { ProposalData } from './contracts';

export type Proposal = ProposalData;

export enum ProposalStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

export interface ProposalEvent {
  proposalId: bigint;
  timestamp: number;
  eventType: ProposalStatus;
  data?: any;
} 