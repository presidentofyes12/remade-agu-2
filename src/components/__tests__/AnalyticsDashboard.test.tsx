import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnalyticsDashboard } from '../AnalyticsDashboard';
import { KnowledgeDomainService } from '../../services/knowledgeDomain';
import { IdeaRegistryService } from '../../services/ideaRegistry';
import { ProposalService } from '../../services/proposalService';
import { ethers } from 'ethers';

jest.mock('ethers');
jest.mock('../../services/knowledgeDomain');
jest.mock('../../services/ideaRegistry');
jest.mock('../../services/proposalService');

describe('AnalyticsDashboard', () => {
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockSigner: jest.Mocked<ethers.Signer>;
  let mockKnowledgeDomainService: jest.Mocked<KnowledgeDomainService>;
  let mockIdeaRegistryService: jest.Mocked<IdeaRegistryService>;
  let mockProposalService: jest.Mocked<ProposalService>;

  beforeEach(() => {
    mockProvider = {
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn()
    } as unknown as jest.Mocked<ethers.Provider>;

    mockSigner = {
      getAddress: jest.fn().mockResolvedValue('0x123'),
      signMessage: jest.fn(),
      signTransaction: jest.fn()
    } as unknown as jest.Mocked<ethers.Signer>;

    mockKnowledgeDomainService = {
      getInstance: jest.fn().mockReturnThis(),
      getDomainCount: jest.fn().mockResolvedValue(BigInt(2)),
      getDomain: jest.fn().mockImplementation((id: bigint) => {
        if (id === BigInt(0)) {
          return Promise.resolve({
            id: BigInt(0),
            name: 'Test Domain 1',
            description: 'Test Description 1',
            parentId: null,
            relevanceScore: 0.5,
            innovationScore: 0.5,
            contributionThreshold: BigInt(1000),
            totalContributions: BigInt(0),
            activeProposals: BigInt(1),
            timestamp: BigInt(Date.now())
          });
        }
        if (id === BigInt(1)) {
          return Promise.resolve({
            id: BigInt(1),
            name: 'Test Domain 2',
            description: 'Test Description 2',
            parentId: null,
            relevanceScore: 0.6,
            innovationScore: 0.6,
            contributionThreshold: BigInt(1000),
            totalContributions: BigInt(0),
            activeProposals: BigInt(2),
            timestamp: BigInt(Date.now())
          });
        }
        throw new Error('Domain not found');
      }),
      getDomainAnalytics: jest.fn().mockImplementation((id: bigint) => {
        return Promise.resolve({
          domainId: id,
          totalProposals: BigInt(5),
          activeProposals: BigInt(3),
          totalContributions: BigInt(1000),
          innovationScore: 0.5,
          growthRate: 0.1,
          crossDomainInnovations: BigInt(2)
        });
      }),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<KnowledgeDomainService>;

    mockIdeaRegistryService = {
      getInstance: jest.fn().mockReturnThis(),
      getIdeaCount: jest.fn().mockResolvedValue(BigInt(2)),
      getIdea: jest.fn().mockImplementation((id: bigint) => {
        if (id === BigInt(0)) {
          return Promise.resolve({
            id: BigInt(0),
            title: 'Test Idea 1',
            description: 'Test Description 1',
            creator: '0x123',
            hash: '0xabc',
            timestamp: BigInt(Date.now()),
            similarityScore: 0.8,
            royaltyRate: 0.05,
            lastDistribution: Date.now(),
            totalDistributed: BigInt(1000)
          });
        }
        if (id === BigInt(1)) {
          return Promise.resolve({
            id: BigInt(1),
            title: 'Test Idea 2',
            description: 'Test Description 2',
            creator: '0x456',
            hash: '0xdef',
            timestamp: BigInt(Date.now()),
            similarityScore: 0.9,
            royaltyRate: 0.06,
            lastDistribution: Date.now(),
            totalDistributed: BigInt(2000)
          });
        }
        throw new Error('Idea not found');
      }),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<IdeaRegistryService>;

    mockProposalService = {
      getInstance: jest.fn().mockReturnThis(),
      getProposalCount: jest.fn().mockResolvedValue(BigInt(5)),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<ProposalService>;

    (KnowledgeDomainService.getInstance as jest.Mock).mockReturnValue(mockKnowledgeDomainService);
    (IdeaRegistryService.getInstance as jest.Mock).mockReturnValue(mockIdeaRegistryService);
    (ProposalService.getInstance as jest.Mock).mockReturnValue(mockProposalService);
  });

  it('should load and display overview metrics', async () => {
    render(<AnalyticsDashboard provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Total Proposals
      expect(screen.getByText('3')).toBeInTheDocument(); // Active Proposals
      expect(screen.getByText('2')).toBeInTheDocument(); // Total Ideas
      expect(screen.getByText('2')).toBeInTheDocument(); // Total Domains
      expect(screen.getByText('3000')).toBeInTheDocument(); // Total Royalties Distributed
      expect(screen.getByText('0.55')).toBeInTheDocument(); // Average Innovation Score
      expect(screen.getByText('0.55')).toBeInTheDocument(); // Average Relevance Score
      expect(screen.getByText('4')).toBeInTheDocument(); // Cross-Domain Innovations
    });
  });

  it('should display domain performance table', async () => {
    render(<AnalyticsDashboard provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText('Test Domain 1')).toBeInTheDocument();
      expect(screen.getByText('Test Domain 2')).toBeInTheDocument();
      expect(screen.getByText('0.50')).toBeInTheDocument(); // Innovation Score 1
      expect(screen.getByText('0.60')).toBeInTheDocument(); // Innovation Score 2
      expect(screen.getByText('0.50')).toBeInTheDocument(); // Relevance Score 1
      expect(screen.getByText('0.60')).toBeInTheDocument(); // Relevance Score 2
      expect(screen.getByText('1')).toBeInTheDocument(); // Active Proposals 1
      expect(screen.getByText('2')).toBeInTheDocument(); // Active Proposals 2
    });
  });

  it('should display idea performance table', async () => {
    render(<AnalyticsDashboard provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText('Test Idea 1')).toBeInTheDocument();
      expect(screen.getByText('Test Idea 2')).toBeInTheDocument();
      expect(screen.getByText('0.80')).toBeInTheDocument(); // Similarity Score 1
      expect(screen.getByText('0.90')).toBeInTheDocument(); // Similarity Score 2
      expect(screen.getByText('5.0%')).toBeInTheDocument(); // Royalty Rate 1
      expect(screen.getByText('6.0%')).toBeInTheDocument(); // Royalty Rate 2
      expect(screen.getByText('1000')).toBeInTheDocument(); // Total Distributed 1
      expect(screen.getByText('2000')).toBeInTheDocument(); // Total Distributed 2
    });
  });

  it('should handle loading state', () => {
    render(<AnalyticsDashboard provider={mockProvider} signer={mockSigner} />);
    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('should handle error state', async () => {
    mockKnowledgeDomainService.getDomainCount.mockRejectedValueOnce(
      new Error('Failed to load domains')
    );

    render(<AnalyticsDashboard provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load domains')).toBeInTheDocument();
    });
  });

  it('should handle domain update events', async () => {
    render(<AnalyticsDashboard provider={mockProvider} signer={mockSigner} />);

    const eventHandler = mockKnowledgeDomainService.on.mock.calls.find(
      call => call[0] === 'DomainUpdated'
    )?.[1];

    if (!eventHandler) {
      throw new Error('Event handler not found');
    }

    eventHandler({
      domainId: BigInt(0),
      relevanceScore: 0.7,
      innovationScore: 0.7,
      timestamp: BigInt(Date.now())
    });

    await waitFor(() => {
      expect(screen.getByText('0.70')).toBeInTheDocument(); // Updated Innovation Score
      expect(screen.getByText('0.70')).toBeInTheDocument(); // Updated Relevance Score
    });
  });

  it('should handle royalty distribution events', async () => {
    render(<AnalyticsDashboard provider={mockProvider} signer={mockSigner} />);

    const eventHandler = mockIdeaRegistryService.on.mock.calls.find(
      call => call[0] === 'RoyaltyDistributed'
    )?.[1];

    if (!eventHandler) {
      throw new Error('Event handler not found');
    }

    const updatedIdea = {
      id: BigInt(0),
      title: 'Test Idea 1',
      description: 'Test Description 1',
      creator: '0x123',
      hash: '0xabc',
      timestamp: BigInt(Date.now()),
      similarityScore: 0.8,
      royaltyRate: 0.05,
      lastDistribution: Date.now(),
      totalDistributed: BigInt(2000)
    };

    mockIdeaRegistryService.getIdea.mockResolvedValueOnce(updatedIdea);

    eventHandler({
      ideaId: BigInt(0),
      amount: BigInt(1000),
      timestamp: BigInt(Date.now())
    });

    await waitFor(() => {
      expect(screen.getByText('2000')).toBeInTheDocument(); // Updated Total Distributed
    });
  });
}); 