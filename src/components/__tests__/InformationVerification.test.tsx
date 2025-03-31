import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ethers } from 'ethers';
import { InformationVerification } from '../InformationVerification';
import { InformationVerificationService } from '../../services/informationVerification';
import { NostrRelayService } from '../../services/nostrRelay';
import { ConceptMappingService } from '../../services/conceptMapping';
import { DAOTokenService } from '../../services/daoToken';

// Mock the services
jest.mock('../../services/informationVerification');
jest.mock('../../services/nostrRelay');
jest.mock('../../services/conceptMapping');
jest.mock('../../services/daoToken');

describe('InformationVerification', () => {
  const mockProvider = {} as ethers.Provider;
  const mockSigner = {
    getAddress: jest.fn().mockResolvedValue('0x123')
  } as unknown as ethers.Signer;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('renders the information verification system', () => {
    render(<InformationVerification provider={mockProvider} signer={mockSigner} />);
    
    expect(screen.getByText('Information Verification System')).toBeInTheDocument();
    expect(screen.getByText('Submit Information')).toBeInTheDocument();
    expect(screen.getByText('Viewing Preferences')).toBeInTheDocument();
    expect(screen.getByText('Verified Information')).toBeInTheDocument();
  });

  it('allows submitting new information', async () => {
    const mockSubmitInformation = jest.fn().mockResolvedValue(undefined);
    (InformationVerificationService.getInstance as jest.Mock).mockReturnValue({
      submitInformation: mockSubmitInformation,
      getViewingPreferences: jest.fn().mockResolvedValue(null),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<InformationVerification provider={mockProvider} signer={mockSigner} />);
    
    const contentInput = screen.getByPlaceholderText('Enter information content');
    const sourceSelect = screen.getByRole('combobox');
    const levelSelect = screen.getAllByRole('combobox')[1];
    const submitButton = screen.getByText('Submit Information');

    fireEvent.change(contentInput, { target: { value: 'Test information' } });
    fireEvent.change(sourceSelect, { target: { value: 'test-source' } });
    fireEvent.change(levelSelect, { target: { value: 'local' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitInformation).toHaveBeenCalledWith(
        'Test information',
        'test-source',
        'local'
      );
    });
  });

  it('displays viewing preferences when loaded', async () => {
    const mockPreferences = {
      userAddress: '0x123',
      baseRate: BigInt(100),
      categoryRates: new Map([
        ['news', BigInt(150)],
        ['ads', BigInt(200)]
      ]),
      minStakeRequirements: new Map(),
      lastUpdated: BigInt(Date.now())
    };

    (InformationVerificationService.getInstance as jest.Mock).mockReturnValue({
      getViewingPreferences: jest.fn().mockResolvedValue(mockPreferences),
      updateViewingPreferences: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<InformationVerification provider={mockProvider} signer={mockSigner} />);
    
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });
  });

  it('allows updating viewing preferences', async () => {
    const mockUpdatePreferences = jest.fn().mockResolvedValue(undefined);
    (InformationVerificationService.getInstance as jest.Mock).mockReturnValue({
      getViewingPreferences: jest.fn().mockResolvedValue({
        userAddress: '0x123',
        baseRate: BigInt(100),
        categoryRates: new Map([
          ['news', BigInt(150)]
        ]),
        minStakeRequirements: new Map(),
        lastUpdated: BigInt(Date.now())
      }),
      updateViewingPreferences: mockUpdatePreferences,
      on: jest.fn(),
      off: jest.fn()
    });

    render(<InformationVerification provider={mockProvider} signer={mockSigner} />);
    
    const rateInput = screen.getByDisplayValue('150');
    const updateButton = screen.getByText('Update Preferences');

    fireEvent.change(rateInput, { target: { value: '200' } });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith(
        BigInt(100),
        expect.any(Map)
      );
    });
  });

  it('displays verified information when loaded', async () => {
    const mockInformation = [
      {
        itemId: '1',
        content: 'Test content',
        source: {
          sourceId: 'test-source',
          sourceType: 'individual',
          sourceAddress: '0x123',
          reliabilityScore: 80,
          verificationCount: 5,
          lastVerification: BigInt(Date.now())
        },
        verificationLevel: 'local',
        verificationStatus: 'verified',
        verificationProofs: [],
        distributionScope: ['local'],
        createdAt: BigInt(Date.now()),
        verifiedAt: BigInt(Date.now())
      }
    ];

    (InformationVerificationService.getInstance as jest.Mock).mockReturnValue({
      getViewingPreferences: jest.fn().mockResolvedValue(null),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<InformationVerification provider={mockProvider} signer={mockSigner} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test content')).toBeInTheDocument();
      expect(screen.getByText('test-source')).toBeInTheDocument();
      expect(screen.getByText('local')).toBeInTheDocument();
      expect(screen.getByText('verified')).toBeInTheDocument();
    });
  });

  it('handles errors gracefully', async () => {
    const mockError = new Error('Failed to load preferences');
    (InformationVerificationService.getInstance as jest.Mock).mockReturnValue({
      getViewingPreferences: jest.fn().mockRejectedValue(mockError),
      on: jest.fn(),
      off: jest.fn()
    });

    render(<InformationVerification provider={mockProvider} signer={mockSigner} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load preferences')).toBeInTheDocument();
    });
  });
}); 