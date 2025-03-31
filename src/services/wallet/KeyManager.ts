import { ethers } from 'ethers';
import { WalletConnector } from './WalletConnector';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface SecondaryKey {
  publicKey: string;
  privateKey: string;
  purpose: string;
  derivationPath: string;
}

export class KeyManager {
  private walletConnector: WalletConnector;
  private secondaryKeys: Map<string, SecondaryKey> = new Map();
  private readonly derivationPrefix = 'm/44\'/60\'/0\'/0/';

  constructor(walletConnector: WalletConnector) {
    this.walletConnector = walletConnector;
  }

  public async generateSecondaryKey(purpose: string): Promise<SecondaryKey> {
    try {
      const walletState = this.walletConnector.getWalletState();
      if (!walletState.isConnected) {
        throw new Error('No wallet connected');
      }

      // Generate a deterministic derivation path based on purpose
      const derivationPath = this.generateDerivationPath(purpose);
      
      // Use the wallet's private key to derive a new key pair
      const wallet = new ethers.Wallet(walletState.address);
      const secondaryKey = await this.deriveKeyPair(wallet, derivationPath);

      const secondaryKeyData: SecondaryKey = {
        publicKey: secondaryKey.publicKey,
        privateKey: secondaryKey.privateKey,
        purpose,
        derivationPath
      };

      this.secondaryKeys.set(purpose, secondaryKeyData);
      return secondaryKeyData;
    } catch (error) {
      console.error('Error generating secondary key:', error);
      throw error;
    }
  }

  private generateDerivationPath(purpose: string): string {
    // Create a deterministic path based on the purpose
    const purposeHash = ethers.keccak256(ethers.toUtf8Bytes(purpose));
    const index = parseInt(purposeHash.slice(0, 8), 16);
    return `${this.derivationPrefix}${index}`;
  }

  private async deriveKeyPair(wallet: ethers.Wallet, derivationPath: string): Promise<KeyPair> {
    // Use HDNode to derive the key pair
    const hdNode = ethers.HDNodeWallet.fromExtendedKey(wallet.privateKey) as ethers.HDNodeWallet;
    const derivedNode = hdNode.derivePath(derivationPath) as ethers.HDNodeWallet;
    
    if (!derivedNode.privateKey) {
      throw new Error('Failed to derive private key');
    }

    return {
      publicKey: derivedNode.publicKey,
      privateKey: derivedNode.privateKey
    };
  }

  public async getSecondaryKey(purpose: string): Promise<string | null> {
    const key = this.secondaryKeys.get(purpose);
    return key ? key.publicKey : null;
  }

  public async signWithSecondaryKey(purpose: string, message: string): Promise<string> {
    const secondaryKey = this.secondaryKeys.get(purpose);
    if (!secondaryKey) {
      throw new Error(`No secondary key found for purpose: ${purpose}`);
    }

    const wallet = new ethers.Wallet(secondaryKey.privateKey);
    return await wallet.signMessage(message);
  }

  public async encryptWithSecondaryKey(purpose: string, data: string): Promise<string> {
    const secondaryKey = this.secondaryKeys.get(purpose);
    if (!secondaryKey) {
      throw new Error(`No secondary key found for purpose: ${purpose}`);
    }

    const wallet = new ethers.Wallet(secondaryKey.privateKey);
    const encryptionKey = ethers.keccak256(ethers.toUtf8Bytes(secondaryKey.privateKey));
    
    // Use a simple XOR encryption for demonstration
    // In production, use a proper encryption algorithm
    const encrypted = ethers.hexlify(
      ethers.toUtf8Bytes(data).map((byte, i) => 
        byte ^ parseInt(encryptionKey.slice(2 + (i * 2), 4 + (i * 2)), 16)
      )
    );

    return encrypted;
  }

  public async decryptWithSecondaryKey(purpose: string, encryptedData: string): Promise<string> {
    const secondaryKey = this.secondaryKeys.get(purpose);
    if (!secondaryKey) {
      throw new Error(`No secondary key found for purpose: ${purpose}`);
    }

    const wallet = new ethers.Wallet(secondaryKey.privateKey);
    const encryptionKey = ethers.keccak256(ethers.toUtf8Bytes(secondaryKey.privateKey));
    
    // Decrypt using the same XOR operation
    const decrypted = ethers.toUtf8String(
      ethers.getBytes(encryptedData).map((byte, i) => 
        byte ^ parseInt(encryptionKey.slice(2 + (i * 2), 4 + (i * 2)), 16)
      )
    );

    return decrypted;
  }

  public clearSecondaryKeys(): void {
    this.secondaryKeys.clear();
  }

  public async getPublicKey(address: string): Promise<string> {
    try {
      const walletState = this.walletConnector.getWalletState();
      if (!walletState.isConnected) {
        throw new Error('No wallet connected');
      }

      // If the address matches the connected wallet, return its public key
      if (address.toLowerCase() === walletState.address.toLowerCase()) {
        return walletState.address;
      }

      // For other addresses, we need to check if we have a secondary key for this address
      for (const [purpose, key] of this.secondaryKeys.entries()) {
        if (key.publicKey.toLowerCase() === address.toLowerCase()) {
          return key.publicKey;
        }
      }

      throw new Error(`No public key found for address: ${address}`);
    } catch (error) {
      console.error('Error getting public key:', error);
      throw error;
    }
  }

  public async isAdmin(address: string): Promise<boolean> {
    try {
      const walletState = this.walletConnector.getWalletState();
      if (!walletState.isConnected) {
        return false;
      }

      // Check if the address matches the connected wallet
      if (address.toLowerCase() === walletState.address.toLowerCase()) {
        // In this implementation, we consider the connected wallet as the admin
        // You might want to implement a more sophisticated admin check based on your requirements
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }
} 