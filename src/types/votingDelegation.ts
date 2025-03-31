import { ethers } from 'ethers';

export type DelegationType = 
  | 'full'      // Delegate all voting power
  | 'partial'   // Delegate a specific amount
  | 'percentage'; // Delegate a percentage of voting power

export interface DelegationConfig {
  maxDelegationsPerAddress: number;
  minDelegationAmount: bigint;
  maxDelegationPercentage: number;
  lockPeriod: number; // in seconds
  cooldownPeriod: number; // in seconds
}

export interface Delegation {
  id: string;
  delegator: string;
  delegate: string;
  type: DelegationType;
  amount: bigint;
  percentage: number;
  startTime: number;
  endTime: number | null;
  metadata: {
    reason?: string;
    tags: string[];
  };
}

export interface DelegationEvents {
  DelegationCreated: {
    id: string;
    delegator: string;
    delegate: string;
    type: DelegationType;
    amount: bigint;
    percentage: number;
    timestamp: bigint;
  };
  DelegationUpdated: {
    id: string;
    delegator: string;
    delegate: string;
    oldType: DelegationType;
    newType: DelegationType;
    oldAmount: bigint;
    newAmount: bigint;
    oldPercentage: number;
    newPercentage: number;
    timestamp: bigint;
  };
  DelegationRevoked: {
    id: string;
    delegator: string;
    delegate: string;
    type: DelegationType;
    amount: bigint;
    percentage: number;
    timestamp: bigint;
  };
  DelegationExpired: {
    id: string;
    delegator: string;
    delegate: string;
    type: DelegationType;
    amount: bigint;
    percentage: number;
    timestamp: bigint;
  };
}

export interface VotingPowerManager {
  // Delegation Management
  createDelegation(
    delegate: string,
    type: DelegationType,
    amount: bigint,
    percentage: number,
    reason?: string
  ): Promise<string>;
  
  updateDelegation(
    delegationId: string,
    type: DelegationType,
    amount: bigint,
    percentage: number,
    reason?: string
  ): Promise<void>;
  
  revokeDelegation(delegationId: string): Promise<void>;
  
  // Delegation Queries
  getDelegation(id: string): Promise<Delegation | undefined>;
  getDelegationsByDelegator(address: string): Promise<Delegation[]>;
  getDelegationsByDelegate(address: string): Promise<Delegation[]>;
  getEffectiveVotingPower(address: string): Promise<bigint>;
  
  // Validation
  validateDelegation(
    delegator: string,
    delegate: string,
    type: DelegationType,
    amount: bigint,
    percentage: number
  ): Promise<boolean>;
  
  // Event Listeners
  on<K extends keyof DelegationEvents>(
    event: K,
    listener: (event: DelegationEvents[K]) => void
  ): void;
  
  off<K extends keyof DelegationEvents>(
    event: K,
    listener: (event: DelegationEvents[K]) => void
  ): void;
} 