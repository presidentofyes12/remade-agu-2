import React, { useState, useEffect } from 'react';
import { BridgeService, ChainConfig, BridgeTransaction } from '../../services/bridge/BridgeService';
import { WalletConnector } from '../../services/wallet/WalletConnector';
import { KeyManager } from '../../services/wallet/KeyManager';

interface BridgeDashboardProps {
  walletConnector: WalletConnector;
  keyManager: KeyManager;
}

export const BridgeDashboard: React.FC<BridgeDashboardProps> = ({
  walletConnector,
  keyManager
}) => {
  const [bridgeService, setBridgeService] = useState<BridgeService | null>(null);
  const [chains, setChains] = useState<ChainConfig[]>([]);
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bridge form state
  const [sourceChainId, setSourceChainId] = useState<number | null>(null);
  const [targetChainId, setTargetChainId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [estimatedFee, setEstimatedFee] = useState('0');

  // New chain form state
  const [newChainConfig, setNewChainConfig] = useState<Partial<ChainConfig>>({
    chainId: 0,
    name: '',
    rpcUrl: '',
    bridgeAddress: '',
    tokenAddress: ''
  });

  useEffect(() => {
    const service = new BridgeService(walletConnector, keyManager);
    setBridgeService(service);
    loadChains(service);
  }, [walletConnector, keyManager]);

  useEffect(() => {
    if (bridgeService && sourceChainId) {
      loadTransactions(sourceChainId);
    }
  }, [bridgeService, sourceChainId]);

  useEffect(() => {
    if (bridgeService && sourceChainId && targetChainId && amount) {
      estimateFee();
    }
  }, [bridgeService, sourceChainId, targetChainId, amount]);

  const loadChains = async (service: BridgeService) => {
    try {
      const supportedChains = await service.getSupportedChains();
      setChains(supportedChains);
    } catch (err) {
      console.error('Failed to load chains:', err);
    }
  };

  const loadTransactions = async (chainId: number) => {
    if (!bridgeService) return;

    try {
      const chainTransactions = await bridgeService.getChainTransactions(chainId);
      setTransactions(chainTransactions);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  const estimateFee = async () => {
    if (!bridgeService || !sourceChainId || !targetChainId || !amount) return;

    try {
      const fee = await bridgeService.estimateBridgeFee(sourceChainId, targetChainId, amount);
      setEstimatedFee(fee);
    } catch (err) {
      console.error('Failed to estimate fee:', err);
    }
  };

  const handleBridgeAssets = async () => {
    if (!bridgeService || !sourceChainId || !targetChainId || !amount) return;

    setLoading(true);
    setError(null);

    try {
      const transaction = await bridgeService.bridgeAssets(sourceChainId, targetChainId, amount);
      setTransactions([transaction, ...transactions]);
      setAmount('');
    } catch (err) {
      setError('Failed to bridge assets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChain = async () => {
    if (!bridgeService || !newChainConfig.chainId || !newChainConfig.name) return;

    setLoading(true);
    setError(null);

    try {
      await bridgeService.initializeChain(newChainConfig as ChainConfig);
      await loadChains(bridgeService);
      setNewChainConfig({
        chainId: 0,
        name: '',
        rpcUrl: '',
        bridgeAddress: '',
        tokenAddress: ''
      });
    } catch (err) {
      setError('Failed to add chain');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveChain = async (chainId: number) => {
    if (!bridgeService) return;

    setLoading(true);
    setError(null);

    try {
      await bridgeService.removeChain(chainId);
      await loadChains(bridgeService);
      if (sourceChainId === chainId) {
        setSourceChainId(null);
        setTransactions([]);
      }
    } catch (err) {
      setError('Failed to remove chain');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Bridge Dashboard</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Add New Chain</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Chain ID</label>
              <input
                type="number"
                value={newChainConfig.chainId}
                onChange={(e) => setNewChainConfig({
                  ...newChainConfig,
                  chainId: parseInt(e.target.value)
                })}
                className="mt-1 block w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={newChainConfig.name}
                onChange={(e) => setNewChainConfig({
                  ...newChainConfig,
                  name: e.target.value
                })}
                className="mt-1 block w-full p-2 border rounded"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">RPC URL</label>
            <input
              type="text"
              value={newChainConfig.rpcUrl}
              onChange={(e) => setNewChainConfig({
                ...newChainConfig,
                rpcUrl: e.target.value
              })}
              className="mt-1 block w-full p-2 border rounded"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Bridge Address</label>
              <input
                type="text"
                value={newChainConfig.bridgeAddress}
                onChange={(e) => setNewChainConfig({
                  ...newChainConfig,
                  bridgeAddress: e.target.value
                })}
                className="mt-1 block w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Token Address</label>
              <input
                type="text"
                value={newChainConfig.tokenAddress}
                onChange={(e) => setNewChainConfig({
                  ...newChainConfig,
                  tokenAddress: e.target.value
                })}
                className="mt-1 block w-full p-2 border rounded"
              />
            </div>
          </div>
          <button
            onClick={handleAddChain}
            disabled={loading || !newChainConfig.chainId || !newChainConfig.name}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Add Chain
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Bridge Assets</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">From Chain</label>
              <select
                value={sourceChainId || ''}
                onChange={(e) => setSourceChainId(parseInt(e.target.value))}
                className="mt-1 block w-full p-2 border rounded"
              >
                <option value="">Select source chain</option>
                {chains.map(chain => (
                  <option key={chain.chainId} value={chain.chainId}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">To Chain</label>
              <select
                value={targetChainId || ''}
                onChange={(e) => setTargetChainId(parseInt(e.target.value))}
                className="mt-1 block w-full p-2 border rounded"
              >
                <option value="">Select target chain</option>
                {chains.map(chain => (
                  <option key={chain.chainId} value={chain.chainId}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="mt-1 block w-full p-2 border rounded"
            />
          </div>
          <div>
            <p className="text-sm text-gray-600">Estimated Fee: {estimatedFee}</p>
          </div>
          <button
            onClick={handleBridgeAssets}
            disabled={loading || !sourceChainId || !targetChainId || !amount}
            className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Bridge Assets
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Supported Chains</h2>
        <div className="space-y-4">
          {chains.map(chain => (
            <div key={chain.chainId} className="border p-4 rounded">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{chain.name}</p>
                  <p className="text-sm text-gray-600">Chain ID: {chain.chainId}</p>
                </div>
                <button
                  onClick={() => handleRemoveChain(chain.chainId)}
                  disabled={loading}
                  className="bg-red-500 text-white px-3 py-1 rounded disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {sourceChainId && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
          <div className="space-y-4">
            {transactions.map(tx => (
              <div key={tx.id} className="border p-4 rounded">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">From Chain</p>
                    <p className="font-medium">
                      {chains.find(c => c.chainId === tx.sourceChain)?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">To Chain</p>
                    <p className="font-medium">
                      {chains.find(c => c.chainId === tx.targetChain)?.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className="font-medium">{tx.amount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium">{tx.status}</p>
                  </div>
                  {tx.sourceTxHash && (
                    <div>
                      <p className="text-sm text-gray-600">Source Transaction</p>
                      <p className="font-mono text-sm break-all">{tx.sourceTxHash}</p>
                    </div>
                  )}
                  {tx.targetTxHash && (
                    <div>
                      <p className="text-sm text-gray-600">Target Transaction</p>
                      <p className="font-mono text-sm break-all">{tx.targetTxHash}</p>
                    </div>
                  )}
                  {tx.error && (
                    <div className="col-span-2">
                      <p className="text-sm text-red-600">Error: {tx.error}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 