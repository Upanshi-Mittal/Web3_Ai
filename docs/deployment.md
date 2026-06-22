# SentinelMesh Deployment

This project is testnet-only in v0. The registry stores verifiable report hashes; it does not execute swaps or custody user funds.

## 1. API Environment

Set these on Render, Railway, Fly.io, or the API host:

```bash
PORT=4000
REPORTS_DB_PATH=data/reports.json
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
REPORT_REGISTRY_ADDRESS=0x...
REPORT_REGISTRY_CHAIN_ID=84532
REPORT_REGISTRY_RPC_URL=https://...
ALLOW_CLIENT_SUPPLIED_ONCHAIN_HASH=false
```

`REPORT_REGISTRY_RPC_URL` lets the backend verify reports by reading `SentinelReportRegistry.getUserReports(user)` directly. Keep `ALLOW_CLIENT_SUPPLIED_ONCHAIN_HASH=false` for production demos; client-supplied hashes are useful only for local development without an RPC URL.

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
- WalletConnect project id configured.
- Registry deployed on Base Sepolia.
- API has `REPORT_REGISTRY_RPC_URL`, not only frontend public env vars.
- User can create a local report in simulation mode.
- User can connect wallet and anchor report hash in Report On-chain mode.
- Report detail page can read the registry and mark the report verified.
- README contains the live app, API, registry, and explorer links before submission.
