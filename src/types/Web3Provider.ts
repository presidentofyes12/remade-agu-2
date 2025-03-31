import { ethers } from 'ethers';

export interface IWeb3Provider {
  getProvider(): Promise<ethers.BrowserProvider>;
  getSigner(): Promise<ethers.JsonRpcSigner>;
  getAddress(): Promise<string>;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
} 