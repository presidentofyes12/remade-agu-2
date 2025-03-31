import { ethers } from 'ethers';
import { WalletConnector } from '../wallet/WalletConnector';
import { IKeyManager } from '../../types/KeyManager';

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  bridgeAddress: string;
  tokenAddress: string;
  bridgeContract: string;
  bridgeABI: any;
}

export interface BridgeTransaction {
  id: string;
  sourceChain: number;
  targetChain: number;
  amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: number;
  sourceTxHash?: string;
  targetTxHash?: string;
  error?: string;
  recipient: string;
}

export class BridgeService {
  private walletConnector: WalletConnector;
  private keyManager: IKeyManager;
  private chains: Map<number, ChainConfig> = new Map();
  private transactions: Map<string, BridgeTransaction> = new Map();

  constructor(walletConnector: WalletConnector, keyManager: IKeyManager) {
    this.walletConnector = walletConnector;
    this.keyManager = keyManager;
  }

  public async initializeChain(config: ChainConfig): Promise<void> {
    try {
      const adminKey = await this.keyManager.getSecondaryKey('admin');
      if (!adminKey) {
        throw new Error('Admin role not initialized');
      }

      // Sign the chain configuration
      const signature = await this.keyManager.signWithSecondaryKey(
        'admin',
        `initialize_chain:${config.chainId}:${config.bridgeAddress}`
      );

      this.chains.set(config.chainId, config);
    } catch (error) {
      console.error('Failed to initialize chain:', error);
      throw error;
    }
  }

  public async bridgeAssets(
    sourceChainId: number,
    targetChainId: number,
    amount: string
  ): Promise<BridgeTransaction> {
    try {
      const sourceChain = this.chains.get(sourceChainId);
      const targetChain = this.chains.get(targetChainId);

      if (!sourceChain || !targetChain) {
        throw new Error('Invalid chain configuration');
      }

      // Create transaction object
      const transaction: BridgeTransaction = {
        id: ethers.keccak256(ethers.toUtf8Bytes(`${sourceChainId}-${targetChainId}-${amount}-${Date.now()}`)),
        sourceChain: sourceChainId,
        targetChain: targetChainId,
        amount,
        status: 'pending',
        timestamp: Date.now(),
        recipient: await this.walletConnector.getAddress() || '0x0000000000000000000000000000000000000000'
      };

      // Lock assets on source chain
      const sourceTx = await this.lockAssets(sourceChain, amount);
      transaction.sourceTxHash = sourceTx.hash;
      transaction.status = 'processing';

      // Initiate bridge transfer
      await this.initiateBridgeTransfer(transaction);

      this.transactions.set(transaction.id, transaction);
      return transaction;
    } catch (error) {
      console.error('Failed to bridge assets:', error);
      throw error;
    }
  }

  private async lockAssets(chain: ChainConfig, amount: string): Promise<ethers.ContractTransactionResponse> {
    try {
      const signer = await this.walletConnector.getSigner();
      const contract = new ethers.Contract(
        chain.bridgeContract,
        chain.bridgeABI,
        signer
      );

      const tx = await contract.lockAssets(amount);
      return tx;
    } catch (error) {
      console.error('Failed to lock assets:', error);
      throw new Error('Failed to lock assets for bridge transfer');
    }
  }

  private async initiateBridgeTransfer(transaction: BridgeTransaction): Promise<void> {
    try {
      const sourceChain = this.chains.get(transaction.sourceChain);
      const targetChain = this.chains.get(transaction.targetChain);

      if (!sourceChain || !targetChain) {
        throw new Error('Invalid chain configuration');
      }

      // Lock assets on source chain
      await this.lockAssets(sourceChain, transaction.amount);

      // Initiate bridge transfer
      const signer = await this.walletConnector.getSigner();
      const bridgeContract = new ethers.Contract(
        sourceChain.bridgeContract,
        sourceChain.bridgeABI,
        signer
      );

      await bridgeContract.initiateTransfer(
        transaction.targetChain,
        transaction.recipient,
        transaction.amount
      );
    } catch (error) {
      console.error('Failed to initiate bridge transfer:', error);
      throw new Error('Failed to initiate bridge transfer');
    }
  }

  public async getTransactionStatus(transactionId: string): Promise<BridgeTransaction | null> {
    return this.transactions.get(transactionId) || null;
  }

  public async getChainTransactions(chainId: number): Promise<BridgeTransaction[]> {
    return Array.from(this.transactions.values()).filter(
      tx => tx.sourceChain === chainId || tx.targetChain === chainId
    );
  }

  public async updateTransactionStatus(
    transactionId: string,
    status: BridgeTransaction['status'],
    targetTxHash?: string,
    error?: string
  ): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    transaction.status = status;
    if (targetTxHash) {
      transaction.targetTxHash = targetTxHash;
    }
    if (error) {
      transaction.error = error;
    }

    this.transactions.set(transactionId, transaction);
  }

  public async getSupportedChains(): Promise<ChainConfig[]> {
    return Array.from(this.chains.values());
  }

  public async getBridgeBalance(chainId: number): Promise<string> {
    try {
      const chain = this.chains.get(chainId);
      if (!chain) {
        throw new Error('Chain not found');
      }

      const signer = await this.walletConnector.getSigner();
      const contract = new ethers.Contract(
        chain.bridgeContract,
        chain.bridgeABI,
        signer
      );

      const balance = await contract.getBridgeBalance();
      return balance.toString();
    } catch (error) {
      console.error('Failed to get bridge balance:', error);
      throw new Error('Failed to get bridge balance');
    }
  }

  public async estimateBridgeFee(
    sourceChainId: number,
    targetChainId: number,
    amount: string
  ): Promise<string> {
    try {
      const sourceChain = this.chains.get(sourceChainId);
      if (!sourceChain) {
        throw new Error('Source chain not found');
      }

      const signer = await this.walletConnector.getSigner();
      const contract = new ethers.Contract(
        sourceChain.bridgeContract,
        sourceChain.bridgeABI,
        signer
      );

      const fee = await contract.estimateBridgeFee(targetChainId, amount);
      return fee.toString();
    } catch (error) {
      console.error('Failed to estimate bridge fee:', error);
      throw new Error('Failed to estimate bridge fee');
    }
  }

  public async removeChain(chainId: number): Promise<void> {
    try {
      const adminKey = this.keyManager.getSecondaryKey('admin');
      if (!adminKey) {
        throw new Error('Admin role not initialized');
      }

      // Sign the chain removal
      const signature = await this.keyManager.signWithSecondaryKey(
        'admin',
        `remove_chain:${chainId}`
      );

      this.chains.delete(chainId);
    } catch (error) {
      console.error('Failed to remove chain:', error);
      throw error;
    }
  }

  public async verifyBridgeMessage(
    sourceChainId: number,
    targetChainId: number,
    message: string,
    signature: string
  ): Promise<boolean> {
    try {
      const sourceChain = this.chains.get(sourceChainId);
      if (!sourceChain) {
        throw new Error('Source chain not found');
      }

      const provider = await this.walletConnector.getProvider();
      const contract = new ethers.Contract(
        sourceChain.bridgeContract,
        sourceChain.bridgeABI,
        provider
      );

      return await contract.verifyBridgeMessage(targetChainId, message, signature);
    } catch (error) {
      console.error('Failed to verify bridge message:', error);
      throw new Error('Failed to verify bridge message');
    }
  }
} 