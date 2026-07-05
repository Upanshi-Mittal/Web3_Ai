# SentinelMesh

SentinelMesh is a production-style hackathon MVP for a multi-agent DeFi risk copilot.

Users enter an intent such as:

```txt
Swap 0.2 ETH to USDC safely with low slippage.
```

SentinelMesh parses the intent, runs explainable risk agents, recommends a safer route, generates a deterministic report hash, optionally stores that hash in a testnet registry, and shows report history with verification status.

For supported swap pairs, risk analysis also includes read-only live pool evidence such as liquidity, 24-hour volume, price movement, and pool age. External market failures fall back to deterministic policy factors.

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
  Postgres or serialized local JSON report storage
  Agent orchestration, SIWE, live market evidence, and verification endpoints

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
- Authentication: EIP-4361 SIWE with one-time nonces and signed HTTP-only sessions
- API: Node.js, Express, TypeScript
- Smart contracts: Solidity, Foundry
- Storage: Postgres in hosted environments, serialized local JSON fallback
- Quote evidence: optional server-side 0x AllowanceHolder quote plus read-only RPC simulation
- AI/agents: optional Groq-backed intent/risk agents with deterministic fixture fallbacks
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
- `GET /ready`
- `GET /auth/nonce`
- `POST /auth/verify`
- `GET /auth/session`
- `POST /auth/logout`
- `POST /api/intent`
- `POST /api/risk`
- `POST /api/quote`
- `POST /intent/parse`
- `POST /risk/analyze`
- `POST /route/recommend`
- `POST /agents/run`
- `POST /reports`
- `GET /reports`
- `GET /reports/:id`
- `POST /reports/:id/verify`

Local reports are stored at `data/reports.json`. Set `DATABASE_URL` to use the production Postgres repository; the API creates the required table and indexes idempotently.

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
REPORT_REGISTRY_ADDRESS=0x...
REPORT_REGISTRY_CHAIN_ID=84532
REPORT_REGISTRY_RPC_URL=https://...
NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE=https://sepolia.basescan.org/tx/{txHash}
```

See `docs/deployment.md` for the full API, frontend, and contract deployment checklist.

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

- `ALLOWED_ORIGINS`
- `API_RATE_LIMIT_PER_MINUTE`
- `AUTH_ALLOWED_DOMAINS`
- `SESSION_SECRET`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS`
- `NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `DATABASE_URL`
- `DATABASE_SSL`
- `ZEROX_API_KEY`
- `ETHEREUM_MAINNET_RPC_URL`
- `BASE_MAINNET_RPC_URL`
- `REPORT_REGISTRY_ADDRESS`
- `REPORT_REGISTRY_RPC_URL`
- `BASE_SEPOLIA_RPC_URL`
- `PRIVATE_KEY`

Never commit real private keys, seed phrases, or RPC secrets.

## Limitations

- V0 uses Groq for intent parsing and risk explanation when `GROQ_API_KEY` is configured; otherwise it falls back to deterministic parsing and fixture-backed risk data.
- Local JSON storage is reliable for a single API instance. Hosted deployments should set `DATABASE_URL` so all instances share Postgres.
- The optional 0x adapter is a read-only mainnet quote preview for allowlisted token pairs. It never returns calldata to the browser or broadcasts a transaction.
- Report verification checks the local report hash against the registry when API RPC metadata is configured. Local development can still run without RPC metadata.
- Wallet-owned report creation requires a matching authenticated SIWE session. Public report viewing remains shareable.
- Report scores and recommendations are recomputed by the API. Client-supplied risk fields are rejected.
- Wallet-owned reports are filtered from other users' history; direct report links remain shareable.
- DEX Screener evidence is read-only and never treated as an executable route guarantee.
- JSON persistence is serialized behind a repository interface so concurrent writes cannot overwrite reports; Postgres remains the deployment target for horizontal scaling.
- The registry rejects zero hashes, invalid scores, empty metadata, and duplicate hashes from the same user.
- Testnet-only report anchoring. No swap execution path is implemented.
- The registry stores report metadata; it does not custody funds or execute swaps.

## Roadmap

- Persist signed quote evidence in report payloads after provider-specific normalization.
- Add explorer-indexed report history by wallet.
- Add protected route adapter integrations without claiming guaranteed MEV prevention.
- Add end-to-end browser tests for the full demo flow.
