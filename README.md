# SentinelMesh

SentinelMesh is a production-style hackathon MVP for a multi-agent DeFi risk copilot.

Users enter an intent such as:

```txt
Swap 0.2 ETH to USDC safely with low slippage.
```

SentinelMesh parses the intent, runs explainable risk agents, recommends a safer route, generates a deterministic report hash, optionally stores that hash in a testnet registry, and shows report history with verification status.

## Problem

DeFi users are asked to sign complex transactions without a clear, verifiable risk trail. SentinelMesh adds a risk intelligence and verification layer before execution. V0 does not custody funds, execute swaps, or claim guaranteed MEV protection.

## Product Loop

```txt
Ask -> Parse -> Analyze -> Recommend -> Verify -> Save -> Share
```

## Architecture

```txt
apps/web
  Next.js App Router UI
  RainbowKit/wagmi wallet connection
  Risk dashboard, report history, verification pages

apps/api
  Express API
  Local JSON report storage
  Agent orchestration endpoints

packages/shared
  Product types and schemas

packages/agents
  IntentAgent, RiskAgent, RouteAgent, ReportAgent, VerificationAgent

packages/risk-engine
  Weighted risk model and route recommendation rules

packages/web3
  Registry ABI and testnet helpers

contracts
  Solidity SentinelReportRegistry
  Foundry deploy script and tests

data/fixtures
  Repeatable demo scenarios and fallback risk data
```

## Tech Stack

- Frontend: Next.js App Router, TypeScript, Tailwind
- Wallet/Web3: RainbowKit, wagmi, viem
- API: Node.js, Express, TypeScript
- Smart contracts: Solidity, Foundry
- Storage: local JSON file, replaceable later with Postgres/Supabase
- AI/agents: deterministic agent abstraction with fixture fallbacks
- Network: Base Sepolia or Ethereum Sepolia testnet

## Setup

```bash
cd sentinelmesh
cp .env.example .env
npm install
```

Run the full app:

```bash
npm run dev
```

Frontend: `http://localhost:3000`

API: `http://localhost:4000`

Run tests:

```bash
npm test
```

Type-check:

```bash
npm run typecheck
```

## API

Required endpoints are implemented:

- `GET /health`
- `POST /api/intent`
- `POST /api/risk`
- `POST /intent/parse`
- `POST /risk/analyze`
- `POST /route/recommend`
- `POST /agents/run`
- `POST /reports`
- `GET /reports`
- `GET /reports/:id`
- `POST /reports/:id/verify`

Local reports are stored at `data/reports.json`.

## Contracts

The v0 contract only stores report hashes. It does not execute swaps.

```bash
cd contracts
forge test
```

Deploy to Base Sepolia:

```bash
forge script script/DeploySentinelReportRegistry.s.sol \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

After deployment, set:

```bash
NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_EXPLORER_BASE_URL=https://sepolia.basescan.org
```

## Demo Scenarios

The app includes repeatable fixture fallbacks:

1. Safe ETH -> USDC swap
2. High-slippage risky swap
3. Unknown token
4. Large trade with MEV exposure
5. Unsupported bridge request
6. Critical risk route blocked

Happy path:

1. Open `/app`.
2. Use `Swap 0.2 ETH to USDC safely with low slippage.`
3. Run analysis.
4. Review editable intent, risk score, factors, route recommendation, and agent trace.
5. Connect a wallet.
6. Generate a report.
7. If a registry address is configured, anchor the report hash on testnet.
8. Open the report detail page and verify the hash.

## Environment Variables

See `.env.example`.

Important variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS`
- `NEXT_PUBLIC_EXPLORER_BASE_URL`
- `BASE_SEPOLIA_RPC_URL`
- `PRIVATE_KEY`

Never commit real private keys, seed phrases, or RPC secrets.

## Limitations

- V0 uses deterministic parsing and fixture-backed risk data by default.
- Live DEX quotes and private relay integrations are future adapters.
- Report verification checks local report hash equality with the supplied/on-chain report hash.
- Testnet-only report anchoring. No swap execution path is implemented.
- The registry stores report metadata; it does not custody funds or execute swaps.

## Roadmap

- Add live quote adapters with fixture fallback.
- Add Supabase/Postgres report storage.
- Read report hashes directly from the registry in VerificationAgent.
- Add explorer-indexed report history by wallet.
- Add protected route adapter integrations without claiming guaranteed MEV prevention.
- Add end-to-end browser tests for the full demo flow.
