import { ethers } from 'ethers';

interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (eventName: string, handler: (args: any) => void) => void;
  removeListener: (eventName: string, handler: (args: any) => void) => void;
}

// Extend Window interface without modifying the original
interface CustomWindow extends Omit<Window, 'ethereum'> {
  ethereum?: EthereumProvider;
}

declare const window: CustomWindow;

export interface WalletState {
  address: string;
  chainId: number;
  isConnected: boolean;
}

export interface WalletError extends Error {
  code?: number;
  data?: any;
}

export class WalletConnector {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private walletState: WalletState = {
    address: '',
    chainId: 0,
    isConnected: false
  };

  private readonly PULSECHAIN_ID = 369;
  private readonly PULSECHAIN_CONFIG = {
    chainId: '0x171',
    chainName: 'PulseChain',
    nativeCurrency: {
      name: 'Pulse',
      symbol: 'PLS',
      decimals: 18
    },
    rpcUrls: ['https://rpc.pulsechain.com'],
    blockExplorerUrls: ['https://scan.pulsechain.com']
  };

  async connect(): Promise<void> {
    if (!window.ethereum) {
      throw new Error('No Ethereum wallet found');
    }

    try {
      // Check if we're on PulseChain
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== this.PULSECHAIN_CONFIG.chainId) {
        // Try to switch to PulseChain
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: this.PULSECHAIN_CONFIG.chainId }],
          });
        } catch (switchError: any) {
          // If PulseChain is not added, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [this.PULSECHAIN_CONFIG]
            });
          } else {
            throw switchError;
          }
        }
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      
      // Update wallet state
      const address = await this.signer.getAddress();
      const network = await this.provider.getNetwork();
      
      this.walletState = {
        address,
        chainId: Number(network.chainId),
        isConnected: true
      };

      // Set up event listeners
      window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
      window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw this.handleWalletError(error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Remove event listeners
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', this.handleAccountsChanged.bind(this));
        window.ethereum.removeListener('chainChanged', this.handleChainChanged.bind(this));
      }

      // Reset state
      this.provider = null;
      this.signer = null;
      this.walletState = {
        address: '',
        chainId: 0,
        isConnected: false
      };
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw this.handleWalletError(error);
    }
  }

  private handleAccountsChanged = async (accounts: string[]): Promise<void> => {
    if (accounts.length === 0) {
      await this.disconnect();
    } else {
      this.walletState.address = accounts[0];
    }
  };

  private handleChainChanged = async (chainId: string): Promise<void> => {
    this.walletState.chainId = parseInt(chainId, 16);
  };

  private handleWalletError(error: unknown): WalletError {
    if (error instanceof Error) {
      const walletError = error as WalletError;
      if (walletError.code === 4001) {
        walletError.message = 'User rejected the request';
      } else if (walletError.code === -32002) {
        walletError.message = 'Request already pending';
      }
      return walletError;
    }
    return new Error('Unknown wallet error') as WalletError;
  }

  async getAddress(): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }
    return await this.signer.getAddress();
  }

  async signMessage(message: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }
    return await this.signer.signMessage(message);
  }

  async signInWithEthereum(domain: string, address: string): Promise<string> {
    const message = {
      domain,
      address,
      statement: 'Sign in with Ethereum to the DAO Admin.',
      uri: window.location.origin,
      version: '1',
      chainId: this.PULSECHAIN_ID,
      nonce: Math.random().toString(36).slice(2),
    };

    const signature = await this.signMessage(JSON.stringify(message));
    return signature;
  }

  async sendTransaction(to: string, value: bigint): Promise<ethers.TransactionResponse> {
    if (!this.signer || !this.provider) {
      throw new Error('Wallet not connected');
    }

    try {
      const feeData = await this.provider.getFeeData();
      if (!feeData?.gasPrice) {
        throw new Error('Failed to get gas price');
      }

      // Add 20% buffer to gas price
      const gasPrice = (feeData.gasPrice * BigInt(120)) / BigInt(100);

      const tx = {
        to,
        value,
        gasPrice,
      };

      return await this.signer.sendTransaction(tx);
    } catch (error) {
      console.error('Failed to send transaction:', error);
      throw this.handleWalletError(error);
    }
  }

  public getWalletState(): WalletState {
    return this.walletState;
  }

  public async getSigner(): Promise<ethers.JsonRpcSigner> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }
    return this.signer;
  }

  public async getProvider(): Promise<ethers.BrowserProvider> {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }
    return this.provider;
  }
} 