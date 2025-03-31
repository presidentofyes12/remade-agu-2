import { OracleService, OracleData, OracleConfig } from '../OracleService';
import { WalletConnector } from '../../wallet/WalletConnector';
import { IKeyManager } from '../../../types/KeyManager';
import { VotingPowerService } from '../../votingPowerService';
import { ProposalQuorumService } from '../../proposalQuorumService';

// Mock dependencies
jest.mock('../../wallet/WalletConnector');
jest.mock('../../../types/KeyManager');
jest.mock('../../votingPowerService');
jest.mock('../../proposalQuorumService');

describe('OracleService', () => {
  let oracleService: OracleService;
  let mockWalletConnector: jest.Mocked<WalletConnector>;
  let mockKeyManager: jest.Mocked<IKeyManager>;
  let mockVotingPowerService: jest.Mocked<VotingPowerService>;
  let mockProposalQuorumService: jest.Mocked<ProposalQuorumService>;

  const mockSource = 'test-source';
  const mockDataId = 'mock-data-id';
  const mockProposalId = 'mock-proposal-id';
  const mockAddress = '0x1234567890abcdef';
  const mockVotingPower = BigInt(1000);

  const mockData: Omit<OracleData, 'id' | 'status' | 'votes' | 'proposalId'> = {
    timestamp: Date.now(),
    value: 'test-value',
    source: mockSource
  };

  const mockConfig: OracleConfig = {
    updateInterval: 3600000, // 1 hour
    requiredVotingPower: BigInt(100),
    validationPeriod: 86400000, // 24 hours
    minVotesRequired: 5,
    maxAdminVotingPower: BigInt(500),
    maxDelegateVotingPower: BigInt(200),
    minorityProtectionThreshold: 20,
    vetoPowerThreshold: 40
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mocks
    mockWalletConnector = new WalletConnector() as jest.Mocked<WalletConnector>;
    mockKeyManager = {
      getPublicKey: jest.fn(),
      signMessage: jest.fn(),
      getAddress: jest.fn().mockResolvedValue(mockAddress)
    } as unknown as jest.Mocked<IKeyManager>;
    
    mockVotingPowerService = new VotingPowerService() as jest.Mocked<VotingPowerService>;
    mockProposalQuorumService = new ProposalQuorumService() as jest.Mocked<ProposalQuorumService>;

    oracleService = new OracleService(
      mockWalletConnector,
      mockKeyManager,
      mockVotingPowerService,
      mockProposalQuorumService
    );
  });

  describe('Configuration', () => {
    it('should set and get config', () => {
      oracleService.setConfig(mockSource, mockConfig);
      const config = oracleService.getConfig(mockSource);
      expect(config).toEqual(mockConfig);
    });
  });

  describe('Data Submission', () => {
    it('should submit data successfully', async () => {
      mockProposalQuorumService.createProposal.mockResolvedValue(mockProposalId);
      
      const dataId = await oracleService.submitData(mockData);
      
      expect(dataId).toBeDefined();
      expect(mockProposalQuorumService.createProposal).toHaveBeenCalled();
    });

    it('should handle submission errors', async () => {
      mockProposalQuorumService.createProposal.mockRejectedValue(new Error('Submission failed'));
      
      await expect(oracleService.submitData(mockData))
        .rejects
        .toThrow('Failed to submit oracle data');
    });
  });

  describe('Voting', () => {
    it('should vote on data successfully', async () => {
      mockVotingPowerService.getVotingPower.mockResolvedValue(mockVotingPower);
      mockProposalQuorumService.vote.mockResolvedValue(undefined);
      
      await oracleService.voteOnData(mockDataId, true);
      
      expect(mockVotingPowerService.getVotingPower).toHaveBeenCalled();
      expect(mockProposalQuorumService.vote).toHaveBeenCalled();
    });

    it('should handle voting errors', async () => {
      mockVotingPowerService.getVotingPower.mockRejectedValue(new Error('Voting failed'));
      
      await expect(oracleService.voteOnData(mockDataId, true))
        .rejects
        .toThrow('Failed to vote on oracle data');
    });

    it('should validate voting power requirements', async () => {
      mockVotingPowerService.getVotingPower.mockResolvedValue(BigInt(50));
      
      await expect(oracleService.voteOnData(mockDataId, true))
        .rejects
        .toThrow('Insufficient voting power');
    });
  });

  describe('Data Retrieval', () => {
    it('should get all data for source', async () => {
      const mockDataArray: OracleData[] = [{
        id: mockDataId,
        timestamp: Date.now(),
        value: 'test-value',
        source: mockSource,
        status: 'pending',
        votes: {
          for: BigInt(0),
          against: BigInt(0),
          voters: [],
          voterTypes: new Map()
        }
      }];

      oracleService['dataCache'].set(mockSource, mockDataArray);
      
      const data = await oracleService.getData(mockSource);
      expect(data).toEqual(mockDataArray);
    });

    it('should get only validated data', async () => {
      const mockDataArray: OracleData[] = [
        {
          id: 'validated-id',
          timestamp: Date.now(),
          value: 'test-value',
          source: mockSource,
          status: 'validated',
          votes: {
            for: BigInt(100),
            against: BigInt(0),
            voters: [mockAddress],
            voterTypes: new Map([[mockAddress, 'user']])
          }
        },
        {
          id: 'pending-id',
          timestamp: Date.now(),
          value: 'test-value',
          source: mockSource,
          status: 'pending',
          votes: {
            for: BigInt(0),
            against: BigInt(0),
            voters: [],
            voterTypes: new Map()
          }
        }
      ];

      oracleService['dataCache'].set(mockSource, mockDataArray);
      
      const data = await oracleService.getValidatedData(mockSource);
      expect(data).toHaveLength(1);
      expect(data[0].status).toBe('validated');
    });
  });

  describe('Validation Process', () => {
    it('should create validation proposal', async () => {
      const mockOracleData: OracleData = {
        id: mockDataId,
        timestamp: Date.now(),
        value: 'test-value',
        source: mockSource,
        status: 'pending',
        votes: {
          for: BigInt(0),
          against: BigInt(0),
          voters: [],
          voterTypes: new Map()
        }
      };

      mockProposalQuorumService.createProposal.mockResolvedValue(mockProposalId);
      
      const proposalId = await oracleService['createValidationProposal'](mockOracleData);
      
      expect(proposalId).toBe(mockProposalId);
      expect(mockProposalQuorumService.createProposal).toHaveBeenCalled();
    });

    it('should check validation status', async () => {
      const mockOracleData: OracleData = {
        id: mockDataId,
        timestamp: Date.now(),
        value: 'test-value',
        source: mockSource,
        status: 'pending',
        votes: {
          for: BigInt(100),
          against: BigInt(0),
          voters: [mockAddress],
          voterTypes: new Map([[mockAddress, 'user']])
        }
      };

      mockProposalQuorumService.getProposalStatus.mockResolvedValue({
        status: 'passed',
        forVotes: BigInt(100),
        againstVotes: BigInt(0)
      });
      
      await oracleService['checkValidationStatus'](mockOracleData);
      
      expect(mockProposalQuorumService.getProposalStatus).toHaveBeenCalled();
    });
  });
}); 