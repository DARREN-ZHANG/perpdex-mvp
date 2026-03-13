// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC20.sol";

/**
 * @title Vault
 * @notice USDC custody contract for PerpDex MVP
 * @dev Platform-managed withdrawal model with pausable withdrawals
 */
contract Vault is Ownable, Pausable, ReentrancyGuard {
    IERC20 public immutable USDC;
    mapping(address => uint256) private _balances;
    uint256 private _totalAssets;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    /**
     * @notice Initialize vault with USDC token address
     * @param usdcToken USDC contract address (6 decimals)
     */
    constructor(address usdcToken) Ownable(msg.sender) {
        require(usdcToken != address(0), "Vault: zero address");
        USDC = IERC20(usdcToken);
    }

    /**
     * @dev Reject ETH transfers
     */
    receive() external payable {
        revert("Vault: ETH not accepted");
    }

    /**
     * @notice Deposit USDC into vault
     * @param amount Amount to deposit (6 decimals)
     * @dev User must approve USDC to vault first
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Vault: zero amount");

        require(USDC.transferFrom(msg.sender, address(this), amount), "Vault: transfer failed");
        _balances[msg.sender] += amount;
        _totalAssets += amount;

        emit Deposit(msg.sender, amount);
    }

    /**
     * @notice Withdraw USDC to user (Owner only)
     * @param user Recipient address
     * @param amount Amount to withdraw (6 decimals)
     */
    function withdraw(address user, uint256 amount)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        require(amount > 0, "Vault: zero amount");
        require(_balances[user] >= amount, "Vault: insufficient balance");

        _balances[user] -= amount;
        _totalAssets -= amount;
        require(USDC.transfer(user, amount), "Vault: transfer failed");

        emit Withdraw(user, amount);
    }

    /**
     * @notice Pause withdrawals
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume withdrawals
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Get user balance
     * @param user User address
     * @return Balance in USDC (6 decimals)
     */
    function balanceOf(address user) external view returns (uint256) {
        return _balances[user];
    }

    /**
     * @notice Get total tracked assets
     * @return Total USDC in vault
     */
    function totalAssets() external view returns (uint256) {
        return _totalAssets;
    }
}
