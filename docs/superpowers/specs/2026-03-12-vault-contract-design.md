# Vault Smart Contract Design

> Date: 2026-03-12
> Status: Approved
> Author: Technical Team

---

## 1. Overview

### 1.1 Purpose

The Vault contract is the onchain custody layer for the PerpDex MVP trading platform. It manages USDC deposits and withdrawals, serving as the trust boundary between user funds and the platform's internal ledger.

### 1.2 Scope

- USDC token custody (deposit/withdraw)
- Event emission for blockchain indexer
- Access control and security protections
- Platform-managed withdrawal model

### 1.3 Out of Scope

- Emergency withdrawal functions
- ERC20 token rescue
- Multi-signature control
- Upgrade patterns

---

## 2. Design Decisions

### 2.1 Withdrawal Model: Platform-Managed

**Decision:** Only contract owner (backend) can execute withdrawals.

**Rationale:**
- Backend validates business logic (available balance, open positions) before onchain execution
- Simplifies contract logic and reduces Gas costs
- Platform bears Gas costs for withdrawals

**Implementation:**
```solidity
function withdraw(address user, uint256 amount) external onlyOwner { ... }
```

### 2.2 Pausable Scope: Withdraw Only

**Decision:** Only withdraw function is pausable; deposit remains always active.

**Rationale:**
- Even during incidents, users should be able to deposit funds
- Withdrawals are higher risk and may need to be halted
- Common pattern in exchange contracts

**Implementation:**
```solidity
modifier whenNotPausedForWithdraw() {
    require(!paused(), "Pausable: paused");
    _;
}
```

### 2.3 Event Format: Minimal

**Decision:** Events contain only essential data (user address + amount).

**Rationale:**
- txHash and logIndex are available offchain via viem
- Simpler event structure reduces Gas costs
- Indexer can derive unique identifiers from blockchain data

**Implementation:**
```solidity
event Deposit(address indexed user, uint256 amount);
event Withdraw(address indexed user, uint256 amount);
```

### 2.4 ETH Rejection: Explicit

**Decision:** Contract explicitly rejects ETH transfers.

**Rationale:**
- Defense-in-depth: makes intent explicit
- Prevents edge cases if payable functions are added later
- Best practice from OpenZeppelin guidelines

**Implementation:**
```solidity
receive() external payable {
    revert("Vault: ETH not accepted");
}
```

### 2.5 Dependencies: OpenZeppelin

**Decision:** Use OpenZeppelin Contracts for security primitives.

**Rationale:**
- Battle-tested and audited code
- Industry standard
- Reduces development risk

**Dependencies:**
- `Ownable` - Access control
- `Pausable` - Emergency stop
- `ReentrancyGuard` - Reentrancy protection

---

## 3. Contract Specification

### 3.1 State Variables

| Variable | Type | Visibility | Description |
|----------|------|------------|-------------|
| `USDC` | `IERC20` | `public immutable` | USDC token contract |
| `_balances` | `mapping(address => uint256)` | `private` | User balances |
| `_totalAssets` | `uint256` | `private` | Total assets tracked |

### 3.2 Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `Deposit` | `address indexed user`, `uint256 amount` | Emitted on successful deposit |
| `Withdraw` | `address indexed user`, `uint256 amount` | Emitted on successful withdrawal |

### 3.3 Functions

#### User Functions

| Function | Signature | Modifiers | Description |
|----------|-----------|-----------|-------------|
| `deposit` | `deposit(uint256 amount)` | `nonReentrant` | Deposit USDC into vault |

#### Owner Functions

| Function | Signature | Modifiers | Description |
|----------|-----------|-----------|-------------|
| `withdraw` | `withdraw(address user, uint256 amount)` | `onlyOwner`, `whenNotPausedForWithdraw`, `nonReentrant` | Withdraw USDC to user |
| `pause` | `pause()` | `onlyOwner` | Pause withdrawals |
| `unpause` | `unpause()` | `onlyOwner` | Resume withdrawals |

#### View Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `usdc` | `usdc() returns (address)` | Get USDC token address |
| `balanceOf` | `balanceOf(address user) returns (uint256)` | Get user balance |
| `totalAssets` | `totalAssets() returns (uint256)` | Get total tracked assets |

### 3.4 Error Messages

| Error | Condition |
|-------|-----------|
| `"Vault: zero amount"` | Amount parameter is zero |
| `"Vault: insufficient balance"` | User balance < withdrawal amount |
| `"Vault: ETH not accepted"` | ETH sent to contract |
| `"Ownable: caller is not the owner"` | Non-owner calls owner-only function |
| `"Pausable: paused"` | Withdrawal while paused |
| `"ReentrancyGuard: reentrant call"` | Reentrancy detected |

---

## 4. Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
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

        USDC.transferFrom(msg.sender, address(this), amount);
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
        USDC.transfer(user, amount);

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
```

---

## 5. Test Specification

### 5.1 Test Files

```
test/
├── Vault.t.sol          # Main test file
└── mocks/
    └── MockUSDC.sol     # USDC mock with 6 decimals
```

### 5.2 Test Cases

#### Deposit Tests

| Test | Description |
|------|-------------|
| `test_Deposit_Success` | Normal deposit updates balance |
| `test_Deposit_ZeroAmount_Reverts` | Zero amount reverts |
| `test_Deposit_NoApproval_Reverts` | Without approval reverts |
| `test_Deposit_EmitsEvent` | Deposit event emitted |
| `test_Deposit_WhenPaused_Success` | Deposit works when paused |

#### Withdraw Tests

| Test | Description |
|------|-------------|
| `test_Withdraw_Success` | Normal withdrawal updates balance |
| `test_Withdraw_ZeroAmount_Reverts` | Zero amount reverts |
| `test_Withdraw_InsufficientBalance_Reverts` | Over-withdrawal reverts |
| `test_Withdraw_NonOwner_Reverts` | Non-owner cannot withdraw |
| `test_Withdraw_WhenPaused_Reverts` | Withdrawal blocked when paused |
| `test_Withdraw_EmitsEvent` | Withdraw event emitted |

#### Pause Tests

| Test | Description |
|------|-------------|
| `test_Pause_Owner_Success` | Owner can pause |
| `test_Unpause_Owner_Success` | Owner can unpause |
| `test_Pause_NonOwner_Reverts` | Non-owner cannot pause |

#### Balance Tests

| Test | Description |
|------|-------------|
| `test_BalanceOf_Correct` | Balance query returns correct value |
| `test_TotalAssets_Correct` | Total assets query correct |

#### Security Tests

| Test | Description |
|------|-------------|
| `test_Reentrancy_Protected` | Reentrancy attack blocked |
| `test_ETHTransfer_Reverts` | ETH transfer rejected |

#### Fuzz Tests

| Test | Description |
|------|-------------|
| `testFuzz_Deposit_Withdraw_Roundtrip` | Fuzz deposit/withdraw cycles |
| `testFuzz_MultipleUsers` | Fuzz multi-user scenarios |

### 5.3 Coverage Target

- **Minimum:** 90%
- **Focus:** All branches, modifiers, and error conditions

---

## 6. Deployment

### 6.1 Network

- **Target:** Arbitrum Sepolia Testnet
- **Chain ID:** 421614

### 6.2 Prerequisites

- USDC contract address on Arbitrum Sepolia
- Deployer wallet with ETH for Gas
- Private key in environment variable

### 6.3 Deployment Script

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/Vault.sol";

contract DeployVault is Script {
    function run() external returns (Vault) {
        address usdcToken = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        Vault vault = new Vault(usdcToken);
        vm.stopBroadcast();

        return vault;
    }
}
```

### 6.4 Deployment Commands

```bash
# Load environment
source .env

# Deploy to Arbitrum Sepolia
forge script script/Deploy.s.sol:DeployVault \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify \
    -vvvv
```

### 6.5 Post-Deployment Verification

- [ ] Contract address recorded
- [ ] Owner address verified
- [ ] USDC address verified
- [ ] Deposit/Withdraw functions tested
- [ ] Pause/Unpause functions tested

---

## 7. Integration Points

### 7.1 Frontend Integration

```typescript
// Deposit flow
const amount = parseUnits("100", 6); // 100 USDC
await usdcContract.write.approve([vaultAddress, amount]);
await vaultContract.write.deposit([amount]);

// Withdrawal is backend-initiated, user calls API
```

### 7.2 Backend Integration

```typescript
// Withdrawal execution
const tx = await vaultContract.write.withdraw([userAddress, amount]);

// Event indexing
const depositEvents = await publicClient.getContractEvents({
    address: vaultAddress,
    abi: vaultAbi,
    eventName: 'Deposit',
    fromBlock: lastProcessedBlock,
});
```

### 7.3 Indexer Requirements

- Listen to `Deposit` and `Withdraw` events
- Use `txHash + logIndex` for idempotency
- Update user balance in database

---

## 8. Security Considerations

### 8.1 Implemented Protections

| Protection | Mechanism |
|------------|-----------|
| Reentrancy | `ReentrancyGuard` on all external functions |
| Access Control | `Ownable` for admin functions |
| Emergency Stop | `Pausable` on withdraw function |
| Input Validation | Zero amount checks, balance checks |
| ETH Protection | Explicit `receive()` revert |

### 8.2 Known Limitations

1. **Single Owner:** No multi-signature for admin functions
2. **No Token Rescue:** Accidentally sent tokens cannot be recovered
3. **No Emergency Withdraw:** All funds must be withdrawn through normal flow

### 8.3 Upgrade Path (Future)

For production, consider:
- Multi-signature owner (Gnosis Safe)
- Upgradeable proxy pattern
- Emergency withdrawal function
- Token rescue function

---

## 9. File Structure

```
apps/contracts/
├── src/
│   ├── Vault.sol
│   └── interfaces/
│       └── IERC20.sol
├── test/
│   ├── Vault.t.sol
│   └── mocks/
│       └── MockUSDC.sol
├── script/
│   └── Deploy.s.sol
├── lib/
│   ├── forge-std/
│   └── openzeppelin-contracts/
├── foundry.toml
├── remappings.txt
└── .env.example
```

---

## 10. Acceptance Criteria

- [ ] Contract compiles without warnings
- [ ] All tests pass
- [ ] Code coverage >= 90%
- [ ] Deployed to Arbitrum Sepolia
- [ ] Deposit/Withdraw functions verified on testnet
- [ ] Events indexed correctly by backend
