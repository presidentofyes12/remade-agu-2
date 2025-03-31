import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ethers } from 'ethers';
import { ExpertiseMatching } from '../ExpertiseMatching';
import { ExpertiseService } from '../../services/expertiseService';
import { KnowledgeDomainService } from '../../services/knowledgeDomain';
import { ProposalService } from '../../services/proposalService';

// Mock the services
jest.mock('../../services/expertiseService');
jest.mock('../../services/knowledgeDomain');
jest.mock('../../services/proposalService');

describe('ExpertiseMatching', () => {
  const mockProvider = {} as ethers.Provider;
  const mockSigner = {} as ethers.Signer;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('renders the expertise matching system', () => {
    render(<ExpertiseMatching provider={mockProvider} signer={mockSigner} />);
    
    expect(screen.getByText('Expertise Matching System')).toBeInTheDocument();
    expect(screen.getByText('Expert Profile')).toBeInTheDocument();
    expect(screen.getByText('Submit Review')).toBeInTheDocument();
    expect(screen.getByText('Proposal Reviews')).toBeInTheDocument();
  });

  it('allows creating a new profile', async () => {
    const mockCreateProfile = jest.fn().mockResolvedValue(undefined);
    (ExpertiseService.getInstance as jest.Mock).mockReturnValue({
      createProfile: mockCreateProfile,
      getProfile: jest.fn().mockResolvedValue(null),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<ExpertiseMatching provider={mockProvider} signer={mockSigner} />);
    
    const pseudonymInput = screen.getByPlaceholderText('Enter your pseudonym');
    const createButton = screen.getByText('Create Profile');

    fireEvent.change(pseudonymInput, { target: { value: 'testExpert' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateProfile).toHaveBeenCalledWith('testExpert');
    });
  });

  it('displays profile information when loaded', async () => {
    const mockProfile = {
      pseudonym: 'testExpert',
      lastUpdate: BigInt(Date.now()),
      domainExpertise: new Map([
        [BigInt(1), { value: 80 }],
        [BigInt(2), { value: 90 }]
      ])
    };

    (ExpertiseService.getInstance as jest.Mock).mockReturnValue({
      getProfile: jest.fn().mockResolvedValue(mockProfile),
      updateExpertise: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<ExpertiseMatching provider={mockProvider} signer={mockSigner} />);
    
    await waitFor(() => {
      expect(screen.getByText('testExpert')).toBeInTheDocument();
      expect(screen.getByText('Domain 1')).toBeInTheDocument();
      expect(screen.getByText('Domain 2')).toBeInTheDocument();
    });
  });

  it('allows submitting a review', async () => {
    const mockSubmitReview = jest.fn().mockResolvedValue(undefined);
    (ExpertiseService.getInstance as jest.Mock).mockReturnValue({
      submitReview: mockSubmitReview,
      getProposalReviews: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<ExpertiseMatching provider={mockProvider} signer={mockSigner} />);
    
    const proposalInput = screen.getByPlaceholderText('Proposal ID');
    const domainInput = screen.getByPlaceholderText('Domain ID');
    const contentInput = screen.getByPlaceholderText('Review content');
    const ratingInput = screen.getByPlaceholderText('Rating (0-100)');
    const submitButton = screen.getByText('Submit Review');

    fireEvent.change(proposalInput, { target: { value: '1' } });
    fireEvent.change(domainInput, { target: { value: '1' } });
    fireEvent.change(contentInput, { target: { value: 'Great proposal!' } });
    fireEvent.change(ratingInput, { target: { value: '85' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith(
        BigInt(1),
        '',
        'Great proposal!',
        85,
        BigInt(1)
      );
    });
  });

  it('displays reviews when loaded', async () => {
    const mockReviews = [
      {
        reviewerPseudonym: 'expert1',
        content: 'Good proposal',
        rating: { value: 85 },
        timestamp: BigInt(Date.now())
      }
    ];

    (ExpertiseService.getInstance as jest.Mock).mockReturnValue({
      getProposalReviews: jest.fn().mockResolvedValue(mockReviews),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<ExpertiseMatching provider={mockProvider} signer={mockSigner} />);
    
    await waitFor(() => {
      expect(screen.getByText('expert1')).toBeInTheDocument();
      expect(screen.getByText('Good proposal')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
    });
  });

  it('handles errors gracefully', async () => {
    const mockError = new Error('Failed to load profile');
    (ExpertiseService.getInstance as jest.Mock).mockReturnValue({
      getProfile: jest.fn().mockRejectedValue(mockError),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<ExpertiseMatching provider={mockProvider} signer={mockSigner} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load profile')).toBeInTheDocument();
    });
  });
}); 