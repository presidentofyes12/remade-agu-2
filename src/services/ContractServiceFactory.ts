import { ethers } from 'ethers';
import { IWeb3Provider } from '../types/Web3Provider';
import { IMockContractService } from '../types/MockContractService';
import { IContractService } from '../types/ContractService';

export class ContractServiceFactory {
  private static instance: ContractServiceFactory;
  private web3Provider: IWeb3Provider;
  private contractService: IContractService | null = null;
  private mockContractService: IMockContractService | null = null;
  private isTestMode: boolean = false;

  private constructor(web3Provider: IWeb3Provider) {
    this.web3Provider = web3Provider;
  }

  public static getInstance(web3Provider: IWeb3Provider): ContractServiceFactory {
    if (!ContractServiceFactory.instance) {
      ContractServiceFactory.instance = new ContractServiceFactory(web3Provider);
    }
    return ContractServiceFactory.instance;
  }

  public async initialize(): Promise<void> {
    try {
      if (!this.web3Provider.isConnected()) {
        await this.web3Provider.connect();
      }

      if (this.isTestMode) {
        this.contractService = this.mockContractService;
      } else {
        // Initialize real contract service
        this.contractService = await this.createContractService();
      }
    } catch (error) {
      console.error('Failed to initialize ContractServiceFactory:', error);
      throw new Error('Failed to initialize ContractServiceFactory');
    }
  }

  private async createContractService(): Promise<IContractService> {
    const provider = await this.web3Provider.getProvider();
    const signer = await this.web3Provider.getSigner();

    return {
      async getContract(address: string, abi: any): Promise<ethers.Contract> {
        return new ethers.Contract(address, abi, signer);
      },

      async sendTransaction(contract: ethers.Contract, method: string, ...args: any[]): Promise<ethers.ContractTransactionResponse> {
        const contractMethod = contract[method as keyof typeof contract];
        if (typeof contractMethod !== 'function') {
          throw new Error(`Method ${method} not found on contract`);
        }
        return await contractMethod(...args);
      },

      async callMethod(contract: ethers.Contract, method: string, ...args: any[]): Promise<any> {
        const contractMethod = contract[method as keyof typeof contract];
        if (typeof contractMethod !== 'function') {
          throw new Error(`Method ${method} not found on contract`);
        }
        return await contractMethod(...args);
      },

      async estimateGas(contract: ethers.Contract, method: string, ...args: any[]): Promise<bigint> {
        const contractMethod = contract[method as keyof typeof contract];
        if (typeof contractMethod !== 'function') {
          throw new Error(`Method ${method} not found on contract`);
        }
        const gasEstimate = await contract.estimateGas[method as keyof typeof contract.estimateGas];
        if (typeof gasEstimate !== 'function') {
          throw new Error(`Gas estimation not available for method ${method}`);
        }
        return await gasEstimate(...args);
      },

      async getBalance(address: string): Promise<bigint> {
        return await provider.getBalance(address);
      },

      async getTransactionReceipt(txHash: string): Promise<ethers.ContractTransactionReceipt | null> {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) return null;
        return receipt as ethers.ContractTransactionReceipt;
      },

      async getBlockNumber(): Promise<number> {
        return await provider.getBlockNumber();
      }
    };
  }

  public getContractService(): IContractService {
    if (!this.contractService) {
      throw new Error('ContractService not initialized');
    }
    return this.contractService;
  }

  public setTestMode(enabled: boolean, mockService?: IMockContractService): void {
    this.isTestMode = enabled;
    if (enabled && mockService) {
      this.mockContractService = mockService;
      this.contractService = mockService;
    } else if (!enabled) {
      this.mockContractService = null;
      this.contractService = null;
    }
  }
} 