import { ethers } from 'ethers';
import { IContractService } from './ContractService';

export interface IMockContractService extends IContractService {
  setMockResponse(method: string, response: any): void;
  setMockError(method: string, error: Error): void;
  clearMocks(): void;
  getCallCount(method: string): number;
} 