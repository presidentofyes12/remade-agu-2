import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { InformationVerificationService } from '../services/informationVerification';
import { InformationItem, InformationSource, AdViewingPreferences } from '../types/informationVerification';

interface InformationVerificationProps {
  provider: ethers.Provider;
  signer?: ethers.Signer;
}

interface InformationFormData {
  content: string;
  sourceId: string;
  verificationLevel: 'local' | 'regional' | 'global';
}

interface ViewingPreferencesFormData {
  baseRate: bigint;
  categoryRates: Map<string, bigint>;
}

export const InformationVerification: React.FC<InformationVerificationProps> = ({
  provider,
  signer
}) => {
  const [information, setInformation] = useState<InformationItem[]>([]);
  const [sources, setSources] = useState<InformationSource[]>([]);
  const [preferences, setPreferences] = useState<AdViewingPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [informationForm, setInformationForm] = useState<InformationFormData>({
    content: '',
    sourceId: '',
    verificationLevel: 'local'
  });
  const [preferencesForm, setPreferencesForm] = useState<ViewingPreferencesFormData>({
    baseRate: BigInt(0),
    categoryRates: new Map()
  });

  const informationVerificationService = InformationVerificationService.getInstance(
    process.env.REACT_APP_LOGIC_ADDRESS || '',
    process.env.REACT_APP_STATE_ADDRESS || '',
    process.env.REACT_APP_VIEW_ADDRESS || '',
    {
      minReliabilityScore: 50,
      verificationThresholds: {
        local: 50,
        regional: 70,
        global: 90
      },
      stakeRequirements: {
        local: BigInt(100),
        regional: BigInt(500),
        global: BigInt(1000)
      },
      verificationCooldown: BigInt(86400), // 24 hours
      maxDistributionScope: ['local', 'regional', 'global']
    },
    provider,
    signer
  );

  useEffect(() => {
    setupEventListeners();
    loadInitialData();
    return () => {
      // Cleanup event listeners
      informationVerificationService.off('InformationSubmitted', handleInformationSubmitted);
      informationVerificationService.off('InformationVerified', handleInformationVerified);
      informationVerificationService.off('InformationRejected', handleInformationRejected);
      informationVerificationService.off('ViewingPreferencesUpdated', handleViewingPreferencesUpdated);
      informationVerificationService.off('AdStakeUpdated', handleAdStakeUpdated);
    };
  }, []);

  const setupEventListeners = () => {
    informationVerificationService.on('InformationSubmitted', handleInformationSubmitted);
    informationVerificationService.on('InformationVerified', handleInformationVerified);
    informationVerificationService.on('InformationRejected', handleInformationRejected);
    informationVerificationService.on('ViewingPreferencesUpdated', handleViewingPreferencesUpdated);
    informationVerificationService.on('AdStakeUpdated', handleAdStakeUpdated);
  };

  const handleInformationSubmitted = async (event: any) => {
    await loadInformation();
  };

  const handleInformationVerified = async (event: any) => {
    await loadInformation();
  };

  const handleInformationRejected = async (event: any) => {
    await loadInformation();
  };

  const handleViewingPreferencesUpdated = async (event: any) => {
    await loadPreferences();
  };

  const handleAdStakeUpdated = async (event: any) => {
    await loadPreferences();
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadInformation(),
        loadSources(),
        loadPreferences()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const loadInformation = async () => {
    try {
      // In a real implementation, you would fetch a list of information items
      // For now, we'll just show a placeholder
      setInformation([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load information');
    }
  };

  const loadSources = async () => {
    try {
      // In a real implementation, you would fetch a list of sources
      // For now, we'll just show a placeholder
      setSources([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    }
  };

  const loadPreferences = async () => {
    try {
      if (!signer) return;
      const address = await signer.getAddress();
      const preferences = await informationVerificationService.getViewingPreferences(address);
      setPreferences(preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    }
  };

  const handleSubmitInformation = async () => {
    try {
      setLoading(true);
      setError(null);
      await informationVerificationService.submitInformation(
        informationForm.content,
        informationForm.sourceId,
        informationForm.verificationLevel
      );
      setInformationForm({
        content: '',
        sourceId: '',
        verificationLevel: 'local'
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit information');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      await informationVerificationService.updateViewingPreferences(
        preferencesForm.baseRate,
        preferencesForm.categoryRates
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading information verification system...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="information-verification">
      <h2>Information Verification System</h2>

      <div className="information-section">
        <h3>Submit Information</h3>
        <div className="information-form">
          <textarea
            value={informationForm.content}
            onChange={e => setInformationForm({ ...informationForm, content: e.target.value })}
            placeholder="Enter information content"
          />
          <select
            value={informationForm.sourceId}
            onChange={e => setInformationForm({ ...informationForm, sourceId: e.target.value })}
          >
            <option value="">Select source</option>
            {sources.map(source => (
              <option key={source.sourceId} value={source.sourceId}>
                {source.sourceId} (Score: {source.reliabilityScore})
              </option>
            ))}
          </select>
          <select
            value={informationForm.verificationLevel}
            onChange={e => setInformationForm({ ...informationForm, verificationLevel: e.target.value as any })}
          >
            <option value="local">Local</option>
            <option value="regional">Regional</option>
            <option value="global">Global</option>
          </select>
          <button onClick={handleSubmitInformation}>Submit Information</button>
        </div>
      </div>

      <div className="preferences-section">
        <h3>Viewing Preferences</h3>
        {preferences ? (
          <div className="preferences-info">
            <p>Base Rate: {preferences.baseRate.toString()}</p>
            <div className="category-rates">
              <h4>Category Rates</h4>
              {Array.from(preferences.categoryRates.entries() as Iterable<[string, bigint]>).map(([category, rate]) => (
                <div key={category} className="category-rate">
                  <span>{category}</span>
                  <input
                    type="number"
                    value={rate.toString()}
                    onChange={e => {
                      const newRates = new Map(preferencesForm.categoryRates);
                      newRates.set(category, BigInt(e.target.value));
                      setPreferencesForm({ ...preferencesForm, categoryRates: newRates });
                    }}
                  />
                </div>
              ))}
            </div>
            <button onClick={handleUpdatePreferences}>Update Preferences</button>
          </div>
        ) : (
          <p>No preferences found</p>
        )}
      </div>

      <div className="information-list">
        <h3>Verified Information</h3>
        <div className="information-items">
          {information.map(item => (
            <div key={item.itemId} className="information-item">
                <p>Content: {item.content}</p>
                <p>Source: {item.source.sourceId}</p>
                <p>Verification Level: {item.verificationLevel}</p>
                <p>Status: {item.verificationStatus}</p>
                <p>Created: {new Date(Number(item.createdAt)).toLocaleString()}</p>
                {item.verifiedAt !== undefined && (
                  <p>Verified: {new Date(Number(item.verifiedAt.toString())).toLocaleString()}</p>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}; 