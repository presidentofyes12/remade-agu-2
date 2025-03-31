// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract GovernanceToken is 
    ERC20Upgradeable, 
    AccessControlUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant MULTISIG_ROLE = keccak256("MULTISIG_ROLE");

    struct RateLimit {
        uint256 maxAmount;
        uint256 timeWindow;
        uint256 lastReset;
        uint256 currentAmount;
    }

    mapping(address => RateLimit) public rateLimits;
    mapping(bytes32 => uint256) public multisigApprovals;
    uint256 public requiredApprovals;

    event RateLimitUpdated(address indexed account, uint256 maxAmount, uint256 timeWindow);
    event MultisigApprovalAdded(bytes32 indexed operationHash, address indexed approver);
    event MultisigOperationExecuted(bytes32 indexed operationHash);

    modifier withinRateLimit(uint256 amount) {
        RateLimit storage limit = rateLimits[msg.sender];
        require(
            block.timestamp >= limit.lastReset + limit.timeWindow ||
            limit.currentAmount + amount <= limit.maxAmount,
            "Rate limit exceeded"
        );
        _;
    }

    modifier requiresMultisig(bytes32 operationHash) {
        require(multisigApprovals[operationHash] < requiredApprovals, "Operation already executed");
        _;
    }

    function initialize(
        string memory name,
        string memory symbol,
        address admin,
        address[] memory initialMinters,
        uint256 requiredApprovalsCount
    ) public initializer {
        __ERC20_init(name, symbol);
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(ADMIN_ROLE, admin);
        requiredApprovals = requiredApprovalsCount;

        for (uint256 i = 0; i < initialMinters.length; i++) {
            _setupRole(MINTER_ROLE, initialMinters[i]);
        }
    }

    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        nonReentrant 
        withinRateLimit(amount) 
    {
        _mint(to, amount);
        _updateRateLimit(msg.sender, amount);
    }

    function burn(uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
        withinRateLimit(amount) 
    {
        _burn(msg.sender, amount);
        _updateRateLimit(msg.sender, amount);
    }

    function setRateLimit(
        address account,
        uint256 maxAmount,
        uint256 timeWindow
    ) external onlyRole(ADMIN_ROLE) {
        rateLimits[account] = RateLimit({
            maxAmount: maxAmount,
            timeWindow: timeWindow,
            lastReset: block.timestamp,
            currentAmount: 0
        });
        emit RateLimitUpdated(account, maxAmount, timeWindow);
    }

    function approveMultisigOperation(bytes32 operationHash) 
        external 
        onlyRole(MULTISIG_ROLE) 
        requiresMultisig(operationHash) 
    {
        multisigApprovals[operationHash]++;
        emit MultisigApprovalAdded(operationHash, msg.sender);

        if (multisigApprovals[operationHash] >= requiredApprovals) {
            _executeMultisigOperation(operationHash);
        }
    }

    function _updateRateLimit(address account, uint256 amount) internal {
        RateLimit storage limit = rateLimits[account];
        if (block.timestamp >= limit.lastReset + limit.timeWindow) {
            limit.currentAmount = amount;
            limit.lastReset = block.timestamp;
        } else {
            limit.currentAmount += amount;
        }
    }

    function _executeMultisigOperation(bytes32 operationHash) internal {
        // Implementation for executing multisig operations
        // This would be customized based on the specific operation type
        emit MultisigOperationExecuted(operationHash);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
} 