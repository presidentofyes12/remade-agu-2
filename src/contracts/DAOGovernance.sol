// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract DAOGovernance is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) votes;
    }

    struct GovernanceParameters {
        uint256 proposalThreshold;
        uint256 quorum;
        uint256 votingDelay;
        uint256 votingPeriod;
        uint256 executionDelay;
        uint256 minProposalVotingPower;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public votingPower;
    mapping(address => address) public delegates;
    mapping(address => uint256) public delegatedVotingPower;
    
    GovernanceParameters public parameters;
    IERC20Upgradeable public governanceToken;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votes);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event VotingPowerChanged(address indexed account, uint256 newVotingPower);
    event DelegateChanged(address indexed delegator, address indexed delegate);
    event ParametersUpdated(GovernanceParameters newParameters);
    event EmergencyPaused();
    event EmergencyUnpaused();

    modifier onlyGovernor() {
        require(hasRole(GOVERNOR_ROLE, msg.sender), "Caller is not a governor");
        _;
    }

    modifier onlyEmergency() {
        require(hasRole(EMERGENCY_ROLE, msg.sender), "Caller is not an emergency role");
        _;
    }

    function initialize(
        address _governanceToken,
        address _admin,
        address _emergencyRole
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        governanceToken = IERC20Upgradeable(_governanceToken);
        
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(ADMIN_ROLE, _admin);
        _setupRole(EMERGENCY_ROLE, _emergencyRole);

        parameters = GovernanceParameters({
            proposalThreshold: 1000 * 10**18, // 1000 tokens
            quorum: 10000 * 10**18, // 10000 tokens
            votingDelay: 1 days,
            votingPeriod: 3 days,
            executionDelay: 1 days,
            minProposalVotingPower: 100 * 10**18 // 100 tokens
        });
    }

    function createProposal(
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(votingPower[msg.sender] >= parameters.minProposalVotingPower, "Insufficient voting power");
        require(startTime > block.timestamp, "Invalid start time");
        require(endTime > startTime, "Invalid end time");

        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.startTime = startTime;
        proposal.endTime = endTime;
        proposal.executed = false;
        proposal.cancelled = false;

        emit ProposalCreated(proposalId, msg.sender, title);
        return proposalId;
    }

    function castVote(
        uint256 proposalId,
        bool support,
        uint256 votes
    ) external whenNotPaused nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(votes <= votingPower[msg.sender], "Insufficient voting power");

        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = votes;

        if (support) {
            proposal.forVotes += votes;
        } else {
            proposal.againstVotes += votes;
        }

        emit VoteCast(proposalId, msg.sender, support, votes);
    }

    function executeProposal(uint256 proposalId) external whenNotPaused nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Proposal cancelled");
        require(block.timestamp > proposal.endTime + parameters.executionDelay, "Execution delay not met");
        require(proposal.forVotes > proposal.againstVotes, "Proposal failed");
        require(proposal.forVotes + proposal.againstVotes >= parameters.quorum, "Quorum not met");

        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }

    function cancelProposal(uint256 proposalId) external onlyEmergency whenNotPaused {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Already cancelled");

        proposal.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    function updateVotingPower(address account) external whenNotPaused {
        uint256 newVotingPower = governanceToken.balanceOf(account);
        votingPower[account] = newVotingPower;
        emit VotingPowerChanged(account, newVotingPower);
    }

    function delegate(address to) external whenNotPaused {
        require(to != address(0), "Invalid delegate");
        require(to != msg.sender, "Cannot delegate to self");
        
        address currentDelegate = delegates[msg.sender];
        if (currentDelegate != address(0)) {
            delegatedVotingPower[currentDelegate] -= votingPower[msg.sender];
        }
        
        delegates[msg.sender] = to;
        delegatedVotingPower[to] += votingPower[msg.sender];
        
        emit DelegateChanged(msg.sender, to);
    }

    function updateParameters(GovernanceParameters memory newParameters) external onlyGovernor {
        parameters = newParameters;
        emit ParametersUpdated(newParameters);
    }

    function emergencyPause() external onlyEmergency {
        _pause();
        emit EmergencyPaused();
    }

    function emergencyUnpause() external onlyEmergency {
        _unpause();
        emit EmergencyUnpaused();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
} 