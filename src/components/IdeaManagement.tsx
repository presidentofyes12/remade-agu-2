import React, { useEffect, useState } from 'react';
import { IdeaRegistryService } from '../services/ideaRegistry';
import { KnowledgeDomainService } from '../services/knowledgeDomain';
import { ethers } from 'ethers';

interface IdeaManagementProps {
  provider: ethers.Provider;
  signer?: ethers.Signer;
}

interface Idea {
  id: bigint;
  title: string;
  description: string;
  creator: string;
  hash: string;
  timestamp: bigint;
  similarityScore: number;
  royaltyRate: number;
  lastDistribution: number;
  totalDistributed: bigint;
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

export const IdeaManagement: React.FC<IdeaManagementProps> = ({
  provider,
  signer
}) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newIdea, setNewIdea] = useState({ title: '', description: '', hash: '' });
  const [selectedDomain, setSelectedDomain] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ideaRegistryService = IdeaRegistryService.getInstance(
    process.env.REACT_APP_LOGIC_ADDRESS || '',
    {
      minRoyaltyRate: 0.01,
      maxRoyaltyRate: 0.1,
      minSimilarityThreshold: 0.5,
      maxSimilarityThreshold: 1.0,
      analyticsUpdateInterval: 300000
    },
    provider,
    signer
  );

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
    loadIdeas();
    loadDomains();
    setupEventListeners();
    return () => {
      // Cleanup event listeners
      ideaRegistryService.off('IdeaRegistered', handleIdeaRegistered);
      ideaRegistryService.off('IdeaReused', handleIdeaReused);
      ideaRegistryService.off('RoyaltyDistributed', handleRoyaltyDistributed);
    };
  }, []);

  const loadIdeas = async () => {
    try {
      setLoading(true);
      const ideaCount = await ideaRegistryService.getIdeaCount();
      const loadedIdeas: Idea[] = [];
      
      for (let i = 0; i < Number(ideaCount); i++) {
        const idea = await ideaRegistryService.getIdea(BigInt(i));
        loadedIdeas.push(idea);
      }
      
      setIdeas(loadedIdeas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ideas');
    } finally {
      setLoading(false);
    }
  };

  const loadDomains = async () => {
    try {
      const domainCount = await knowledgeDomainService.getDomainCount();
      const loadedDomains: Domain[] = [];
      
      for (let i = 0; i < Number(domainCount); i++) {
        const domain = await knowledgeDomainService.getDomain(BigInt(i));
        loadedDomains.push(domain);
      }
      
      setDomains(loadedDomains);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains');
    }
  };

  const handleIdeaRegistered = async (event: any) => {
    const idea = await ideaRegistryService.getIdea(event.ideaId);
    setIdeas(prev => [...prev, idea]);
  };

  const handleIdeaReused = async (event: any) => {
    const [originalIdea, newIdea] = await Promise.all([
      ideaRegistryService.getIdea(event.originalIdeaId),
      ideaRegistryService.getIdea(event.newIdeaId)
    ]);
    
    setIdeas(prev => prev.map(i => 
      i.id === originalIdea.id ? originalIdea : 
      i.id === newIdea.id ? newIdea : i
    ));
  };

  const handleRoyaltyDistributed = async (event: any) => {
    const idea = await ideaRegistryService.getIdea(event.ideaId);
    setIdeas(prev => prev.map(i => i.id === idea.id ? idea : i));
  };

  const setupEventListeners = () => {
    ideaRegistryService.on('IdeaRegistered', handleIdeaRegistered);
    ideaRegistryService.on('IdeaReused', handleIdeaReused);
    ideaRegistryService.on('RoyaltyDistributed', handleRoyaltyDistributed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      const idea = await ideaRegistryService.registerIdea(
        newIdea.title,
        newIdea.description,
        newIdea.hash
      );
      
      if (selectedDomain) {
        await knowledgeDomainService.mapProposalToDomain(
          idea.id,
          selectedDomain,
          true
        );
      }
      
      setNewIdea({ title: '', description: '', hash: '' });
      setSelectedDomain(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register idea');
    } finally {
      setLoading(false);
    }
  };

  const handleDistributeRoyalties = async (ideaId: bigint) => {
    try {
      setLoading(true);
      setError(null);
      
      await ideaRegistryService.distributeRoyalties(ideaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to distribute royalties');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRoyaltyRate = async (ideaId: bigint, newRate: number) => {
    try {
      setLoading(true);
      setError(null);
      
      await ideaRegistryService.updateRoyaltyRate(ideaId, newRate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update royalty rate');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="idea-management">
      <h2>Idea Management</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="idea-form">
        <div className="form-group">
          <label htmlFor="title">Idea Title</label>
          <input
            type="text"
            id="title"
            value={newIdea.title}
            onChange={e => setNewIdea(prev => ({ ...prev, title: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={newIdea.description}
            onChange={e => setNewIdea(prev => ({ ...prev, description: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="hash">Content Hash</label>
          <input
            type="text"
            id="hash"
            value={newIdea.hash}
            onChange={e => setNewIdea(prev => ({ ...prev, hash: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="domain">Knowledge Domain (Optional)</label>
          <select
            id="domain"
            value={selectedDomain?.toString() || ''}
            onChange={e => setSelectedDomain(e.target.value ? BigInt(e.target.value) : null)}
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
          Register Idea
        </button>
      </form>

      <div className="ideas-list">
        <h3>Registered Ideas</h3>
        {ideas.map(idea => (
          <div key={idea.id.toString()} className="idea-card">
            <h4>{idea.title}</h4>
            <p>{idea.description}</p>
            <div className="idea-metrics">
              <div>
                <strong>Creator:</strong> {idea.creator}
              </div>
              <div>
                <strong>Similarity Score:</strong> {idea.similarityScore}
              </div>
              <div>
                <strong>Royalty Rate:</strong> {idea.royaltyRate}
              </div>
              <div>
                <strong>Total Distributed:</strong> {idea.totalDistributed.toString()}
              </div>
            </div>
            <div className="idea-actions">
              <button
                onClick={() => handleDistributeRoyalties(idea.id)}
              >
                Distribute Royalties
              </button>
              <button
                onClick={() => handleUpdateRoyaltyRate(
                  idea.id,
                  Math.min(idea.royaltyRate + 0.01, 0.1)
                )}
              >
                Increase Royalty Rate
              </button>
              <button
                onClick={() => handleUpdateRoyaltyRate(
                  idea.id,
                  Math.max(idea.royaltyRate - 0.01, 0.01)
                )}
              >
                Decrease Royalty Rate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 