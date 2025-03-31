import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { PrivacyService } from '../services/privacyService';
import { KeyRotationService } from '../services/keyRotationService';
import { KeyPair, SecondaryKeyMapping, IdentityResolutionProposal, PrivacyEvents } from '../types/privacy';

interface PrivacyManagementProps {
  provider: ethers.Provider;
  signer?: ethers.Signer;
}

interface KeyManagementFormData {
  targetUserHash: string;
}

interface IdentityResolutionFormData {
  targetUserHash: string;
  requestedInformation: string[];
  justification: string;
  duration: bigint;
}

export const PrivacyManagement: React.FC<PrivacyManagementProps> = ({
  provider,
  signer
}) => {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [secondaryKeys, setSecondaryKeys] = useState<SecondaryKeyMapping[]>([]);
  const [proposals, setProposals] = useState<IdentityResolutionProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyForm, setKeyForm] = useState<KeyManagementFormData>({
    targetUserHash: ''
  });
  const [resolutionForm, setResolutionForm] = useState<IdentityResolutionFormData>({
    targetUserHash: '',
    requestedInformation: [],
    justification: '',
    duration: BigInt(86400) // 24 hours
  });

  const privacyService = PrivacyService.getInstance(
    process.env.REACT_APP_LOGIC_ADDRESS || '',
    process.env.REACT_APP_STATE_ADDRESS || '',
    process.env.REACT_APP_VIEW_ADDRESS || '',
    {
      keyExpirationPeriod: BigInt(86400 * 30), // 30 days
      proposalVotingPeriod: BigInt(86400 * 7), // 7 days
      minVotingPower: BigInt(100),
      maxRequestedInformation: 5,
      allowedInformationTypes: ['identity', 'reputation', 'transaction_history']
    },
    provider,
    signer
  );

  const keyRotationService = KeyRotationService.getInstance(privacyService, {
    rotationPeriod: BigInt(86400 * 30), // 30 days
    warningPeriod: BigInt(86400 * 7), // 7 days
    maxActiveKeys: 5
  });

  useEffect(() => {
    setupEventListeners();
    loadInitialData();
    return () => {
      // Cleanup event listeners
      privacyService.off('SecondaryKeyCreated', handleSecondaryKeyCreated);
      privacyService.off('IdentityResolutionProposed', handleIdentityResolutionProposed);
      privacyService.off('IdentityResolutionApproved', handleIdentityResolutionApproved);
      privacyService.off('IdentityResolutionRejected', handleIdentityResolutionRejected);
      privacyService.off('IdentityResolutionExecuted', handleIdentityResolutionExecuted);
      privacyService.off('KeyMappingUpdated', handleKeyMappingUpdated);
      // Cleanup key rotation service
      keyRotationService.cleanup();
    };
  }, []);

  const setupEventListeners = () => {
    privacyService.on('SecondaryKeyCreated', handleSecondaryKeyCreated);
    privacyService.on('IdentityResolutionProposed', handleIdentityResolutionProposed);
    privacyService.on('IdentityResolutionApproved', handleIdentityResolutionApproved);
    privacyService.on('IdentityResolutionRejected', handleIdentityResolutionRejected);
    privacyService.on('IdentityResolutionExecuted', handleIdentityResolutionExecuted);
    privacyService.on('KeyMappingUpdated', handleKeyMappingUpdated);
  };

  const handleSecondaryKeyCreated = async (event: PrivacyEvents['SecondaryKeyCreated']) => {
    await loadSecondaryKeys();
  };

  const handleIdentityResolutionProposed = async (event: PrivacyEvents['IdentityResolutionProposed']) => {
    await loadProposals();
  };

  const handleIdentityResolutionApproved = async (event: PrivacyEvents['IdentityResolutionApproved']) => {
    await loadProposals();
  };

  const handleIdentityResolutionRejected = async (event: PrivacyEvents['IdentityResolutionRejected']) => {
    await loadProposals();
  };

  const handleIdentityResolutionExecuted = async (event: PrivacyEvents['IdentityResolutionExecuted']) => {
    await loadProposals();
  };

  const handleKeyMappingUpdated = async (event: PrivacyEvents['KeyMappingUpdated']) => {
    await loadSecondaryKeys();
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        generateKeyPair(),
        loadSecondaryKeys(),
        loadProposals()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const generateKeyPair = async () => {
    try {
      const newKeyPair = await privacyService.generateKeyPair();
      setKeyPair(newKeyPair);
      // Initialize key rotation for the new key pair
      await keyRotationService.initializeKeyRotation(newKeyPair);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key pair');
    }
  };

  const loadSecondaryKeys = async () => {
    try {
      if (!keyPair) return;
      // In a real implementation, you would fetch a list of secondary keys
      // For now, we'll just show a placeholder
      setSecondaryKeys([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load secondary keys');
    }
  };

  const loadProposals = async () => {
    try {
      // In a real implementation, you would fetch a list of proposals
      // For now, we'll just show a placeholder
      setProposals([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
    }
  };

  const handleCreateSecondaryKey = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!keyPair) {
        throw new Error('No key pair available');
      }
      await privacyService.createSecondaryKey(
        ethers.keccak256(ethers.toUtf8Bytes(keyPair.publicKey)),
        keyForm.targetUserHash
      );
      setKeyForm({ targetUserHash: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create secondary key');
    } finally {
      setLoading(false);
    }
  };

  const handleProposeIdentityResolution = async () => {
    try {
      setLoading(true);
      setError(null);
      await privacyService.proposeIdentityResolution(
        resolutionForm.targetUserHash,
        resolutionForm.requestedInformation,
        resolutionForm.justification,
        resolutionForm.duration
      );
      setResolutionForm({
        targetUserHash: '',
        requestedInformation: [],
        justification: '',
        duration: BigInt(86400)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to propose identity resolution');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteOnProposal = async (proposalId: string, support: boolean) => {
    try {
      setLoading(true);
      setError(null);
      await privacyService.voteOnIdentityResolution(proposalId, support);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to vote on proposal');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteProposal = async (proposalId: string) => {
    try {
      setLoading(true);
      setError(null);
      await privacyService.executeIdentityResolution(proposalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute proposal');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading privacy management system...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="privacy-management">
      <h2>Privacy Management System</h2>

      <div className="key-management-section">
        <h3>Key Management</h3>
        {keyPair ? (
          <div className="key-info">
            <p>Public Key: {keyPair.publicKey}</p>
            <div className="key-form">
              <input
                type="text"
                value={keyForm.targetUserHash}
                onChange={e => setKeyForm({ ...keyForm, targetUserHash: e.target.value })}
                placeholder="Enter target user hash"
              />
              <button onClick={handleCreateSecondaryKey}>Create Secondary Key</button>
            </div>
          </div>
        ) : (
          <button onClick={generateKeyPair}>Generate Key Pair</button>
        )}
      </div>

      <div className="secondary-keys-section">
        <h3>Secondary Keys</h3>
        <div className="secondary-keys-list">
          {secondaryKeys.map(key => (
            <div key={`${key.primaryKeyHash}:${key.secondaryKeyHash}`} className="secondary-key">
              <p>Primary Key Hash: {key.primaryKeyHash}</p>
              <p>Secondary Key Hash: {key.secondaryKeyHash}</p>
              <p>Created: {new Date(Number(key.createdAt)).toLocaleString()}</p>
              <p>Expires: {new Date(Number(key.expiresAt)).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="identity-resolution-section">
        <h3>Identity Resolution</h3>
        <div className="resolution-form">
          <input
            type="text"
            value={resolutionForm.targetUserHash}
            onChange={e => setResolutionForm({ ...resolutionForm, targetUserHash: e.target.value })}
            placeholder="Enter target user hash"
          />
          <select
            multiple
            value={resolutionForm.requestedInformation}
            onChange={e => {
              const options = e.target.options;
              const selected = [];
              for (let i = 0; i < options.length; i++) {
                if (options[i].selected) {
                  selected.push(options[i].value);
                }
              }
              setResolutionForm({ ...resolutionForm, requestedInformation: selected });
            }}
          >
            <option value="identity">Identity</option>
            <option value="reputation">Reputation</option>
            <option value="transaction_history">Transaction History</option>
          </select>
          <textarea
            value={resolutionForm.justification}
            onChange={e => setResolutionForm({ ...resolutionForm, justification: e.target.value })}
            placeholder="Enter justification"
          />
          <input
            type="number"
            value={resolutionForm.duration.toString()}
            onChange={e => setResolutionForm({ ...resolutionForm, duration: BigInt(e.target.value) })}
            placeholder="Duration in seconds"
          />
          <button onClick={handleProposeIdentityResolution}>Propose Resolution</button>
        </div>

        <div className="proposals-list">
          <h4>Active Proposals</h4>
          {proposals.map(proposal => (
            <div key={proposal.proposalId} className="proposal">
              <p>Target User: {proposal.targetUserHash}</p>
              <p>Requested Information: {proposal.requestedInformation.join(', ')}</p>
              <p>Justification: {proposal.justification}</p>
              <p>Status: {proposal.status}</p>
              <p>Created: {new Date(Number(proposal.createdAt)).toLocaleString()}</p>
              <p>Expires: {new Date(Number(proposal.expiresAt)).toLocaleString()}</p>
              <p>Votes: For {proposal.votes.for.toString()}, Against {proposal.votes.against.toString()}</p>
              {proposal.status === 'pending' && (
                <div className="proposal-actions">
                  <button onClick={() => handleVoteOnProposal(proposal.proposalId, true)}>Vote For</button>
                  <button onClick={() => handleVoteOnProposal(proposal.proposalId, false)}>Vote Against</button>
                </div>
              )}
              {proposal.status === 'approved' && (
                <button onClick={() => handleExecuteProposal(proposal.proposalId)}>Execute Resolution</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 