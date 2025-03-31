import { errorHandler } from './errorHandler';
import { logger } from './logger';
import { userPreferences } from './userPreferences';
import { retryMechanism } from './retryMechanism';

export interface Web3Config {
  autoConnect?: boolean;
  defaultChainId?: number;
  customRPCs?: Record<string, string>;
  retryConfig?: {
    maxAttempts?: number;
    initialDelay?: number;
  };
}

export interface Web3State {
  connected: boolean;
  chainId: number | null;
  account: string | null;
  provider: any | null;
}

export class Web3Initializer {
  private static instance: Web3Initializer;
  private config: Web3Config;
  private state: Web3State;
  private listeners: Set<(state: Web3State) => void>;

  private constructor(config: Web3Config = {}) {
    this.config = {
      autoConnect: true,
      defaultChainId: 1,
      customRPCs: {},
      ...config
    };
    this.state = {
      connected: false,
      chainId: null,
      account: null,
      provider: null
    };
    this.listeners = new Set();

    if (this.config.autoConnect) {
      this.initialize();
    }
  }

  public static getInstance(config?: Web3Config): Web3Initializer {
    if (!Web3Initializer.instance) {
      Web3Initializer.instance = new Web3Initializer(config);
    }
    return Web3Initializer.instance;
  }

  public async initialize(): Promise<void> {
    try {
      await this.setupProvider();
      await this.setupEventListeners();
      await this.connect();
    } catch (error) {
      const initError = errorHandler.handleError(error, {
        operation: 'web3Initialize',
        timestamp: Date.now()
      });
      logger.error('Failed to initialize Web3', initError);
      throw initError;
    }
  }

  public async connect(): Promise<void> {
    return retryMechanism.withRetry(
      async () => {
        try {
          if (!this.state.provider) {
            throw new Error('Provider not initialized');
          }

          const accounts = await this.state.provider.request({
            method: 'eth_requestAccounts'
          });

          const chainId = await this.state.provider.request({
            method: 'eth_chainId'
          });

          this.updateState({
            connected: true,
            account: accounts[0],
            chainId: parseInt(chainId, 16)
          });
        } catch (error) {
          const connectError = errorHandler.handleError(error, {
            operation: 'web3Connect',
            timestamp: Date.now()
          });
          logger.error('Failed to connect to Web3', connectError);
          throw connectError;
        }
      },
      this.config.retryConfig
    );
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.state.provider) {
        await this.state.provider.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
      }

      this.updateState({
        connected: false,
        account: null,
        chainId: null
      });
    } catch (error) {
      const disconnectError = errorHandler.handleError(error, {
        operation: 'web3Disconnect',
        timestamp: Date.now()
      });
      logger.error('Failed to disconnect from Web3', disconnectError);
      throw disconnectError;
    }
  }

  public async switchNetwork(chainId: number): Promise<void> {
    return retryMechanism.withRetry(
      async () => {
        try {
          if (!this.state.provider) {
            throw new Error('Provider not initialized');
          }

          await this.state.provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chainId.toString(16)}` }]
          });

          this.updateState({ chainId });
        } catch (error) {
          const switchError = errorHandler.handleError(error, {
            operation: 'web3SwitchNetwork',
            timestamp: Date.now(),
            additionalInfo: { chainId }
          });
          logger.error('Failed to switch network', switchError);
          throw switchError;
        }
      },
      this.config.retryConfig
    );
  }

  public getState(): Web3State {
    return { ...this.state };
  }

  public addListener(listener: (state: Web3State) => void): void {
    this.listeners.add(listener);
  }

  public removeListener(listener: (state: Web3State) => void): void {
    this.listeners.delete(listener);
  }

  private async setupProvider(): Promise<void> {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('No Ethereum provider found');
      }

      this.state.provider = window.ethereum;
      logger.info('Web3 provider initialized');
    } catch (error) {
      const setupError = errorHandler.handleError(error, {
        operation: 'web3SetupProvider',
        timestamp: Date.now()
      });
      logger.error('Failed to setup Web3 provider', setupError);
      throw setupError;
    }
  }

  private async setupEventListeners(): Promise<void> {
    try {
      if (!this.state.provider) {
        throw new Error('Provider not initialized');
      }

      this.state.provider.on('accountsChanged', this.handleAccountsChanged.bind(this));
      this.state.provider.on('chainChanged', this.handleChainChanged.bind(this));
      this.state.provider.on('disconnect', this.handleDisconnect.bind(this));

      logger.info('Web3 event listeners setup complete');
    } catch (error) {
      const setupError = errorHandler.handleError(error, {
        operation: 'web3SetupEventListeners',
        timestamp: Date.now()
      });
      logger.error('Failed to setup Web3 event listeners', setupError);
      throw setupError;
    }
  }

  private handleAccountsChanged(accounts: string[]): void {
    try {
      this.updateState({
        account: accounts[0] || null,
        connected: accounts.length > 0
      });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'web3HandleAccountsChanged',
        timestamp: Date.now()
      });
    }
  }

  private handleChainChanged(chainId: string): void {
    try {
      this.updateState({
        chainId: parseInt(chainId, 16)
      });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'web3HandleChainChanged',
        timestamp: Date.now()
      });
    }
  }

  private handleDisconnect(): void {
    try {
      this.updateState({
        connected: false,
        account: null,
        chainId: null
      });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: 'web3HandleDisconnect',
        timestamp: Date.now()
      });
    }
  }

  private updateState(updates: Partial<Web3State>): void {
    this.state = {
      ...this.state,
      ...updates
    };

    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        errorHandler.handleError(error, {
          operation: 'web3NotifyListeners',
          timestamp: Date.now()
        });
      }
    });
  }
}

export const web3Initializer = Web3Initializer.getInstance(); 