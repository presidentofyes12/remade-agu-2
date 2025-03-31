import React, { useState, useEffect } from 'react';
import { OracleService, OracleConfig, OracleData } from '../../services/oracle/OracleService';
import { WalletConnector } from '../../services/wallet/WalletConnector';
import { KeyManager } from '../../services/wallet/KeyManager';
import { VotingPowerService } from '../../services/votingPowerService';
import { ProposalQuorumService } from '../../services/proposalQuorumService';
import { LoadingStateService } from '../../services/loadingStateService';
import { NotificationService } from '../../services/notificationService';
import { NostrRelayService } from '../../services/nostrRelay';
import { DelegationConfig } from '../../types/votingDelegation';
import { LoadingStateConfig, LoadingOperation } from '../../types/loadingStates';
import { NotificationContract, NotificationPreferences, NotificationEvents } from '../../types/notifications';
import { ethers } from 'ethers';

interface OracleDashboardProps {
  walletConnector: WalletConnector;
  keyManager: KeyManager;
}

export const OracleDashboard: React.FC<OracleDashboardProps> = ({
  walletConnector,
  keyManager
}) => {
  const [oracleService, setOracleService] = useState<OracleService | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [oracleData, setOracleData] = useState<OracleData | null>(null);
  const [historicalData, setHistoricalData] = useState<OracleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newValue, setNewValue] = useState<string>('');

  const [newOracleConfig, setNewOracleConfig] = useState<Partial<OracleConfig>>({
    updateInterval: 60000, // 1 minute default
    requiredVotingPower: 100n,
    validationPeriod: 3600, // 1 hour default
    minVotesRequired: 3,
    maxAdminVotingPower: 1000n,
    maxDelegateVotingPower: 500n,
    minorityProtectionThreshold: 25, // 25% default
    vetoPowerThreshold: 33 // 33% default
  });

  useEffect(() => {
    // Create mock services for testing
    const mockNotificationContract: NotificationContract = {
      createNotification: async () => 'mock-notification-id',
      markAsRead: async () => ({ wait: async () => {} } as unknown as ethers.ContractTransactionResponse),
      updatePreferences: async () => ({ wait: async () => {} } as unknown as ethers.ContractTransactionResponse),
      getPreferences: async () => ({
        enabled: true,
        types: {
          keyRotation: { enabled: true, priority: 'medium', deliveryMethod: 'both' },
          backupRequest: { enabled: true, priority: 'high', deliveryMethod: 'both' },
          multiSigRequest: { enabled: true, priority: 'high', deliveryMethod: 'both' },
          transactionStatus: { enabled: true, priority: 'low', deliveryMethod: 'both' },
          systemAlert: { enabled: true, priority: 'high', deliveryMethod: 'both' }
        },
        quietHours: { enabled: false, start: 0, end: 0 }
      }),
      getNotification: async () => ({
        id: 'mock-notification-id',
        type: 'systemAlert',
        priority: 'medium',
        title: 'Mock Notification',
        message: 'This is a mock notification',
        timestamp: BigInt(Date.now()),
        read: false,
        metadata: {}
      }),
      getUnreadNotifications: async () => ['mock-notification-id'],
      getNotificationsByType: async () => ['mock-notification-id'],
      on: async () => mockNotificationContract,
      off: async () => mockNotificationContract
    };

    const nostrService = NostrRelayService.getInstance();
    const notificationService = NotificationService.getInstance(mockNotificationContract, nostrService);

    const loadingStateConfig: LoadingStateConfig = {
      defaultTimeout: 60000, // 1 minute
      progressUpdateInterval: 1000, // 1 second
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      estimatedDurations: {
        transaction: 30000, // 30 seconds
        keyRotation: 10000, // 10 seconds
        backup: 20000, // 20 seconds
        multiSig: 15000, // 15 seconds
        contractInteraction: 5000, // 5 seconds
        dataFetch: 3000 // 3 seconds
      }
    };

    const loadingStateService = LoadingStateService.getInstance(notificationService, loadingStateConfig);

    const delegationConfig: DelegationConfig = {
      maxDelegationsPerAddress: 10,
      minDelegationAmount: 1n,
      maxDelegationPercentage: 100,
      lockPeriod: 3600, // 1 hour in seconds
      cooldownPeriod: 86400 // 24 hours in seconds
    };

    const votingPowerService = VotingPowerService.getInstance(loadingStateService, delegationConfig);
    const proposalQuorumService = ProposalQuorumService.getInstance(votingPowerService, loadingStateService);
    
    const service = new OracleService(
      walletConnector,
      keyManager,
      votingPowerService,
      proposalQuorumService
    );
    setOracleService(service);
  }, [walletConnector, keyManager]);

  const handleSubmitData = async () => {
    if (!oracleService || !selectedSource || !newValue) return;

    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      await oracleService.submitData({
        timestamp,
        value: newValue,
        source: selectedSource
      });
      
      setNewValue('');
      await loadOracleData();
    } catch (err) {
      setError('Failed to submit oracle data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOracleData = async () => {
    if (!oracleService || !selectedSource) return;

    try {
      setLoading(true);
      const sourceData = oracleService['dataCache'].get(selectedSource) || [];
      setHistoricalData(sourceData);
      if (sourceData.length > 0) {
        setOracleData(sourceData[sourceData.length - 1]);
      }
    } catch (err) {
      setError('Failed to load oracle data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (dataId: string, vote: boolean) => {
    if (!oracleService) return;

    try {
      setLoading(true);
      await oracleService.voteOnData(dataId, vote);
      await loadOracleData();
    } catch (err) {
      setError('Failed to vote on data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSource) {
      loadOracleData();
    }
  }, [selectedSource]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Oracle Dashboard</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Select Oracle Source</h2>
        <input
          type="text"
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          placeholder="Enter oracle source"
          className="border p-2 rounded mr-4"
        />
      </div>

      {selectedSource && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Submit New Data</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Enter value"
              className="border p-2 rounded"
            />
            <button
              onClick={handleSubmitData}
              disabled={!newValue || loading}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Submit Data
            </button>
          </div>
        </div>
      )}

      {selectedSource && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Oracle Data</h2>
          {oracleData ? (
            <div className="border p-4 rounded">
              <p>Value: {oracleData.value}</p>
              <p>Status: {oracleData.status}</p>
              <p>Timestamp: {new Date(oracleData.timestamp).toLocaleString()}</p>
              <div className="mt-2">
                <p>Votes:</p>
                <p>For: {oracleData.votes.for.toString()}</p>
                <p>Against: {oracleData.votes.against.toString()}</p>
              </div>
              {oracleData.status === 'pending' && (
                <div className="mt-4">
                  <button
                    onClick={() => handleVote(oracleData.id, true)}
                    className="bg-green-500 text-white px-3 py-1 rounded mr-2"
                  >
                    Vote For
                  </button>
                  <button
                    onClick={() => handleVote(oracleData.id, false)}
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Vote Against
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p>No data available</p>
          )}
        </div>
      )}

      {selectedSource && historicalData.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Historical Data</h2>
          <div className="space-y-4">
            {historicalData.map((data) => (
              <div key={data.id} className="border p-4 rounded">
                <p>Value: {data.value}</p>
                <p>Status: {data.status}</p>
                <p>Timestamp: {new Date(data.timestamp).toLocaleString()}</p>
                <p>For: {data.votes.for.toString()}</p>
                <p>Against: {data.votes.against.toString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 