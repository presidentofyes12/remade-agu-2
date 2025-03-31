import React, { useState, useEffect } from 'react';
import { AdminManager, NostrRelay, TokenAllocation } from '../../services/admin/AdminManager';
import { WalletConnector } from '../../services/wallet/WalletConnector';
import { KeyManager } from '../../services/wallet/KeyManager';

interface AdminDashboardProps {
  walletConnector: WalletConnector;
  keyManager: KeyManager;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  walletConnector,
  keyManager
}) => {
  const [adminManager, setAdminManager] = useState<AdminManager | null>(null);
  const [relays, setRelays] = useState<NostrRelay[]>([]);
  const [allocations, setAllocations] = useState<TokenAllocation[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [selectedRelay, setSelectedRelay] = useState<string | null>(null);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAdmin = async () => {
      try {
        const manager = new AdminManager(walletConnector, keyManager);
        await manager.initializeAdminRole();
        setAdminManager(manager);
      } catch (err) {
        setError('Failed to initialize admin role');
        console.error(err);
      }
    };

    initializeAdmin();
  }, [walletConnector, keyManager]);

  const handleAddRelay = async () => {
    if (!adminManager || !newRelayUrl) return;

    setLoading(true);
    setError(null);

    try {
      const relay = await adminManager.addNostrRelay(newRelayUrl);
      setRelays([...relays, relay]);
      setNewRelayUrl('');
    } catch (err) {
      setError('Failed to add relay');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRelayStatus = async (relayId: string, status: NostrRelay['status']) => {
    if (!adminManager) return;

    setLoading(true);
    setError(null);

    try {
      await adminManager.updateRelayStatus(relayId, status);
      setRelays(relays.map(relay =>
        relay.id === relayId ? { ...relay, status, lastUpdate: Date.now() } : relay
      ));
    } catch (err) {
      setError('Failed to update relay status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAllocateTokens = async () => {
    if (!adminManager || !selectedRelay || !allocationAmount) return;

    setLoading(true);
    setError(null);

    try {
      const amount = parseFloat(allocationAmount);
      const allocation = await adminManager.allocateTokens(selectedRelay, amount);
      setAllocations([...allocations, allocation]);
      setAllocationAmount('');
    } catch (err) {
      setError('Failed to allocate tokens');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Add New Relay</h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={newRelayUrl}
            onChange={(e) => setNewRelayUrl(e.target.value)}
            placeholder="Enter relay URL"
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={handleAddRelay}
            disabled={loading || !newRelayUrl}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Add Relay
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Manage Relays</h2>
        <div className="space-y-4">
          {relays.map(relay => (
            <div key={relay.id} className="border p-4 rounded">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{relay.url}</p>
                  <p className="text-sm text-gray-600">
                    Status: {relay.status} | Allocation: {relay.tokenAllocation}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateRelayStatus(relay.id, 'active')}
                    disabled={loading || relay.status === 'active'}
                    className="bg-green-500 text-white px-3 py-1 rounded disabled:opacity-50"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleUpdateRelayStatus(relay.id, 'inactive')}
                    disabled={loading || relay.status === 'inactive'}
                    className="bg-red-500 text-white px-3 py-1 rounded disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Allocate Tokens</h2>
        <div className="flex gap-4">
          <select
            value={selectedRelay || ''}
            onChange={(e) => setSelectedRelay(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">Select a relay</option>
            {relays.map(relay => (
              <option key={relay.id} value={relay.id}>
                {relay.url}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={allocationAmount}
            onChange={(e) => setAllocationAmount(e.target.value)}
            placeholder="Amount"
            className="p-2 border rounded"
          />
          <button
            onClick={handleAllocateTokens}
            disabled={loading || !selectedRelay || !allocationAmount}
            className="bg-purple-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Allocate
          </button>
        </div>

        <div className="mt-4">
          <h3 className="font-medium mb-2">Recent Allocations</h3>
          <div className="space-y-2">
            {allocations.map(allocation => (
              <div key={`${allocation.relayId}-${allocation.timestamp}`} className="text-sm">
                <p>
                  Relay: {relays.find(r => r.id === allocation.relayId)?.url}
                  | Amount: {allocation.amount}
                  | Status: {allocation.status}
                </p>
                {allocation.transactionHash && (
                  <p className="text-gray-600">Tx: {allocation.transactionHash}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 