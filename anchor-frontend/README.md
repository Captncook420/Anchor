# ANCHOR Protocol

A DeFi protocol built on Bitcoin Layer 1 via [OPNet](https://opnet.org). ANCHOR creates a self-reinforcing economic flywheel where child token emissions generate buy pressure and staking rewards for ANCHOR holders.

## How It Works

1. **Factory creates child tokens** paired with MOTO liquidity on MotoSwap
2. **Child stakers earn emissions** from their respective child token pools
3. **1% platform fee** from every child emission buys ANCHOR + MOTO, then burns the LP
4. **ANCHOR entering the pool** triggers sell-pressure rewards for ANCHOR stakers
5. **More child tokens launched = more ANCHOR buy pressure = higher staking yields**

## Architecture

### Smart Contracts (`anchor-contracts/`)

| Contract | Description |
|----------|-------------|
| **AnchorToken** | OP20 token (1B supply, 18 decimals) with sell-pressure flow tracking. Transfers through approved pools update flow maps — tokens into pool = sell pressure, out = buy pressure. |
| **AnchorStaker** | MasterChef-style LP staking for ANCHOR/MOTO pair. Two reward sources: base emission (69,444 ANCHOR/block) + sell-pressure bonus. Time multiplier (0-100% over ~10 days), cooldown system, compound support. |
| **AnchorFactory** | On-chain factory that deploys child tokens and stakers from pre-deployed templates using `deployContractFromExisting()`. Two-step flow: deploy token, then finalize with LP pair. |
| **ChildToken** | Template — identical to AnchorToken mechanics (sell-pressure tracking, flow maps). Cloned per token by the factory. |
| **ChildStaker** | Template — same as AnchorStaker plus 1% platform fee that feeds the ANCHOR flywheel. Dev fee goes to token creator. |

### Frontend (`anchor-frontend/`)

React + TypeScript + Vite application with OPWallet integration.

**Pages:**
- **Dashboard** — Protocol stats, flywheel diagram, activity feeds
- **Stake** — Stake/unstake ANCHOR/MOTO LP, claim/compound rewards
- **Factory** — Launch new child tokens with MOTO liquidity
- **Token Detail** — Per-token staking, trading, and LP management

## Staking Mechanics

- **Time Multiplier**: Rewards scale from 0% to 100% linearly over 1,440 blocks (~10 days). Claiming resets the multiplier; compounding preserves it.
- **Un-multiplied Rewards**: The portion lost to a low multiplier is redistributed to all other stakers proportionally.
- **Cooldown**: 1,008 blocks (~7 days) after claiming before unstake is allowed. Compounding reduces cooldown proportionally — compound the same amount you claimed and the cooldown is fully removed.
- **Boost**: After dev fee (10%), staker rewards receive a 150% boost.
- **Sell-Pressure Bonus**: Additional rewards from sell-pressure flow tracking on approved pools.

## Setup

### Prerequisites

- Node.js 18+
- [OPWallet](https://opwallet.org) browser extension

### Contracts

```bash
cd anchor-contracts
npm install
npm run build        # Compiles all 6 contracts to WASM
npm run deploy       # Interactive deployment script
```

### Frontend

```bash
cd anchor-frontend
npm install
npm run dev          # Development server
npm run build        # Production build
```

## Network

- **Testnet**: `https://testnet.opnet.org` (Signet fork)
- **Mainnet**: `https://mainnet.opnet.org`

The frontend reads the network from the connected OPWallet. Contracts are deployed via the deploy script which supports resume (`RESUME_FROM` env var) for interrupted deployments.

## Tech Stack

- **Contracts**: AssemblyScript → WebAssembly, `@btc-vision/btc-runtime`
- **Frontend**: React 19, TypeScript, Vite, Framer Motion
- **Blockchain**: OPNet SDK (`opnet`), `@btc-vision/bitcoin`, `@btc-vision/transaction`
- **DEX**: MotoSwap (router + factory) for LP creation and swaps
- **Wallet**: OPWallet via `@btc-vision/walletconnect`

## License

MIT — see [LICENSE](../LICENSE) for details.
