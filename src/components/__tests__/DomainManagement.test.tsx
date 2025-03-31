import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DomainManagement } from '../DomainManagement';
import { KnowledgeDomainService } from '../../services/knowledgeDomain';
import { ethers } from 'ethers';

jest.mock('ethers');
jest.mock('../../services/knowledgeDomain');

describe('DomainManagement', () => {
  let mockProvider: jest.Mocked<ethers.Provider>;
  let mockSigner: jest.Mocked<ethers.Signer>;
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
            activeProposals: BigInt(0),
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
            activeProposals: BigInt(0),
            timestamp: BigInt(Date.now())
          });
        }
        throw new Error('Domain not found');
      }),
      registerDomain: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      updateDomainScores: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<KnowledgeDomainService>;

    (KnowledgeDomainService.getInstance as jest.Mock).mockReturnValue(mockKnowledgeDomainService);
  });

  it('should load and display domains', async () => {
    render(<DomainManagement provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText('Test Domain 1')).toBeInTheDocument();
      expect(screen.getByText('Test Domain 2')).toBeInTheDocument();
    });
  });

  it('should register a new domain', async () => {
    render(<DomainManagement provider={mockProvider} signer={mockSigner} />);

    const nameInput = screen.getByLabelText(/domain name/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    const submitButton = screen.getByText(/register domain/i);

    fireEvent.change(nameInput, { target: { value: 'New Domain' } });
    fireEvent.change(descriptionInput, { target: { value: 'New Description' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockKnowledgeDomainService.registerDomain).toHaveBeenCalledWith(
        'New Domain',
        'New Description',
        null,
        expect.any(BigInt)
      );
    });
  });

  it('should update domain scores', async () => {
    render(<DomainManagement provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText('Test Domain 1')).toBeInTheDocument();
    });

    const increaseButton = screen.getAllByText(/increase scores/i)[0];
    fireEvent.click(increaseButton);

    await waitFor(() => {
      expect(mockKnowledgeDomainService.updateDomainScores).toHaveBeenCalledWith(
        BigInt(0),
        0.6,
        0.6
      );
    });
  });

  it('should handle errors', async () => {
    mockKnowledgeDomainService.getDomainCount.mockRejectedValueOnce(new Error('Failed to load domains'));

    render(<DomainManagement provider={mockProvider} signer={mockSigner} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load domains/i)).toBeInTheDocument();
    });
  });

  it('should handle domain registration events', async () => {
    render(<DomainManagement provider={mockProvider} signer={mockSigner} />);

    const eventHandler = mockKnowledgeDomainService.on.mock.calls.find(
      call => call[0] === 'DomainRegistered'
    )[1];

    const newDomain = {
      id: BigInt(2),
      name: 'New Domain',
      description: 'New Description',
      parentId: null,
      relevanceScore: 0.5,
      innovationScore: 0.5,
      contributionThreshold: BigInt(1000),
      totalContributions: BigInt(0),
      activeProposals: BigInt(0),
      timestamp: BigInt(Date.now())
    };

    mockKnowledgeDomainService.getDomain.mockResolvedValueOnce(newDomain);
    eventHandler({ domainId: BigInt(2) });

    await waitFor(() => {
      expect(screen.getByText('New Domain')).toBeInTheDocument();
    });
  });
}); 