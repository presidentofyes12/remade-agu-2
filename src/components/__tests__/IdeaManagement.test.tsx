import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IdeaManagement } from '../IdeaManagement';
import { IdeaRegistryService } from '../../services/ideaRegistry';
import { KnowledgeDomainService } from '../../services/knowledgeDomain';
import { ethers } from 'ethers';
import { IdeaRegistryEvents } from '../../types/contracts';

jest.mock('ethers');
jest.mock('../../services/ideaRegistry');
jest.mock('../../services/knowledgeDomain');

describe('IdeaManagement', () => {
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockSigner: jest.Mocked<ethers.Signer>;
  let mockIdeaRegistryService: jest.Mocked<IdeaRegistryService>;
  let mockKnowledgeDomainService: jest.Mocked<KnowledgeDomainService>;

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
            lastDistribution: 0,
            totalDistributed: BigInt(0)
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
            lastDistribution: 0,
            totalDistributed: BigInt(0)
          });
        }
        throw new Error('Idea not found');
      }),
      registerIdea: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      distributeRoyalties: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      updateRoyaltyRate: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<IdeaRegistryService>;

    mockKnowledgeDomainService = {
      getInstance: jest.fn().mockReturnThis(),
      getDomainCount: jest.fn().mockResolvedValue(BigInt(1)),
      getDomain: jest.fn().mockResolvedValue({
        id: BigInt(0),
        name: 'Test Domain',
        description: 'Test Description',
        parentId: null,
        relevanceScore: 0.5,
        innovationScore: 0.5,
        contributionThreshold: BigInt(1000),
        totalContributions: BigInt(0),
        activeProposals: BigInt(0),
        timestamp: BigInt(Date.now())
      }),
      mapProposalToDomain: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<KnowledgeDomainService>;

    (IdeaRegistryService.getInstance as jest.Mock).mockReturnValue(mockIdeaRegistryService);
    (KnowledgeDomainService.getInstance as jest.Mock).mockReturnValue(mockKnowledgeDomainService);
  });

  it('should load and display ideas', async () => {
    render(<IdeaManagement provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText('Test Idea 1')).toBeInTheDocument();
      expect(screen.getByText('Test Idea 2')).toBeInTheDocument();
    });
  });

  it('should register a new idea', async () => {
    render(<IdeaManagement provider={mockProvider} signer={mockSigner} />);

    const titleInput = screen.getByLabelText(/idea title/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    const hashInput = screen.getByLabelText(/content hash/i);
    const submitButton = screen.getByText(/register idea/i);

    fireEvent.change(titleInput, { target: { value: 'New Idea' } });
    fireEvent.change(descriptionInput, { target: { value: 'New Description' } });
    fireEvent.change(hashInput, { target: { value: '0x123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockIdeaRegistryService.registerIdea).toHaveBeenCalledWith(
        'New Idea',
        'New Description',
        '0x123'
      );
    });
  });

  it('should map idea to domain', async () => {
    render(<IdeaManagement provider={mockProvider} signer={mockSigner} />);

    const titleInput = screen.getByLabelText(/idea title/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    const hashInput = screen.getByLabelText(/content hash/i);
    const domainSelect = screen.getByLabelText(/knowledge domain/i);
    const submitButton = screen.getByText(/register idea/i);

    fireEvent.change(titleInput, { target: { value: 'New Idea' } });
    fireEvent.change(descriptionInput, { target: { value: 'New Description' } });
    fireEvent.change(hashInput, { target: { value: '0x123' } });
    fireEvent.change(domainSelect, { target: { value: '0' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockKnowledgeDomainService.mapProposalToDomain).toHaveBeenCalledWith(
        expect.any(BigInt),
        BigInt(0),
        true
      );
    });
  });

  it('should distribute royalties', async () => {
    render(<IdeaManagement provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText('Test Idea 1')).toBeInTheDocument();
    });

    const distributeButton = screen.getAllByText(/distribute royalties/i)[0];
    fireEvent.click(distributeButton);

    await waitFor(() => {
      expect(mockIdeaRegistryService.distributeRoyalties).toHaveBeenCalledWith(BigInt(0));
    });
  });

  it('should update royalty rate', async () => {
    render(<IdeaManagement provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText('Test Idea 1')).toBeInTheDocument();
    });

    const increaseButton = screen.getAllByText(/increase royalty rate/i)[0];
    fireEvent.click(increaseButton);

    await waitFor(() => {
      expect(mockIdeaRegistryService.updateRoyaltyRate).toHaveBeenCalledWith(
        BigInt(0),
        0.06
      );
    });
  });

  it('should handle errors', async () => {
    mockIdeaRegistryService.getIdeaCount.mockRejectedValueOnce(new Error('Failed to load ideas'));

    render(<IdeaManagement provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load ideas/i)).toBeInTheDocument();
    });
  });

  it('should handle idea registration events', async () => {
    render(<IdeaManagement provider={mockProvider} signer={mockSigner} />);

    const eventHandler = mockIdeaRegistryService.on.mock.calls.find(
      call => call[0] === 'IdeaRegistered'
    )?.[1];

    if (!eventHandler) {
      throw new Error('Event handler not found');
    }

    const newIdea = {
      id: BigInt(2),
      title: 'New Idea',
      description: 'New Description',
      creator: '0x789',
      hash: '0x456',
      timestamp: BigInt(Date.now()),
      similarityScore: 0.7,
      royaltyRate: 0.05,
      lastDistribution: 0,
      totalDistributed: BigInt(0)
    };

    mockIdeaRegistryService.getIdea.mockResolvedValueOnce(newIdea);
    
    const event: IdeaRegistryEvents['IdeaRegistered'] = {
      ideaId: BigInt(2),
      title: 'New Idea',
      creator: '0x789',
      hash: '0x456',
      timestamp: BigInt(Date.now())
    };
    
    eventHandler(event);

    await waitFor(() => {
      expect(screen.getByText('New Idea')).toBeInTheDocument();
    });
  });

  it('should handle idea reuse events', async () => {
    render(<IdeaManagement provider={mockProvider} signer={mockSigner} />);

    const eventHandler = mockIdeaRegistryService.on.mock.calls.find(
      call => call[0] === 'IdeaReused'
    )?.[1];

    if (!eventHandler) {
      throw new Error('Event handler not found');
    }

    const reusedIdea = {
      id: BigInt(2),
      title: 'Reused Idea',
      description: 'Reused Description',
      creator: '0x789',
      hash: '0x456',
      timestamp: BigInt(Date.now()),
      similarityScore: 0.8,
      royaltyRate: 0.05,
      lastDistribution: 0,
      totalDistributed: BigInt(0)
    };

    mockIdeaRegistryService.getIdea.mockResolvedValueOnce(reusedIdea);
    
    const event: IdeaRegistryEvents['IdeaReused'] = {
      originalIdeaId: BigInt(0),
      newIdeaId: BigInt(2),
      similarityScore: 0.8,
      timestamp: BigInt(Date.now())
    };
    
    eventHandler(event);

    await waitFor(() => {
      expect(screen.getByText('Reused Idea')).toBeInTheDocument();
    });
  });

  it('should handle royalty distribution events', async () => {
    render(<IdeaManagement provider={mockProvider} signer={mockSigner} />);

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
      totalDistributed: BigInt(1000)
    };

    mockIdeaRegistryService.getIdea.mockResolvedValueOnce(updatedIdea);
    
    const event: IdeaRegistryEvents['RoyaltyDistributed'] = {
      ideaId: BigInt(0),
      amount: BigInt(1000),
      timestamp: BigInt(Date.now())
    };
    
    eventHandler(event);

    await waitFor(() => {
      expect(screen.getByText('1000')).toBeInTheDocument();
    });
  });
}); 