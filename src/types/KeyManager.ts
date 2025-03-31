import { ethers } from 'ethers';

export interface IKeyManager {
  getPublicKey(address: string): Promise<string>;
  signWithSecondaryKey(keyName: string, message: string): Promise<string>;
  getSecondaryKey(keyName: string): Promise<string | null>;
  isAdmin(address: string): Promise<boolean>;
} 