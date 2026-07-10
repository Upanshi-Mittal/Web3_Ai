# SentinelMesh

SentinelMesh is an AI transaction firewall for DeFi users and autonomous agents. It turns natural-language DeFi intents into decoded actions, explainable risk analysis, policy decisions, route recommendations, and verifiable risk reports.

> Status: hackathon-ready local v0. Final public URLs and deployed contract address must be added after deployment.

## Submission Links

- Live app: `LIVE_APP_URL`
- API: `API_URL`
- Report Registry contract: `CONTRACT_ADDRESS`
- Demo video: `DEMO_VIDEO_URL`

## What The App Does

Users describe a DeFi action in plain English, for example:

```txt
I want to swap 50 USDC to ETH on a low-risk route with minimal slippage.
```

SentinelMesh then:

1. Parses the request into editable structured intent.
2. Scores execution risk with explainable factors.
3. Compares route options and recommends a safer action.
4. Checks the action against an agent wallet policy.
5. Allows, warns, or blocks before signing.
6. Detects v0 scam patterns such as approval drains, suspicious bridges, unknown tokens, thin liquidity, and high slippage.
7. Computes wallet health plus agent kill-switch or human-approval state.
8. Optionally decodes raw ERC-20 calldata such as `approve(spender, amount)` before signing.
9. Shows a protocol trust graph, beginner/advanced explanations, and recovery actions.
10. Generates a deterministic risk report with evidence receipt.
11. Saves the report in history.
12. Optionally anchors the report hash on a testnet registry when Web3 deployment metadata is configured.

For supported swap pairs, the risk engine can add read-only DEX Screener liquidity, volume, price-movement, and pool-age evidence. An optional server-side 0x adapter provides a sanitized quote and read-only simulation preview without exposing calldata or broadcasting a transaction. Reports persist a canonical evidence receipt with liquidity, volume, pool age, slippage estimate, approval type, simulation status, route sources, and an evidence hash.

SentinelMesh v0 does not custody funds, execute swaps, or claim guaranteed MEV protection. It is a risk intelligence, policy, and verification layer.

## Final User Flow

```txt
Open app -> connect wallet -> enter intent -> optionally paste raw approval calldata -> see risk explanation -> see route recommendation -> run firewall policy -> generate report -> open history -> verify report hash
Open agent demo -> run safe action -> run suspicious yield action -> see kill switch -> save attestation
```

The full local flow works without a deployed contract by creating local-only reports. On-chain verification requires Satyam's deployed `SentinelReportRegistry` address and RPC metadata.

## Tech Stack

- Frontend: Next.js App Router, TypeScript, Tailwind
- Wallet/Web3: RainbowKit, wagmi, viem
- API: Node.js, Express, TypeScript
- Smart contracts: Solidity, Foundry
- Storage: Postgres in hosted environments with serialized local JSON fallback
- Agents: custom Intent, Risk, Route, Report, and Verification agents
- AI: optional Groq-backed intent/risk explanations with deterministic fallback
- Quote evidence: optional server-side 0x AllowanceHolder quote and read-only RPC simulation
- Deployment target: Vercel for frontend, Render/Railway/Fly.io for API

## Monorepo Structure

```txt
apps/web
  Next.js UI, wallet UI, firewall dashboard, agent-wallet demo, reports, report detail

apps/api
  Express API, report storage, agent endpoints, policy firewall evaluation

packages/shared
  Shared TypeScript types, Zod schemas, policy/evidence/report contracts

packages/agents
  IntentAgent, RiskAgent, RouteAgent, ReportAgent, VerificationAgent

packages/risk-engine
  Deterministic risk scoring and route rules

packages/web3
  Registry ABI, Web3 metadata adapters, transaction state helpers

contracts
  SentinelReportRegistry Solidity contract, Foundry tests, deploy script

data/fixtures
  Repeatable demo scenarios and fallback data

docs
  Architecture, deployment checklist, demo script
```

## Local Setup

```bash
cd sentinelmesh
cp .env.example .env
npm install
npm run dev
```

Local URLs:

- Web: `http://localhost:3000`
- App: `http://localhost:3000/app`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

Useful commands:

```bash
npm run typecheck
npm test
npm run build
```

There is no root `lint` script currently. TypeScript checks and tests are the primary automated QA commands.

## Environment Variables

Copy `.env.example` and fill only what you need for the environment.

### Frontend

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS=
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE=https://sepolia.basescan.org/tx/{txHash}
NEXT_PUBLIC_EXPLORER_LABEL=BaseScan
```

`NEXT_PUBLIC_API_URL` must point to the deployed API URL in production. If it is missing locally, the web app safely falls back to `http://localhost:4000`.

`NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS` can stay empty before contract deployment. The UI will show local-only/report-not-configured states instead of breaking.

### API

```bash
PORT=4000
REPORTS_DB_PATH=data/reports.json
DATABASE_URL=
DATABASE_SSL=disable
ALLOWED_ORIGINS=http://localhost:3000
AUTH_ALLOWED_DOMAINS=localhost:3000
SESSION_SECRET=
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
ZEROX_API_KEY=
ETHEREUM_MAINNET_RPC_URL=
BASE_MAINNET_RPC_URL=
REPORT_REGISTRY_ADDRESS=
REPORT_REGISTRY_CHAIN_ID=84532
REPORT_REGISTRY_RPC_URL=
ALLOW_CLIENT_SUPPLIED_ONCHAIN_HASH=false
```

`REPORT_REGISTRY_RPC_URL` lets the API verify reports by reading `SentinelReportRegistry.getUserReports(user)`.

### Contracts

```bash
BASE_SEPOLIA_RPC_URL=
SEPOLIA_RPC_URL=
PRIVATE_KEY=
```

Never commit real private keys, seed phrases, RPC secrets, or production API keys.

## Frontend Deployment

Deploy `apps/web` to Vercel.

Recommended settings:

- Framework: Next.js
- Root directory: `apps/web`
- Install command: `npm install`
- Build command: `npm run build -w @sentinelmesh/web`
- Output: Next.js default

Required Vercel env:

```bash
NEXT_PUBLIC_API_URL=https://your-api.example.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS=0x... # add after Satyam deploys
NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE=https://sepolia.basescan.org/tx/{txHash}
NEXT_PUBLIC_EXPLORER_LABEL=BaseScan
```

## API Deployment

Deploy `apps/api` to Render, Railway, Fly.io, or another Node host.

Recommended settings:

- Root directory: repository root or `apps/api` depending on host
- Install command: `npm install`
- Build command: `npm run build -w @sentinelmesh/api`
- Start command: `npm run start -w @sentinelmesh/api`

Required backend env:

```bash
PORT=4000
REPORTS_DB_PATH=data/reports.json
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
REPORT_REGISTRY_ADDRESS=0x... # add after Satyam deploys
REPORT_REGISTRY_CHAIN_ID=84532
REPORT_REGISTRY_RPC_URL=https://...
ALLOW_CLIENT_SUPPLIED_ONCHAIN_HASH=false
```

## Contract Address Placeholder

Final deployed contract address will be added after Satyam deploys `SentinelReportRegistry`.

```txt
CONTRACT_ADDRESS=CONTRACT_ADDRESS
NETWORK=Base Sepolia or selected testnet
EXPLORER_URL=...
```

Until this is configured, SentinelMesh still supports local report generation and honest local-only verification states.

## Demo Flow

Safe scenario:

```txt
Swap 50 USDC to ETH with max 1% slippage.
```

Risky scenario:

```txt
Bridge 5000 USDC to a new high-yield protocol on an unknown chain.
```

Agent-wallet scenario:

```txt
An AI DeFi agent tries a safe rebalance, then tries a suspicious high-yield bridge.
SentinelMesh allows/reviews the safe action, blocks the risky action, pauses the agent, and saves a risk attestation.
```

Judge walkthrough:

1. Open `LIVE_APP_URL` or `/app` locally.
2. Connect wallet if Web3 metadata is configured.
3. Enter the safe scenario.
4. Parse intent.
5. Run risk analysis.
6. Review risk score, explanations, route cards, and agent timeline.
7. Run the transaction firewall policy check.
8. Show `ALLOW` on the safe case, then show `BLOCK` on the risky bridge case.
9. Open `/agent-wallet`.
10. Show safe agent action and suspicious yield action.
11. Show kill switch, wallet health score, transaction time machine, and scam-pattern cards.
12. Generate a report for the safe or blocked case.
13. Open `/reports`.
14. Open the report detail page.
15. Show copy link, copy hash, evidence hash, JSON download, and verification status.

See `docs/demo-script.md` for the 2-minute narration and screenshot checklist.
See `docs/deployment-architecture.md` for the full component-by-component deployment architecture.

## Known Limitations

- Contract verification requires a deployed testnet registry address and API RPC metadata.
- Final public app URL, API URL, contract address, and demo video URL must be added after deployment.
- The 0x adapter is read-only and supports only allowlisted pairs; evidence receipts are persisted, but no swap calldata is exposed or executed by SentinelMesh.
- Local JSON storage is intended for a single local API instance. Hosted deployments should configure Postgres.
- Testnet-only report anchoring. No swap execution path is implemented.
- SentinelMesh estimates risk; it does not guarantee MEV protection or fully secure execution.

## Submission Readiness Checklist

- `npm run typecheck` passes.
- `npm test` passes.
- `npm run build` passes.
- `/app` loads from a clean browser.
- Intent parsing works.
- Risk cards render.
- Route cards render.
- Firewall policy returns allow/warn/block.
- Raw ERC-20 unlimited approval calldata is decoded and blocked.
- `/agent-wallet` shows safe/risky agent demos.
- Agent kill switch and wallet health score render.
- Protocol trust graph, explain toggle, recovery actions, agent reputation, and signing-guard mock render.
- Report generates.
- `/reports` shows the saved report.
- Report detail opens.
- Evidence hash and firewall decision appear on the report detail page.
- Copy link/hash works.
- JSON download works.
- Web3 verification state is honest when registry metadata is missing.
- `LIVE_APP_URL`, `API_URL`, `CONTRACT_ADDRESS`, and `DEMO_VIDEO_URL` are filled before final submission.
