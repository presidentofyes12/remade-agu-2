import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { KnowledgeDomainService } from '../services/knowledgeDomain';
import { IdeaRegistryService } from '../services/ideaRegistry';
import { ProposalService } from '../services/proposalService';
import { DomainAnalytics } from '../types/contracts';

interface AnalyticsDashboardProps {
  provider: ethers.Provider;
  signer?: ethers.Signer;
}

interface DashboardMetrics {
  totalProposals: bigint;
  activeProposals: bigint;
  totalIdeas: bigint;
  totalDomains: bigint;
  totalRoyaltiesDistributed: bigint;
  averageInnovationScore: number;
  averageRelevanceScore: number;
  crossDomainInnovations: bigint;
}

interface DomainPerformance {
  domainId: bigint;
  name: string;
  innovationScore: number;
  relevanceScore: number;
  activeProposals: bigint;
  totalContributions: bigint;
  crossDomainInnovations: bigint;
}

interface IdeaPerformance {
  ideaId: bigint;
  title: string;
  similarityScore: number;
  royaltyRate: number;
  totalDistributed: bigint;
  lastDistribution: number;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  provider,
  signer
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [domainPerformance, setDomainPerformance] = useState<DomainPerformance[]>([]);
  const [ideaPerformance, setIdeaPerformance] = useState<IdeaPerformance[]>([]);
  const [loading, setLoading] = useState(true);
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

  const proposalService = ProposalService.getInstance(
    process.env.REACT_APP_TOKEN_ADDRESS || '',
    process.env.REACT_APP_LOGIC_ADDRESS || '',
    process.env.REACT_APP_STATE_ADDRESS || '',
    process.env.REACT_APP_VIEW_ADDRESS || '',
    provider,
    signer
  );

  useEffect(() => {
    loadAnalytics();
    setupEventListeners();
    return () => {
      // Cleanup event listeners
      knowledgeDomainService.off('DomainUpdated', handleDomainUpdate);
      knowledgeDomainService.off('DomainContribution', handleDomainContribution);
      ideaRegistryService.off('RoyaltyDistributed', handleRoyaltyDistribution);
      proposalService.off('ProposalCreated', handleProposalCreated);
      proposalService.off('ProposalExecuted', handleProposalExecuted);
    };
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load domain performance
      const domainCount = await knowledgeDomainService.getDomainCount();
      const domainMetrics: DomainPerformance[] = [];
      
      for (let i = 0; i < Number(domainCount); i++) {
        const domainId = BigInt(i);
        const domain = await knowledgeDomainService.getDomain(domainId);
        const analytics = await knowledgeDomainService.getDomainAnalytics(domainId);
        
        domainMetrics.push({
          domainId,
          name: domain.name,
          innovationScore: domain.innovationScore,
          relevanceScore: domain.relevanceScore,
          activeProposals: domain.activeProposals,
          totalContributions: domain.totalContributions,
          crossDomainInnovations: analytics.crossDomainInnovations
        });
      }

      // Load idea performance
      const ideaCount = await ideaRegistryService.getIdeaCount();
      const ideaMetrics: IdeaPerformance[] = [];
      
      for (let i = 0; i < Number(ideaCount); i++) {
        const idea = await ideaRegistryService.getIdea(BigInt(i));
        ideaMetrics.push({
          ideaId: idea.id,
          title: idea.title,
          similarityScore: idea.similarityScore,
          royaltyRate: idea.royaltyRate,
          totalDistributed: idea.totalDistributed,
          lastDistribution: idea.lastDistribution
        });
      }

      // Calculate overall metrics
      const totalProposals = await proposalService.getProposalCount();
      const activeProposals = domainMetrics.reduce(
        (acc, domain) => acc + domain.activeProposals,
        BigInt(0)
      );
      const totalRoyaltiesDistributed = ideaMetrics.reduce(
        (acc, idea) => acc + idea.totalDistributed,
        BigInt(0)
      );
      const averageInnovationScore = domainMetrics.reduce(
        (acc, domain) => acc + domain.innovationScore,
        0
      ) / domainMetrics.length;
      const averageRelevanceScore = domainMetrics.reduce(
        (acc, domain) => acc + domain.relevanceScore,
        0
      ) / domainMetrics.length;
      const crossDomainInnovations = domainMetrics.reduce(
        (acc, domain) => acc + domain.crossDomainInnovations,
        BigInt(0)
      );

      setMetrics({
        totalProposals,
        activeProposals,
        totalIdeas: ideaCount,
        totalDomains: domainCount,
        totalRoyaltiesDistributed,
        averageInnovationScore,
        averageRelevanceScore,
        crossDomainInnovations
      });

      setDomainPerformance(domainMetrics);
      setIdeaPerformance(ideaMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleDomainUpdate = () => loadAnalytics();
  const handleDomainContribution = () => loadAnalytics();
  const handleRoyaltyDistribution = () => loadAnalytics();
  const handleProposalCreated = () => loadAnalytics();
  const handleProposalExecuted = () => loadAnalytics();

  const setupEventListeners = () => {
    knowledgeDomainService.on('DomainUpdated', handleDomainUpdate);
    knowledgeDomainService.on('DomainContribution', handleDomainContribution);
    ideaRegistryService.on('RoyaltyDistributed', handleRoyaltyDistribution);
    proposalService.on('ProposalCreated', handleProposalCreated);
    proposalService.on('ProposalExecuted', handleProposalExecuted);
  };

  if (loading) {
    return <div>Loading analytics...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!metrics) {
    return <div>No analytics data available</div>;
  }

  return (
    <div className="analytics-dashboard">
      <h2>DAO Analytics Dashboard</h2>

      <div className="metrics-overview">
        <h3>Overview</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <h4>Total Proposals</h4>
            <p>{metrics.totalProposals.toString()}</p>
          </div>
          <div className="metric-card">
            <h4>Active Proposals</h4>
            <p>{metrics.activeProposals.toString()}</p>
          </div>
          <div className="metric-card">
            <h4>Total Ideas</h4>
            <p>{metrics.totalIdeas.toString()}</p>
          </div>
          <div className="metric-card">
            <h4>Total Domains</h4>
            <p>{metrics.totalDomains.toString()}</p>
          </div>
          <div className="metric-card">
            <h4>Total Royalties Distributed</h4>
            <p>{metrics.totalRoyaltiesDistributed.toString()}</p>
          </div>
          <div className="metric-card">
            <h4>Average Innovation Score</h4>
            <p>{metrics.averageInnovationScore.toFixed(2)}</p>
          </div>
          <div className="metric-card">
            <h4>Average Relevance Score</h4>
            <p>{metrics.averageRelevanceScore.toFixed(2)}</p>
          </div>
          <div className="metric-card">
            <h4>Cross-Domain Innovations</h4>
            <p>{metrics.crossDomainInnovations.toString()}</p>
          </div>
        </div>
      </div>

      <div className="domain-performance">
        <h3>Domain Performance</h3>
        <div className="performance-table">
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Innovation Score</th>
                <th>Relevance Score</th>
                <th>Active Proposals</th>
                <th>Total Contributions</th>
                <th>Cross-Domain Innovations</th>
              </tr>
            </thead>
            <tbody>
              {domainPerformance.map(domain => (
                <tr key={domain.domainId.toString()}>
                  <td>{domain.name}</td>
                  <td>{domain.innovationScore.toFixed(2)}</td>
                  <td>{domain.relevanceScore.toFixed(2)}</td>
                  <td>{domain.activeProposals.toString()}</td>
                  <td>{domain.totalContributions.toString()}</td>
                  <td>{domain.crossDomainInnovations.toString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="idea-performance">
        <h3>Idea Performance</h3>
        <div className="performance-table">
          <table>
            <thead>
              <tr>
                <th>Idea</th>
                <th>Similarity Score</th>
                <th>Royalty Rate</th>
                <th>Total Distributed</th>
                <th>Last Distribution</th>
              </tr>
            </thead>
            <tbody>
              {ideaPerformance.map(idea => (
                <tr key={idea.ideaId.toString()}>
                  <td>{idea.title}</td>
                  <td>{idea.similarityScore.toFixed(2)}</td>
                  <td>{(idea.royaltyRate * 100).toFixed(1)}%</td>
                  <td>{idea.totalDistributed.toString()}</td>
                  <td>{new Date(idea.lastDistribution).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}; 