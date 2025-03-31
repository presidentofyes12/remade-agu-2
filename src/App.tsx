import React, { useState, useEffect } from 'react';
import { WalletConnector } from './services/wallet/WalletConnector';
import { KeyManager } from './services/wallet/KeyManager';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { OracleDashboard } from './components/oracle/OracleDashboard';
import { BridgeDashboard } from './components/bridge/BridgeDashboard';
import MinimalDAO from './components/dao/MinimalDAO';
import JoinDAO from './components/dao/JoinDAO';
import UserAgreement from './components/dao/UserAgreement';
import { ethers } from 'ethers';

const App: React.FC = () => {
  const [walletConnector] = useState(() => new WalletConnector());
  const [keyManager] = useState(() => new KeyManager(walletConnector));
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('dao');
  const [error, setError] = useState<string | null>(null);
  const [daoAddress, setDaoAddress] = useState<string>('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('');

  useEffect(() => {
    const connectWallet = async () => {
      try {
        await walletConnector.connect();
        setIsConnected(true);
        
        // Get and set wallet address
        const addr = await walletConnector.getAddress();
        setAddress(addr);
        
        // Get and format balance
        const provider = await walletConnector.getProvider();
        const balance = await provider.getBalance(addr);
        setBalance(ethers.formatEther(balance));
      } catch (err) {
        setError('Failed to connect wallet');
        console.error(err);
      }
    };

    connectWallet();
  }, [walletConnector]);

  const handleJoinDAO = async (daoAddr: string, userAddr: string) => {
    // Implementation for joining DAO
    console.log('Joining DAO:', daoAddr, userAddr);
  };

  const handleAgreementAccept = () => {
    setAgreementAccepted(true);
  };

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 p-8 bg-white shadow rounded-lg">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Minimal DAO</h1>
            <p className="text-gray-600 mb-8">Connect your wallet to get started</p>
            <button
              onClick={() => walletConnector.connect()}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold">Minimal DAO</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setActiveTab('dao')}
                  className={`${
                    activeTab === 'dao'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  DAO
                </button>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`${
                    activeTab === 'admin'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Admin
                </button>
                <button
                  onClick={() => setActiveTab('oracle')}
                  className={`${
                    activeTab === 'oracle'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Oracle
                </button>
                <button
                  onClick={() => setActiveTab('bridge')}
                  className={`${
                    activeTab === 'bridge'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Bridge
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}</span>
                <span className="ml-2">{balance ? `${balance} PLS` : ''}</span>
              </div>
              <button
                onClick={() => walletConnector.disconnect()}
                className="text-gray-500 hover:text-gray-700"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-10">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          {activeTab === 'dao' && (
            <div className="space-y-8">
              <MinimalDAO />
              {address && (
                <JoinDAO
                  daoAddress={daoAddress}
                  userAddress={address}
                  onJoin={handleJoinDAO}
                />
              )}
              {!agreementAccepted && (
                <UserAgreement
                  onAccept={handleAgreementAccept}
                  isInviter={false}
                />
              )}
            </div>
          )}
          {activeTab === 'admin' && (
            <AdminDashboard
              walletConnector={walletConnector}
              keyManager={keyManager}
            />
          )}
          {activeTab === 'oracle' && (
            <OracleDashboard
              walletConnector={walletConnector}
              keyManager={keyManager}
            />
          )}
          {activeTab === 'bridge' && (
            <BridgeDashboard
              walletConnector={walletConnector}
              keyManager={keyManager}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App; 