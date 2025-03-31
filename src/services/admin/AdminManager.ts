import { ethers } from 'ethers';
import { WalletConnector } from '../wallet/WalletConnector';
import { KeyManager } from '../wallet/KeyManager';

export interface NostrRelay {
  id: string;
  url: string;
  status: 'active' | 'inactive' | 'pending';
  tokenAllocation: number;
  lastUpdate: number;
}

export interface TokenAllocation {
  relayId: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  transactionHash?: string;
}

export class AdminManager {
  private walletConnector: WalletConnector;
  private keyManager: KeyManager;
  private readonly ADMIN_ROLE = 'admin';
  private readonly TOKEN_ALLOCATION_PERCENTAGE = 7.407407407; // 7.407407407%

  constructor(walletConnector: WalletConnector, keyManager: KeyManager) {
    this.walletConnector = walletConnector;
    this.keyManager = keyManager;
  }

  public async initializeAdminRole(): Promise<void> {
    try {
      // Generate admin-specific secondary key
      await this.keyManager.generateSecondaryKey(this.ADMIN_ROLE);
    } catch (error) {
      console.error('Failed to initialize admin role:', error);
      throw error;
    }
  }

  public async addNostrRelay(url: string): Promise<NostrRelay> {
    try {
      const adminKey = this.keyManager.getSecondaryKey(this.ADMIN_ROLE);
      if (!adminKey) {
        throw new Error('Admin role not initialized');
      }

      // Sign the relay URL with admin key
      const signature = await this.keyManager.signWithSecondaryKey(
        this.ADMIN_ROLE,
        `add_relay:${url}`
      );

      // Create relay object
      const relay: NostrRelay = {
        id: ethers.keccak256(ethers.toUtf8Bytes(url + signature)).slice(0, 32),
        url,
        status: 'pending',
        tokenAllocation: 0,
        lastUpdate: Date.now()
      };

      // TODO: Send transaction to add relay to smart contract
      // This would be implemented when we have the contract interface

      return relay;
    } catch (error) {
      console.error('Failed to add Nostr relay:', error);
      throw error;
    }
  }

  public async updateRelayStatus(relayId: string, status: NostrRelay['status']): Promise<void> {
    try {
      const adminKey = this.keyManager.getSecondaryKey(this.ADMIN_ROLE);
      if (!adminKey) {
        throw new Error('Admin role not initialized');
      }

      // Sign the status update
      const signature = await this.keyManager.signWithSecondaryKey(
        this.ADMIN_ROLE,
        `update_status:${relayId}:${status}`
      );

      // TODO: Send transaction to update relay status in smart contract
      // This would be implemented when we have the contract interface
    } catch (error) {
      console.error('Failed to update relay status:', error);
      throw error;
    }
  }

  public async allocateTokens(relayId: string, amount: number): Promise<TokenAllocation> {
    try {
      const adminKey = this.keyManager.getSecondaryKey(this.ADMIN_ROLE);
      if (!adminKey) {
        throw new Error('Admin role not initialized');
      }

      // Verify allocation percentage
      const totalSupply = await this.getTotalSupply(); // TODO: Implement this
      const maxAllocation = totalSupply * this.TOKEN_ALLOCATION_PERCENTAGE / 100;
      
      if (amount > maxAllocation) {
        throw new Error(`Allocation exceeds maximum allowed (${this.TOKEN_ALLOCATION_PERCENTAGE}%)`);
      }

      // Create allocation object
      const allocation: TokenAllocation = {
        relayId,
        amount,
        timestamp: Date.now(),
        status: 'pending'
      };

      // Sign the allocation
      const signature = await this.keyManager.signWithSecondaryKey(
        this.ADMIN_ROLE,
        `allocate_tokens:${relayId}:${amount}`
      );

      // TODO: Send transaction to allocate tokens in smart contract
      // This would be implemented when we have the contract interface

      return allocation;
    } catch (error) {
      console.error('Failed to allocate tokens:', error);
      throw error;
    }
  }

  public async getRelayAllocations(relayId: string): Promise<TokenAllocation[]> {
    try {
      // TODO: Implement fetching allocations from smart contract
      // This would be implemented when we have the contract interface
      return [];
    } catch (error) {
      console.error('Failed to get relay allocations:', error);
      throw error;
    }
  }

  private async getTotalSupply(): Promise<number> {
    // TODO: Implement fetching total supply from smart contract
    // This would be implemented when we have the contract interface
    return 0;
  }

  public async verifyAdminSignature(message: string, signature: string): Promise<boolean> {
    try {
      const adminKey = this.keyManager.getSecondaryKey(this.ADMIN_ROLE);
      if (!adminKey) {
        return false;
      }

      const recoveredAddress = ethers.recoverAddress(
        ethers.hashMessage(message),
        signature
      );

      return recoveredAddress.toLowerCase() === adminKey.publicKey.toLowerCase();
    } catch (error) {
      console.error('Failed to verify admin signature:', error);
      return false;
    }
  }
} 