import { ethers } from 'ethers';

export interface IContractService {
  getContract(address: string, abi: any): Promise<ethers.Contract>;
  sendTransaction(contract: ethers.Contract, method: string, ...args: any[]): Promise<ethers.ContractTransactionResponse>;
  callMethod(contract: ethers.Contract, method: string, ...args: any[]): Promise<any>;
  estimateGas(contract: ethers.Contract, method: string, ...args: any[]): Promise<bigint>;
  getBalance(address: string): Promise<bigint>;
  getTransactionReceipt(txHash: string): Promise<ethers.ContractTransactionReceipt | null>;
  getBlockNumber(): Promise<number>;
} 