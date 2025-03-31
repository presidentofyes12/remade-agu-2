import { ethers } from 'ethers';
import { 
  VotingPowerManager, 
  Delegation, 
  DelegationType,
  DelegationConfig,
  DelegationEvents
} from '../types/votingDelegation';
import { errorHandler } from '../utils/errorHandler';
import { LoadingStateService } from './loadingStateService';

export class VotingPowerService implements VotingPowerManager {
  private static instance: VotingPowerService;
  private loadingStateService: LoadingStateService;
  private config: DelegationConfig;
  private eventListeners: Map<keyof DelegationEvents, Set<(event: DelegationEvents[keyof DelegationEvents]) => void>>;
  private delegations: Map<string, Delegation>;

  private constructor(
    loadingStateService: LoadingStateService,
    config: DelegationConfig
  ) {
    this.loadingStateService = loadingStateService;
    this.config = config;
    this.eventListeners = new Map();
    this.delegations = new Map();
  }

  public static getInstance(
    loadingStateService: LoadingStateService,
    config: DelegationConfig
  ): VotingPowerService {
    if (!VotingPowerService.instance) {
      VotingPowerService.instance = new VotingPowerService(
        loadingStateService,
        config
      );
    }
    return VotingPowerService.instance;
  }

  public async createDelegation(
    delegate: string,
    type: DelegationType,
    amount: bigint,
    percentage: number,
    reason?: string
  ): Promise<string> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const delegator = await this.getCurrentUser();

      // Validate delegation
      if (!await this.validateDelegation(delegator, delegate, type, amount, percentage)) {
        throw new Error('Invalid delegation parameters');
      }

      // Generate unique ID
      const id = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify({ delegator, delegate, type, amount, percentage }) + Date.now())
      );

      // Create delegation
      const delegation: Delegation = {
        id,
        delegator,
        delegate,
        type,
        amount,
        percentage,
        startTime: Date.now(),
        endTime: null,
        metadata: {
          reason,
          tags: []
        }
      };

      // Store delegation
      this.delegations.set(id, delegation);

      // Emit event
      this.emitEvent('DelegationCreated', {
        id,
        delegator,
        delegate,
        type,
        amount,
        percentage,
        timestamp: BigInt(Date.now())
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
      return id;
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async updateDelegation(
    delegationId: string,
    type: DelegationType,
    amount: bigint,
    percentage: number,
    reason?: string
  ): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const delegation = this.delegations.get(delegationId);
      if (!delegation) {
        throw new Error('Delegation not found');
      }

      // Validate update
      if (!await this.validateDelegation(delegation.delegator, delegation.delegate, type, amount, percentage)) {
        throw new Error('Invalid delegation parameters');
      }

      // Update delegation
      const updatedDelegation: Delegation = {
        ...delegation,
        type,
        amount,
        percentage,
        metadata: {
          ...delegation.metadata,
          reason,
          tags: [...delegation.metadata.tags, 'updated']
        }
      };

      // Store updated delegation
      this.delegations.set(delegationId, updatedDelegation);

      // Emit event
      this.emitEvent('DelegationUpdated', {
        id: delegationId,
        delegator: delegation.delegator,
        delegate: delegation.delegate,
        oldType: delegation.type,
        newType: type,
        oldAmount: delegation.amount,
        newAmount: amount,
        oldPercentage: delegation.percentage,
        newPercentage: percentage,
        timestamp: BigInt(Date.now())
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async revokeDelegation(delegationId: string): Promise<void> {
    try {
      this.loadingStateService.startOperation('contractInteraction');

      const delegation = this.delegations.get(delegationId);
      if (!delegation) {
        throw new Error('Delegation not found');
      }

      // Validate revocation
      const now = Date.now();
      if (now - delegation.startTime < this.config.cooldownPeriod * 1000) {
        throw new Error('Delegation revocation too soon');
      }

      // Update delegation
      const updatedDelegation: Delegation = {
        ...delegation,
        endTime: now,
        metadata: {
          ...delegation.metadata,
          tags: [...delegation.metadata.tags, 'revoked']
        }
      };

      // Store updated delegation
      this.delegations.set(delegationId, updatedDelegation);

      // Emit event
      this.emitEvent('DelegationRevoked', {
        id: delegationId,
        delegator: delegation.delegator,
        delegate: delegation.delegate,
        type: delegation.type,
        amount: delegation.amount,
        percentage: delegation.percentage,
        timestamp: BigInt(now)
      });

      this.loadingStateService.completeOperation('contractInteraction', true);
    } catch (error) {
      this.loadingStateService.completeOperation('contractInteraction', false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  public async getDelegation(id: string): Promise<Delegation | undefined> {
    return this.delegations.get(id);
  }

  public async getDelegationsByDelegator(address: string): Promise<Delegation[]> {
    return Array.from(this.delegations.values()).filter(d => d.delegator === address);
  }

  public async getDelegationsByDelegate(address: string): Promise<Delegation[]> {
    return Array.from(this.delegations.values()).filter(d => d.delegate === address);
  }

  public async getActiveDelegations(address: string): Promise<Delegation[]> {
    const now = Date.now();
    return Array.from(this.delegations.values()).filter(d => 
      (d.delegator === address || d.delegate === address) &&
      (!d.endTime || d.endTime > now)
    );
  }

  public async getEffectiveVotingPower(address: string): Promise<bigint> {
    const activeDelegations = await this.getActiveDelegations(address);
    let totalPower = BigInt(0);

    for (const delegation of activeDelegations) {
      if (delegation.delegate === address) {
        totalPower += await this.calculateDelegatedPower(delegation);
      }
    }

    return totalPower;
  }

  public async getDelegatedVotingPower(address: string): Promise<bigint> {
    const activeDelegations = await this.getActiveDelegations(address);
    let totalPower = BigInt(0);

    for (const delegation of activeDelegations) {
      if (delegation.delegator === address) {
        totalPower += await this.calculateDelegatedPower(delegation);
      }
    }

    return totalPower;
  }

  public async getAvailableVotingPower(address: string): Promise<bigint> {
    const basePower = await this.getBaseVotingPower(address);
    const delegatedPower = await this.getDelegatedVotingPower(address);
    return basePower - delegatedPower;
  }

  public async validateDelegation(
    delegator: string,
    delegate: string,
    type: DelegationType,
    amount: bigint,
    percentage: number
  ): Promise<boolean> {
    try {
      // Validate addresses
      if (!ethers.isAddress(delegator) || !ethers.isAddress(delegate)) {
        return false;
      }

      // Validate delegation type
      if (!['full', 'partial', 'percentage'].includes(type)) {
        return false;
      }

      // Validate amount
      if (amount < this.config.minDelegationAmount) {
        return false;
      }

      // Validate percentage
      if (percentage < 0 || percentage > this.config.maxDelegationPercentage) {
        return false;
      }

      // Check if delegator has reached maximum delegations
      const delegatorDelegations = await this.getDelegationsByDelegator(delegator);
      if (delegatorDelegations.length >= this.config.maxDelegationsPerAddress) {
        return false;
      }

      return true;
    } catch (error) {
      errorHandler.handleError(error);
      return false;
    }
  }

  public on<K extends keyof DelegationEvents>(
    event: K,
    listener: (event: DelegationEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener as (event: DelegationEvents[keyof DelegationEvents]) => void);
  }

  public off<K extends keyof DelegationEvents>(
    event: K,
    listener: (event: DelegationEvents[K]) => void
  ): void {
    this.eventListeners.get(event)?.delete(listener as (event: DelegationEvents[keyof DelegationEvents]) => void);
  }

  private async calculateDelegatedPower(delegation: Delegation): Promise<bigint> {
    if (delegation.type === 'full') {
      return await this.getBaseVotingPower(delegation.delegator);
    } else if (delegation.type === 'partial') {
      return delegation.amount;
    } else {
      const basePower = await this.getBaseVotingPower(delegation.delegator);
      return (basePower * BigInt(delegation.percentage)) / BigInt(100);
    }
  }

  private async getBaseVotingPower(address: string): Promise<bigint> {
    // This would be implemented to get the base voting power from the token contract
    return BigInt(0);
  }

  public async getCurrentUser(): Promise<string> {
    // This would be implemented to get the current user's address
    return '0x0000000000000000000000000000000000000000';
  }

  private emitEvent<K extends keyof DelegationEvents>(
    event: K,
    data: DelegationEvents[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  public async isDelegate(address: string): Promise<boolean> {
    try {
      // Check if the address is a delegate in any active delegation
      for (const delegation of this.delegations.values()) {
        if (delegation.delegate.toLowerCase() === address.toLowerCase() && !delegation.endTime) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to check delegate status:', error);
      return false;
    }
  }
} 