import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConfigService } from '../config';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// Define interfaces for type safety
interface ConfigData {
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

// Test utilities
class ConfigTestFactory {
  static createDefaultConfig(): ConfigData {
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

  static createInvalidConfig(): Partial<ConfigData> {
    return {
      network: {
        chainId: -1, // Invalid chain ID
        rpcUrl: 'invalid-url'
      },
      contracts: {
        daoFactory: 'invalid-address',
        token: 'invalid-address'
      }
    };
  }
}

// Type guard for config validation
const isValidConfig = (config: unknown): config is ConfigData => {
  if (!config || typeof config !== 'object') return false;
  
  const c = config as ConfigData;
  return (
    typeof c.network?.chainId === 'number' &&
    typeof c.network?.rpcUrl === 'string' &&
    typeof c.contracts?.daoFactory === 'string' &&
    typeof c.contracts?.token === 'string' &&
    Array.isArray(c.nostr?.relays) &&
    typeof c.nostr?.eventKinds?.proposal === 'number' &&
    typeof c.nostr?.eventKinds?.vote === 'number' &&
    typeof c.voting?.minVotingPeriod === 'number' &&
    typeof c.voting?.maxVotingPeriod === 'number' &&
    typeof c.voting?.quorumPercentage === 'number'
  );
};

// Mock dependencies
jest.mock('../../utils/errorHandler');
jest.mock('../../utils/logger');

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockConfig: ConfigData;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize test data
    mockConfig = ConfigTestFactory.createDefaultConfig();
    
    // Initialize service
    configService = new ConfigService();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const config = configService.getConfig();
      expect(isValidConfig(config)).toBe(true);
    });

    it('should maintain singleton instance', () => {
      const instance1 = new ConfigService();
      const instance2 = new ConfigService();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Configuration Management', () => {
    it('should update config successfully', () => {
      const newConfig = {
        ...mockConfig,
        network: {
          ...mockConfig.network,
          chainId: 2
        }
      };

      configService.updateConfig(newConfig);
      const updatedConfig = configService.getConfig();
      expect(updatedConfig.network.chainId).toBe(2);
    });

    it('should validate config before update', () => {
      const invalidConfig = ConfigTestFactory.createInvalidConfig();
      
      expect(() => configService.updateConfig(invalidConfig as ConfigData))
        .toThrow('Invalid configuration');
      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should emit config update event', () => {
      const listener = jest.fn();
      configService.on('configUpdated', listener);
      
      configService.updateConfig(mockConfig);
      expect(listener).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('Network Configuration', () => {
    it('should get network config', () => {
      const networkConfig = configService.getNetworkConfig();
      expect(networkConfig).toEqual(mockConfig.network);
    });

    it('should update network config', () => {
      const newNetworkConfig = {
        chainId: 3,
        rpcUrl: 'https://new-rpc.com'
      };

      configService.updateNetworkConfig(newNetworkConfig);
      const updatedConfig = configService.getNetworkConfig();
      expect(updatedConfig).toEqual(newNetworkConfig);
    });
  });

  describe('Contract Configuration', () => {
    it('should get contract addresses', () => {
      const addresses = configService.getContractAddresses();
      expect(addresses).toEqual(mockConfig.contracts);
    });

    it('should update contract addresses', () => {
      const newAddresses = {
        daoFactory: '0xnewfactory',
        token: '0xnewtoken'
      };

      configService.updateContractAddresses(newAddresses);
      const updatedAddresses = configService.getContractAddresses();
      expect(updatedAddresses).toEqual(newAddresses);
    });
  });

  describe('Nostr Configuration', () => {
    it('should get Nostr config', () => {
      const nostrConfig = configService.getNostrConfig();
      expect(nostrConfig).toEqual(mockConfig.nostr);
    });

    it('should update Nostr config', () => {
      const newNostrConfig = {
        relays: ['wss://new-relay.com'],
        eventKinds: {
          proposal: 30001,
          vote: 30002
        }
      };

      configService.updateNostrConfig(newNostrConfig);
      const updatedConfig = configService.getNostrConfig();
      expect(updatedConfig).toEqual(newNostrConfig);
    });
  });

  describe('Voting Configuration', () => {
    it('should get voting config', () => {
      const votingConfig = configService.getVotingConfig();
      expect(votingConfig).toEqual(mockConfig.voting);
    });

    it('should update voting config', () => {
      const newVotingConfig = {
        minVotingPeriod: 7200,
        maxVotingPeriod: 1209600,
        quorumPercentage: 60
      };

      configService.updateVotingConfig(newVotingConfig);
      const updatedConfig = configService.getVotingConfig();
      expect(updatedConfig).toEqual(newVotingConfig);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid network config', () => {
      const invalidNetworkConfig = {
        chainId: -1,
        rpcUrl: 'invalid-url'
      };

      expect(() => configService.updateNetworkConfig(invalidNetworkConfig))
        .toThrow('Invalid network configuration');
      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle invalid contract addresses', () => {
      const invalidAddresses = {
        daoFactory: 'invalid-address',
        token: 'invalid-address'
      };

      expect(() => configService.updateContractAddresses(invalidAddresses))
        .toThrow('Invalid contract addresses');
      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle invalid voting config', () => {
      const invalidVotingConfig = {
        minVotingPeriod: -1,
        maxVotingPeriod: 0,
        quorumPercentage: 101
      };

      expect(() => configService.updateVotingConfig(invalidVotingConfig))
        .toThrow('Invalid voting configuration');
      expect(errorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should handle multiple event listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      configService.on('configUpdated', listener1);
      configService.on('configUpdated', listener2);
      
      configService.updateConfig(mockConfig);
      
      expect(listener1).toHaveBeenCalledWith(mockConfig);
      expect(listener2).toHaveBeenCalledWith(mockConfig);
    });

    it('should remove event listeners', () => {
      const listener = jest.fn();
      const removeListener = configService.on('configUpdated', listener);
      
      configService.updateConfig(mockConfig);
      expect(listener).toHaveBeenCalled();
      
      removeListener();
      configService.updateConfig(mockConfig);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
}); 