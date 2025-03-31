import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Define Ethereum provider interface
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (eventName: string, handler: (args: any) => void) => void;
  removeListener: (eventName: string, handler: (args: any) => void) => void;
}

// Extend Window interface without modifying existing declarations
declare global {
  interface Window {
    ethereum: any;
  }
}

interface AuthState {
  wallet: ethers.JsonRpcSigner | null;
  provider: ethers.Provider | null;
  isConnected: boolean;
  address: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    wallet: null,
    provider: null,
    isConnected: false,
    address: null
  });

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (typeof window.ethereum !== 'undefined' && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.send('eth_requestAccounts', []);
          
          if (accounts.length > 0) {
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            setAuthState({
              wallet: signer,
              provider,
              isConnected: true,
              address
            });
          }
        }
      } catch (error: unknown) {
        console.error('Failed to initialize auth:', error);
        if (error instanceof Error) {
          throw new Error(`Failed to initialize auth: ${error.message}`);
        }
        throw new Error('Failed to initialize auth: Unknown error');
      }
    };

    initializeAuth();

    // Cleanup function to remove event listeners
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setAuthState({
        wallet: null,
        provider: null,
        isConnected: false,
        address: null
      });
    } else {
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAuthState({
        wallet: signer,
        provider,
        isConnected: true,
        address
      });
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const connect = async () => {
    try {
      if (typeof window.ethereum !== 'undefined' && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        
        if (accounts.length > 0) {
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setAuthState({
            wallet: signer,
            provider,
            isConnected: true,
            address
          });

          // Add event listeners
          window.ethereum.on('accountsChanged', handleAccountsChanged);
          window.ethereum.on('chainChanged', handleChainChanged);
        }
      } else {
        throw new Error('No Ethereum provider found');
      }
    } catch (error: unknown) {
      console.error('Failed to connect:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to connect: ${error.message}`);
      }
      throw new Error('Failed to connect: Unknown error');
    }
  };

  const disconnect = () => {
    setAuthState({
      wallet: null,
      provider: null,
      isConnected: false,
      address: null
    });
  };

  return {
    ...authState,
    connect,
    disconnect
  };
}; 