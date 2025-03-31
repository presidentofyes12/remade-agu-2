import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ethers } from 'ethers';
import { PrivacyManagement } from '../PrivacyManagement';
import { PrivacyService } from '../../services/privacyService';
import { DAOTokenService } from '../../services/daoToken';

// Mock the services
jest.mock('../../services/privacyService');
jest.mock('../../services/daoToken');

describe('PrivacyManagement', () => {
  const mockProvider = {} as ethers.Provider;
  const mockSigner = {
    getAddress: jest.fn().mockResolvedValue('0x123')
  } as unknown as ethers.Signer;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('renders the privacy management system', () => {
    render(<PrivacyManagement provider={mockProvider} signer={mockSigner} />);
    
    expect(screen.getByText('Privacy Management System')).toBeInTheDocument();
    expect(screen.getByText('Key Management')).toBeInTheDocument();
    expect(screen.getByText('Secondary Keys')).toBeInTheDocument();
    expect(screen.getByText('Identity Resolution')).toBeInTheDocument();
  });

  it('allows generating a key pair', async () => {
    const mockKeyPair = {
      publicKey: '0xabc',
      privateKey: '0xdef'
    };

    (PrivacyService.getInstance as jest.Mock).mockReturnValue({
      generateKeyPair: jest.fn().mockResolvedValue(mockKeyPair),
      createSecondaryKey: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<PrivacyManagement provider={mockProvider} signer={mockSigner} />);
    
    const generateButton = screen.getByText('Generate Key Pair');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('0xabc')).toBeInTheDocument();
    });
  });

  it('allows creating a secondary key', async () => {
    const mockKeyPair = {
      publicKey: '0xabc',
      privateKey: '0xdef'
    };

    const mockCreateSecondaryKey = jest.fn().mockResolvedValue(undefined);
    (PrivacyService.getInstance as jest.Mock).mockReturnValue({
      generateKeyPair: jest.fn().mockResolvedValue(mockKeyPair),
      createSecondaryKey: mockCreateSecondaryKey,
      on: jest.fn(),
      off: jest.fn()
    });

    render(<PrivacyManagement provider={mockProvider} signer={mockSigner} />);
    
    // Generate key pair first
    const generateButton = screen.getByText('Generate Key Pair');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('0xabc')).toBeInTheDocument();
    });

    // Create secondary key
    const targetUserInput = screen.getByPlaceholderText('Enter target user hash');
    const createButton = screen.getByText('Create Secondary Key');

    fireEvent.change(targetUserInput, { target: { value: '0x123' } });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateSecondaryKey).toHaveBeenCalled();
    });
  });

  it('allows proposing identity resolution', async () => {
    const mockProposeIdentityResolution = jest.fn().mockResolvedValue('proposal-1');
    (PrivacyService.getInstance as jest.Mock).mockReturnValue({
      generateKeyPair: jest.fn().mockResolvedValue({ publicKey: '0xabc', privateKey: '0xdef' }),
      createSecondaryKey: jest.fn(),
      proposeIdentityResolution: mockProposeIdentityResolution,
      on: jest.fn(),
      off: jest.fn()
    });

    render(<PrivacyManagement provider={mockProvider} signer={mockSigner} />);
    
    const targetUserInput = screen.getByPlaceholderText('Enter target user hash');
    const justificationInput = screen.getByPlaceholderText('Enter justification');
    const durationInput = screen.getByPlaceholderText('Duration in seconds');
    const proposeButton = screen.getByText('Propose Resolution');

    fireEvent.change(targetUserInput, { target: { value: '0x123' } });
    fireEvent.change(justificationInput, { target: { value: 'Test justification' } });
    fireEvent.change(durationInput, { target: { value: '86400' } });
    fireEvent.click(proposeButton);

    await waitFor(() => {
      expect(mockProposeIdentityResolution).toHaveBeenCalledWith(
        '0x123',
        [],
        'Test justification',
        BigInt(86400)
      );
    });
  });

  it('displays active proposals', async () => {
    const mockProposals = [
      {
        proposalId: '1',
        targetUserHash: '0x123',
        requestedInformation: ['identity'],
        justification: 'Test justification',
        status: 'pending',
        createdAt: BigInt(Date.now()),
        expiresAt: BigInt(Date.now() + 86400000),
        votes: {
          for: BigInt(10),
          against: BigInt(5)
        }
      }
    ];

    (PrivacyService.getInstance as jest.Mock).mockReturnValue({
      generateKeyPair: jest.fn().mockResolvedValue({ publicKey: '0xabc', privateKey: '0xdef' }),
      createSecondaryKey: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<PrivacyManagement provider={mockProvider} signer={mockSigner} />);
    
    await waitFor(() => {
      expect(screen.getByText('0x123')).toBeInTheDocument();
      expect(screen.getByText('Test justification')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  it('allows voting on proposals', async () => {
    const mockVoteOnIdentityResolution = jest.fn().mockResolvedValue(undefined);
    (PrivacyService.getInstance as jest.Mock).mockReturnValue({
      generateKeyPair: jest.fn().mockResolvedValue({ publicKey: '0xabc', privateKey: '0xdef' }),
      createSecondaryKey: jest.fn(),
      voteOnIdentityResolution: mockVoteOnIdentityResolution,
      on: jest.fn(),
      off: jest.fn()
    });

    render(<PrivacyManagement provider={mockProvider} signer={mockSigner} />);
    
    const voteForButton = screen.getByText('Vote For');
    fireEvent.click(voteForButton);

    await waitFor(() => {
      expect(mockVoteOnIdentityResolution).toHaveBeenCalledWith('1', true);
    });
  });

  it('allows executing approved proposals', async () => {
    const mockExecuteIdentityResolution = jest.fn().mockResolvedValue(['identity']);
    (PrivacyService.getInstance as jest.Mock).mockReturnValue({
      generateKeyPair: jest.fn().mockResolvedValue({ publicKey: '0xabc', privateKey: '0xdef' }),
      createSecondaryKey: jest.fn(),
      executeIdentityResolution: mockExecuteIdentityResolution,
      on: jest.fn(),
      off: jest.fn()
    });

    render(<PrivacyManagement provider={mockProvider} signer={mockSigner} />);
    
    const executeButton = screen.getByText('Execute Resolution');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockExecuteIdentityResolution).toHaveBeenCalledWith('1');
    });
  });

  it('handles errors gracefully', async () => {
    const mockError = new Error('Failed to generate key pair');
    (PrivacyService.getInstance as jest.Mock).mockReturnValue({
      generateKeyPair: jest.fn().mockRejectedValue(mockError),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<PrivacyManagement provider={mockProvider} signer={mockSigner} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to generate key pair')).toBeInTheDocument();
    });
  });
}); 