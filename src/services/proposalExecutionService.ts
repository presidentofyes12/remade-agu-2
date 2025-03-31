import { ethers } from 'ethers';
import { 
  ProposalExecutionManager, 
  ExecutionConfig,
  ExecutionState,
  ExecutionAction,
  ExecutionStatus,
  ExecutionEvents
} from '../types/proposalExecution';
import { errorHandler } from '../utils/errorHandler';
import { LoadingStateService } from './loadingStateService';

export class ProposalExecutionService implements ProposalExecutionManager {
  private static instance: ProposalExecutionService;
  private loadingStateService: LoadingStateService;
  private config: ExecutionConfig;
  private eventListeners: Map<keyof ExecutionEvents, Set<(event: ExecutionEvents[keyof ExecutionEvents]) => void>>;
  private executionStates: Map<string, ExecutionState>;

  private constructor(
    loadingStateService: LoadingStateService,
    config: ExecutionConfig
  ) {
    this.loadingStateService = loadingStateService;
    this.config = config;
    this.eventListeners = new Map();
    this.executionStates = new Map();
  }

  public static getInstance(
    loadingStateService: LoadingStateService,
    config: ExecutionConfig
  ): ProposalExecutionService {
    if (!ProposalExecutionService.instance) {
      ProposalExecutionService.instance = new ProposalExecutionService(
        loadingStateService,
        config
      );
    }
    return ProposalExecutionService.instance;
  }

  public async scheduleExecution(proposalId: string, actions: ExecutionAction[]): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      // Validate actions
      if (!await this.validateExecutionActions(actions)) {
        throw new Error('Invalid execution actions');
      }

      const now = Date.now();
      const timelockEnd = now + this.config.timelockPeriod * 1000;
      const executionWindowEnd = timelockEnd + this.config.executionWindow * 1000;

      const executionState: ExecutionState = {
        proposalId,
        status: 'pending',
        actions,
        timelockEnd,
        executionWindowEnd,
        retryCount: 0,
        lastAttempt: 0,
        metadata: {}
      };

      this.executionStates.set(proposalId, executionState);

      this.emitEvent('ExecutionScheduled', {
        proposalId,
        timelockEnd: BigInt(timelockEnd),
        executionWindowEnd: BigInt(executionWindowEnd),
        timestamp: BigInt(now)
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async executeProposal(proposalId: string): Promise<string> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const state = this.executionStates.get(proposalId);
      if (!state) {
        throw new Error('Execution state not found');
      }

      if (!await this.isExecutionReady(proposalId)) {
        throw new Error('Execution not ready');
      }

      if (this.config.requireGuardian && !state.metadata.guardianApproved) {
        throw new Error('Guardian approval required');
      }

      state.status = 'executing' as ExecutionStatus;
      state.lastAttempt = Date.now();
      this.executionStates.set(proposalId, state);

      const executor = await this.getCurrentUser();
      this.emitEvent('ExecutionStarted', {
        proposalId,
        executor,
        timestamp: BigInt(Date.now())
      });

      // Execute actions
      const executionHash = await this.executeActions(state.actions);

      state.status = 'completed' as ExecutionStatus;
      state.metadata.executedBy = executor;
      state.metadata.executionHash = executionHash;
      this.executionStates.set(proposalId, state);

      this.emitEvent('ExecutionCompleted', {
        proposalId,
        executor,
        executionHash,
        timestamp: BigInt(Date.now())
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
      return executionHash;
    } catch (error) {
      this.handleExecutionError(proposalId, error);
      throw error;
    }
  }

  public async cancelExecution(proposalId: string, reason: string): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const state = this.executionStates.get(proposalId);
      if (!state) {
        throw new Error('Execution state not found');
      }

      if (state.status === 'completed' || state.status === 'cancelled') {
        throw new Error('Execution cannot be cancelled');
      }

      state.status = 'cancelled' as ExecutionStatus;
      this.executionStates.set(proposalId, state);

      const cancelledBy = await this.getCurrentUser();
      this.emitEvent('ExecutionCancelled', {
        proposalId,
        cancelledBy,
        reason,
        timestamp: BigInt(Date.now())
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async getExecutionState(proposalId: string): Promise<ExecutionState> {
    const state = this.executionStates.get(proposalId);
    if (!state) {
      throw new Error('Execution state not found');
    }
    return state;
  }

  public async isExecutionReady(proposalId: string): Promise<boolean> {
    const state = this.executionStates.get(proposalId);
    if (!state) {
      return false;
    }

    const now = Date.now();
    return state.status === 'pending' && 
           now >= state.timelockEnd && 
           now <= state.executionWindowEnd;
  }

  public async isExecutionCompleted(proposalId: string): Promise<boolean> {
    const state = this.executionStates.get(proposalId);
    return state?.status === 'completed';
  }

  public async approveExecution(proposalId: string): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const state = this.executionStates.get(proposalId);
      if (!state) {
        throw new Error('Execution state not found');
      }

      if (!this.config.requireGuardian) {
        throw new Error('Guardian approval not required');
      }

      state.metadata.guardianApproved = true;
      state.metadata.guardianApprovalTime = Date.now();
      this.executionStates.set(proposalId, state);

      const guardian = await this.getCurrentUser();
      this.emitEvent('GuardianApproval', {
        proposalId,
        guardian,
        approved: true,
        timestamp: BigInt(Date.now())
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async rejectExecution(proposalId: string): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const state = this.executionStates.get(proposalId);
      if (!state) {
        throw new Error('Execution state not found');
      }

      if (!this.config.requireGuardian) {
        throw new Error('Guardian approval not required');
      }

      state.metadata.guardianApproved = false;
      this.executionStates.set(proposalId, state);

      const guardian = await this.getCurrentUser();
      this.emitEvent('GuardianApproval', {
        proposalId,
        guardian,
        approved: false,
        timestamp: BigInt(Date.now())
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public validateExecutionConfig(config: ExecutionConfig): boolean {
    try {
      if (config.timelockPeriod < 0) {
        return false;
      }
      if (config.executionWindow < 0) {
        return false;
      }
      if (config.maxRetries < 0) {
        return false;
      }
      if (config.requireGuardian && !ethers.isAddress(config.guardianAddress)) {
        return false;
      }
      return true;
    } catch (error) {
      errorHandler.handleError(error);
      return false;
    }
  }

  public async validateExecutionActions(actions: ExecutionAction[]): Promise<boolean> {
    try {
      if (!Array.isArray(actions) || actions.length === 0) {
        return false;
      }

      for (const action of actions) {
        if (!ethers.isAddress(action.target)) {
          return false;
        }
        if (action.value < BigInt(0)) {
          return false;
        }
        if (!action.data.startsWith('0x')) {
          return false;
        }
      }

      return true;
    } catch (error) {
      errorHandler.handleError(error);
      return false;
    }
  }

  public on<K extends keyof ExecutionEvents>(
    event: K,
    listener: (event: ExecutionEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: ExecutionEvents[keyof ExecutionEvents]) => void);
  }

  public off<K extends keyof ExecutionEvents>(
    event: K,
    listener: (event: ExecutionEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: ExecutionEvents[keyof ExecutionEvents]) => void);
  }

  private async executeActions(actions: ExecutionAction[]): Promise<string> {
    // This would be implemented to execute the actions on the blockchain
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }

  private async getCurrentUser(): Promise<string> {
    // This would be implemented to get the current user's address
    return '0x0000000000000000000000000000000000000000';
  }

  private handleExecutionError(proposalId: string, error: unknown): void {
    const state = this.executionStates.get(proposalId);
    if (!state) return;

    state.status = 'failed' as ExecutionStatus;
    state.error = error instanceof Error ? error.message : 'Unknown error';
    state.retryCount++;
    this.executionStates.set(proposalId, state);

    this.emitEvent('ExecutionFailed', {
      proposalId,
      error: state.error,
      timestamp: BigInt(Date.now())
    });

    this.loadingStateService.completeOperation('contractInteraction', false, state.error);
  }

  private emitEvent<K extends keyof ExecutionEvents>(
    event: K,
    data: ExecutionEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
} 