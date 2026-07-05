# SentinelMesh Deployment

This project is testnet-only in v0. The registry stores verifiable report hashes; it does not execute swaps or custody user funds.

## 1. API Environment

Set these on Render, Railway, Fly.io, or the API host:

```bash
PORT=4000
REPORTS_DB_PATH=data/reports.json
DATABASE_URL=postgresql://...
DATABASE_SSL=require
ALLOWED_ORIGINS=https://your-app.vercel.app
API_RATE_LIMIT_PER_MINUTE=120
AUTH_ALLOWED_DOMAINS=your-app.vercel.app
SESSION_SECRET=generate-a-random-secret-with-at-least-32-characters
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
ZEROX_API_KEY=...
ETHEREUM_MAINNET_RPC_URL=https://...
BASE_MAINNET_RPC_URL=https://...
REPORT_REGISTRY_ADDRESS=0x...
REPORT_REGISTRY_CHAIN_ID=84532
REPORT_REGISTRY_RPC_URL=https://...
ALLOW_CLIENT_SUPPLIED_ONCHAIN_HASH=false
```

`REPORT_REGISTRY_RPC_URL` lets the backend verify reports by reading `SentinelReportRegistry.getUserReports(user)` directly. Keep `ALLOW_CLIENT_SUPPLIED_ONCHAIN_HASH=false` for production demos; client-supplied hashes are useful only for local development without an RPC URL.

`SESSION_SECRET` signs SIWE session cookies and is mandatory when `NODE_ENV=production`. Rotate it deliberately because rotation invalidates active sessions. `AUTH_ALLOWED_DOMAINS` must contain hostnames only, without a URL scheme.

Use `DATABASE_URL` for hosted deployments. The API initializes the `sentinel_reports` table and indexes; `apps/api/migrations/001_reports.sql` is also available for managed migration workflows. Without `DATABASE_URL`, use a persistent disk for `REPORTS_DB_PATH` and run only one API instance.

`ZEROX_API_KEY` enables server-side 0x AllowanceHolder quote previews. Mainnet RPC variables are used only for `eth_call` and gas estimation. SentinelMesh does not expose quote calldata to the browser, broadcast mainnet transactions, or execute swaps.

## 2. Web Environment

Set these on Vercel:

```bash
NEXT_PUBLIC_API_URL=https://your-api.example.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE=https://sepolia.basescan.org/tx/{txHash}
NEXT_PUBLIC_EXPLORER_LABEL=BaseScan
```

## 3. Contract Deployment

Install Foundry, fund the deployer on Base Sepolia, then run:

```bash
cd contracts
forge test
forge script script/DeploySentinelReportRegistry.s.sol \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify
```

Copy the deployed registry address into both API and web environments.

## 4. Demo Readiness Checklist

- Groq key configured and `/api/intent` returns Groq reasoning.
- `/ready` reports the expected LLM and registry capability state.
- `ALLOWED_ORIGINS` contains only the deployed frontend origins.
- WalletConnect project id configured.
- SIWE login succeeds, survives refresh, and logs out when the wallet disconnects.
- API egress can reach `api.dexscreener.com`; disabling egress produces a labeled deterministic fallback.
- `/api/quote` returns sanitized live evidence when 0x is configured and a labeled fallback otherwise.
- `/ready` reports `storage: postgres` and the expected quote/simulation capability flags in production.
- A forged report request containing client-supplied risk fields returns HTTP 400.
- A registry transaction is accepted only when its receipt contains the matching `ReportCreated` event.
- `forge test -vv` passes all registry invariant and replay-protection tests before deployment.
- Concurrent API report writes pass the repository regression test without dropped records.
- Registry deployed on Base Sepolia.
- API has `REPORT_REGISTRY_RPC_URL`, not only frontend public env vars.
- User can create a local report in simulation mode.
- User can connect wallet and anchor report hash in Report On-chain mode.
- Report detail page can read the registry and mark the report verified.
- README contains the live app, API, registry, and explorer links before submission.

## 5. Platform Configuration

`render.yaml` provisions the API Docker service and Postgres database. Add secret values in Render before deployment. The API image uses `Dockerfile.api` and exposes `/ready` for health checks.

For Vercel, set the project root to `apps/web`, use the Next.js framework preset, and configure the web variables from section 2. Keep API secrets out of Vercel `NEXT_PUBLIC_*` variables.
