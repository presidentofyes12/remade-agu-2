import { ethers } from 'ethers';

export type ExecutionStatus = 
  | 'pending'      // Waiting for timelock period
  | 'ready'        // Ready for execution
  | 'executing'    // Currently being executed
  | 'completed'    // Successfully executed
  | 'failed'       // Execution failed
  | 'cancelled';   // Execution cancelled

export interface ExecutionConfig {
  timelockPeriod: number; // Minimum time before execution in seconds
  executionWindow: number; // Maximum time window for execution in seconds
  maxRetries: number; // Maximum number of execution retries
  requireGuardian: boolean; // Whether guardian approval is required
  guardianAddress: string; // Guardian contract address
}

export interface ExecutionAction {
  target: string; // Target contract address
  value: bigint; // Value to send with the transaction
  data: string; // Encoded function call data
  description: string; // Human-readable description of the action
}

export interface ExecutionState {
  proposalId: string;
  status: ExecutionStatus;
  actions: ExecutionAction[];
  timelockEnd: number;
  executionWindowEnd: number;
  retryCount: number;
  lastAttempt: number;
  error?: string;
  metadata: {
    executedBy?: string;
    guardianApproved?: boolean;
    guardianApprovalTime?: number;
    executionHash?: string;
  };
}

export interface ExecutionEvents {
  ExecutionScheduled: {
    proposalId: string;
    timelockEnd: bigint;
    executionWindowEnd: bigint;
    timestamp: bigint;
  };
  ExecutionReady: {
    proposalId: string;
    timestamp: bigint;
  };
  ExecutionStarted: {
    proposalId: string;
    executor: string;
    timestamp: bigint;
  };
  ExecutionCompleted: {
    proposalId: string;
    executor: string;
    executionHash: string;
    timestamp: bigint;
  };
  ExecutionFailed: {
    proposalId: string;
    error: string;
    timestamp: bigint;
  };
  ExecutionCancelled: {
    proposalId: string;
    cancelledBy: string;
    reason: string;
    timestamp: bigint;
  };
  GuardianApproval: {
    proposalId: string;
    guardian: string;
    approved: boolean;
    timestamp: bigint;
  };
}

export interface ProposalExecutionManager {
  // Execution Management
  scheduleExecution(proposalId: string, actions: ExecutionAction[]): Promise<void>;
  executeProposal(proposalId: string): Promise<string>;
  cancelExecution(proposalId: string, reason: string): Promise<void>;
  
  // State Management
  getExecutionState(proposalId: string): Promise<ExecutionState>;
  isExecutionReady(proposalId: string): Promise<boolean>;
  isExecutionCompleted(proposalId: string): Promise<boolean>;
  
  // Guardian Management
  approveExecution(proposalId: string): Promise<void>;
  rejectExecution(proposalId: string): Promise<void>;
  
  // Validation
  validateExecutionConfig(config: ExecutionConfig): boolean;
  validateExecutionActions(actions: ExecutionAction[]): Promise<boolean>;
  
  // Event Listeners
  on<K extends keyof ExecutionEvents>(
    event: K,
    listener: (event: ExecutionEvents[K]) => void
  ): void;
  
  off<K extends keyof ExecutionEvents>(
    event: K,
    listener: (event: ExecutionEvents[K]) => void
  ): void;
} 