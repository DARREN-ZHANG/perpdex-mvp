# PerpDex Vault Contract

USDC custody contract for PerpDex MVP trading platform.

## Overview

The Vault contract manages USDC deposits and withdrawals for the PerpDex trading platform.

### Features

- **Deposit**: Users deposit USDC via `approve` + `deposit` pattern
- **Withdraw**: Owner-only (backend), validates balance on-chain
- **Pause**: Owner can pause withdrawals (deposit still works)
- **Security**: ReentrancyGuard, Ownable, Pausable

## Quick Start

### Install Dependencies

```bash
forge install
```

### Build

```bash
forge build
```

### Test

```bash
forge test
```

### Test with Verbosity

```bash
forge test -vvv
```

### Coverage

```bash
forge coverage
```

## Deploy

### Setup Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your values
# - RPC_URL: Arbitrum Sepolia RPC endpoint
# - USDC_ADDRESS: 0x75faf114eafb1BDbe2F0316DF893fd58CE151AA5
# - PRIVATE_KEY: Your deployer wallet private key
```

### Deploy to Arbitrum Sepolia

```bash
source .env

forge script script/DeployVault.s.sol:DeployVault \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify \
    -vvvv
```

### Verify Deployment

After deployment, verify:
- [ ] Contract address recorded
- [ ] Owner address matches expected
- [ ] USDC address is correct
- [ ] Deposit/Withdraw functions work on testnet

## Contract Addresses (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| USDC | 0x75faf114eafb1BDbe2F0316DF893fd58CE151AA5 |
| Vault | TBD |

## Test Coverage

| Contract | Lines | Statements | Branches | Functions |
|----------|-------|------------|----------|-----------|
| Vault.sol | 100% | 100% | 83.33% | 100% |

## Security

### Implemented Protections

- **ReentrancyGuard**: All external functions protected
- **Ownable**: Admin functions restricted to owner
- **Pausable**: Withdrawals can be paused in emergencies
- **Input Validation**: Zero amount checks, balance checks
- **ETH Protection**: Explicit `receive()` revert

### Known Limitations (MVP)

1. Single owner (no multi-signature)
2. No ERC20 token rescue
3. No emergency withdrawal function

## License

MIT
