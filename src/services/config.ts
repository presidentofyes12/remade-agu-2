import { EventEmitter } from 'events';
import { errorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export interface ConfigData {
  network: {
    chainId: number;
    rpcUrl: string;
  };
  contracts: {
    daoFactory: string;
    token: string;
  };
  nostr: {
    relays: string[];
    eventKinds: {
      proposal: number;
      vote: number;
    };
  };
  voting: {
    minVotingPeriod: number;
    maxVotingPeriod: number;
    quorumPercentage: number;
  };
}

export class ConfigService extends EventEmitter {
  private static instance: ConfigService;
  private config: ConfigData;

  private constructor() {
    super();
    this.config = this.getDefaultConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  public getConfig(): ConfigData {
    return { ...this.config };
  }

  public updateConfig(newConfig: ConfigData): void {
    try {
      this.validateConfig(newConfig);
      this.config = { ...newConfig };
      this.emit('configUpdated', this.config);
    } catch (error) {
      errorHandler.handleError(error as Error, {
        operation: 'ConfigService.updateConfig',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public getNetworkConfig(): ConfigData['network'] {
    return { ...this.config.network };
  }

  public updateNetworkConfig(networkConfig: ConfigData['network']): void {
    try {
      this.validateNetworkConfig(networkConfig);
      this.config.network = { ...networkConfig };
      this.emit('configUpdated', this.config);
    } catch (error) {
      errorHandler.handleError(error as Error, {
        operation: 'ConfigService.updateNetworkConfig',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public getContractAddresses(): ConfigData['contracts'] {
    return { ...this.config.contracts };
  }

  public updateContractAddresses(addresses: ConfigData['contracts']): void {
    try {
      this.validateContractAddresses(addresses);
      this.config.contracts = { ...addresses };
      this.emit('configUpdated', this.config);
    } catch (error) {
      errorHandler.handleError(error as Error, {
        operation: 'ConfigService.updateContractAddresses',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public getNostrConfig(): ConfigData['nostr'] {
    return { ...this.config.nostr };
  }

  public updateNostrConfig(nostrConfig: ConfigData['nostr']): void {
    try {
      this.validateNostrConfig(nostrConfig);
      this.config.nostr = { ...nostrConfig };
      this.emit('configUpdated', this.config);
    } catch (error) {
      errorHandler.handleError(error as Error, {
        operation: 'ConfigService.updateNostrConfig',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  public getVotingConfig(): ConfigData['voting'] {
    return { ...this.config.voting };
  }

  public updateVotingConfig(votingConfig: ConfigData['voting']): void {
    try {
      this.validateVotingConfig(votingConfig);
      this.config.voting = { ...votingConfig };
      this.emit('configUpdated', this.config);
    } catch (error) {
      errorHandler.handleError(error as Error, {
        operation: 'ConfigService.updateVotingConfig',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  private getDefaultConfig(): ConfigData {
    return {
      network: {
        chainId: 1,
        rpcUrl: 'https://mainnet.infura.io/v3/test'
      },
      contracts: {
        daoFactory: '0x1234567890abcdef',
        token: '0xabcdef1234567890'
      },
      nostr: {
        relays: ['wss://relay1.com', 'wss://relay2.com'],
        eventKinds: {
          proposal: 30000,
          vote: 30001
        }
      },
      voting: {
        minVotingPeriod: 3600,
        maxVotingPeriod: 604800,
        quorumPercentage: 50
      }
    };
  }

  private validateConfig(config: ConfigData): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration');
    }

    this.validateNetworkConfig(config.network);
    this.validateContractAddresses(config.contracts);
    this.validateNostrConfig(config.nostr);
    this.validateVotingConfig(config.voting);
  }

  private validateNetworkConfig(network: ConfigData['network']): void {
    if (!network || typeof network !== 'object') {
      throw new Error('Invalid network configuration');
    }

    if (typeof network.chainId !== 'number' || network.chainId <= 0) {
      throw new Error('Invalid chain ID');
    }

    if (typeof network.rpcUrl !== 'string' || !network.rpcUrl.startsWith('http')) {
      throw new Error('Invalid RPC URL');
    }
  }

  private validateContractAddresses(addresses: ConfigData['contracts']): void {
    if (!addresses || typeof addresses !== 'object') {
      throw new Error('Invalid contract addresses');
    }

    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(addresses.daoFactory)) {
      throw new Error('Invalid DAO factory address');
    }
    if (!addressRegex.test(addresses.token)) {
      throw new Error('Invalid token address');
    }
  }

  private validateNostrConfig(nostr: ConfigData['nostr']): void {
    if (!nostr || typeof nostr !== 'object') {
      throw new Error('Invalid Nostr configuration');
    }

    if (!Array.isArray(nostr.relays) || nostr.relays.length === 0) {
      throw new Error('Invalid Nostr relays');
    }

    if (!nostr.eventKinds || typeof nostr.eventKinds !== 'object') {
      throw new Error('Invalid Nostr event kinds');
    }

    if (typeof nostr.eventKinds.proposal !== 'number' || nostr.eventKinds.proposal <= 0) {
      throw new Error('Invalid proposal event kind');
    }

    if (typeof nostr.eventKinds.vote !== 'number' || nostr.eventKinds.vote <= 0) {
      throw new Error('Invalid vote event kind');
    }
  }

  private validateVotingConfig(voting: ConfigData['voting']): void {
    if (!voting || typeof voting !== 'object') {
      throw new Error('Invalid voting configuration');
    }

    if (typeof voting.minVotingPeriod !== 'number' || voting.minVotingPeriod <= 0) {
      throw new Error('Invalid minimum voting period');
    }

    if (typeof voting.maxVotingPeriod !== 'number' || voting.maxVotingPeriod <= 0) {
      throw new Error('Invalid maximum voting period');
    }

    if (voting.maxVotingPeriod < voting.minVotingPeriod) {
      throw new Error('Maximum voting period must be greater than minimum voting period');
    }

    if (typeof voting.quorumPercentage !== 'number' || 
        voting.quorumPercentage < 0 || 
        voting.quorumPercentage > 100) {
      throw new Error('Invalid quorum percentage');
    }
  }
} 