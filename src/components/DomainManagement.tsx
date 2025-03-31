import React, { useEffect, useState } from 'react';
import { KnowledgeDomainService } from '../services/knowledgeDomain';
import { ethers } from 'ethers';

interface DomainManagementProps {
  provider: ethers.Provider;
  signer?: ethers.Signer;
}

interface Domain {
  id: bigint;
  name: string;
  description: string;
  parentId: bigint | null;
  relevanceScore: number;
  innovationScore: number;
  contributionThreshold: bigint;
  totalContributions: bigint;
  activeProposals: bigint;
  timestamp: bigint;
}

interface NewDomain {
  name: string;
  description: string;
  parentId: bigint | null;
}

export const DomainManagement: React.FC<DomainManagementProps> = ({
  provider,
  signer
}) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState<NewDomain>({ name: '', description: '', parentId: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knowledgeDomainService = KnowledgeDomainService.getInstance(
    process.env.REACT_APP_LOGIC_ADDRESS || '',
    {
      minRelevanceScore: 0,
      maxRelevanceScore: 1,
      minInnovationScore: 0,
      maxInnovationScore: 1,
      defaultContributionThreshold: BigInt(1000),
      analyticsUpdateInterval: 300000
    },
    provider,
    signer
  );

  useEffect(() => {
    loadDomains();
    setupEventListeners();
    return () => {
      // Cleanup event listeners
      knowledgeDomainService.off('DomainRegistered', handleDomainRegistered);
      knowledgeDomainService.off('DomainUpdated', handleDomainUpdated);
    };
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const domainCount = await knowledgeDomainService.getDomainCount();
      const loadedDomains: Domain[] = [];
      
      for (let i = 0; i < Number(domainCount); i++) {
        const domain = await knowledgeDomainService.getDomain(BigInt(i));
        loadedDomains.push(domain);
      }
      
      setDomains(loadedDomains);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  const handleDomainRegistered = async (event: any) => {
    const domain = await knowledgeDomainService.getDomain(event.domainId);
    setDomains(prev => [...prev, domain]);
  };

  const handleDomainUpdated = async (event: any) => {
    const domain = await knowledgeDomainService.getDomain(event.domainId);
    setDomains(prev => prev.map(d => d.id === domain.id ? domain : d));
  };

  const setupEventListeners = () => {
    knowledgeDomainService.on('DomainRegistered', handleDomainRegistered);
    knowledgeDomainService.on('DomainUpdated', handleDomainUpdated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      await knowledgeDomainService.registerDomain(
        newDomain.name,
        newDomain.description,
        newDomain.parentId
      );
      
      setNewDomain({ name: '', description: '', parentId: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register domain');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateScores = async (domainId: bigint, relevanceScore: number, innovationScore: number) => {
    try {
      setLoading(true);
      setError(null);
      
      await knowledgeDomainService.updateDomainScores(
        domainId,
        relevanceScore,
        innovationScore
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update domain scores');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="domain-management">
      <h2>Knowledge Domain Management</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="domain-form">
        <div className="form-group">
          <label htmlFor="name">Domain Name</label>
          <input
            type="text"
            id="name"
            value={newDomain.name}
            onChange={e => setNewDomain(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={newDomain.description}
            onChange={e => setNewDomain(prev => ({ ...prev, description: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="parentId">Parent Domain (Optional)</label>
          <select
            id="parentId"
            value={newDomain.parentId !== null ? newDomain.parentId.toString() : ''}
            onChange={e => setNewDomain(prev => ({
              ...prev,
              parentId: e.target.value ? BigInt(e.target.value) : null
            }))}
          >
            <option value="">None</option>
            {domains.map(domain => (
              <option key={domain.id.toString()} value={domain.id.toString()}>
                {domain.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading}>
          Register Domain
        </button>
      </form>

      <div className="domains-list">
        <h3>Registered Domains</h3>
        {domains.map(domain => (
          <div key={domain.id.toString()} className="domain-card">
            <h4>{domain.name}</h4>
            <p>{domain.description}</p>
            <div className="domain-metrics">
              <div>
                <strong>Relevance Score:</strong> {domain.relevanceScore}
              </div>
              <div>
                <strong>Innovation Score:</strong> {domain.innovationScore}
              </div>
              <div>
                <strong>Active Proposals:</strong> {domain.activeProposals.toString()}
              </div>
              <div>
                <strong>Total Contributions:</strong> {domain.totalContributions.toString()}
              </div>
            </div>
            <div className="domain-actions">
              <button
                onClick={() => handleUpdateScores(
                  domain.id,
                  Math.min(domain.relevanceScore + 0.1, 1),
                  Math.min(domain.innovationScore + 0.1, 1)
                )}
              >
                Increase Scores
              </button>
              <button
                onClick={() => handleUpdateScores(
                  domain.id,
                  Math.max(domain.relevanceScore - 0.1, 0),
                  Math.max(domain.innovationScore - 0.1, 0)
                )}
              >
                Decrease Scores
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 