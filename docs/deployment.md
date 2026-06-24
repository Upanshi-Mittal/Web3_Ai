# SentinelMesh Deployment Checklist

SentinelMesh v0 is testnet-only. The report registry stores report hashes and metadata; it does not execute swaps or custody user funds.

## 1. Preflight

Run locally before deploying:

```bash
npm install
npm run typecheck
npm test
npm run build
```

There is no root `lint` script currently. Use typecheck, tests, and production build as required QA.

## 2. API Deployment

Deploy the API to Render, Railway, Fly.io, or another Node host.

Recommended host settings:

- Service type: Node web service
- Root directory: repository root, unless the host requires `apps/api`
- Install command: `npm install`
- Build command: `npm run build -w @sentinelmesh/api`
- Start command: `npm run start -w @sentinelmesh/api`
- Health check: `/health`

Required backend env:

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

Notes:

- `GROQ_API_KEY` is optional. Without it, deterministic parser/risk fallback still works.
- `REPORT_REGISTRY_ADDRESS` and `REPORT_REGISTRY_RPC_URL` are required for backend on-chain verification.
- Keep `ALLOW_CLIENT_SUPPLIED_ONCHAIN_HASH=false` for production demos.
- Local report storage is JSON. For a longer-lived deployment, replace it with Supabase/Postgres.

## 3. Frontend Deployment

Deploy `apps/web` to Vercel.

Recommended Vercel settings:

- Framework preset: Next.js
- Root directory: `apps/web`
- Install command: `npm install`
- Build command: `npm run build -w @sentinelmesh/web`
- Output directory: Next.js default

Required frontend env:

```bash
NEXT_PUBLIC_API_URL=https://your-api.example.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE=https://sepolia.basescan.org/tx/{txHash}
NEXT_PUBLIC_EXPLORER_LABEL=BaseScan
```

`NEXT_PUBLIC_API_URL` must point to the deployed API URL. Local development falls back to `http://localhost:4000`, but production should never rely on localhost.

`NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS` can remain blank until Satyam deploys `SentinelReportRegistry`. Missing contract metadata should show local-only/not-configured UI and must not break the app.

## 4. Contract Metadata

After Satyam deploys the registry:

1. Copy the deployed contract address.
2. Add it to API env as `REPORT_REGISTRY_ADDRESS`.
3. Add it to web env as `NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS`.
4. Set `REPORT_REGISTRY_RPC_URL` on the API.
5. Set `NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE` on the frontend.
6. Redeploy API and frontend.

Placeholder until deployment:

```txt
CONTRACT_ADDRESS=CONTRACT_ADDRESS
NETWORK=Base Sepolia or selected testnet
EXPLORER_URL=...
```

## 5. Clean-Browser Smoke Test

Run this after every deployment from a browser/session with no local dev state.

- Landing page loads.
- `/app` loads.
- Intent prompt accepts text.
- Intent Agent produces editable structured intent.
- Risk cards render.
- Route cards render.
- Agent timeline updates through Intent, Risk, Route, Report, and Verification agents.
- Report generates in simulation mode.
- `/reports` shows the new report.
- Report detail page opens.
- Copy link works.
- Copy hash works.
- JSON download works.
- Web3 verification state is honest:
  - local-only when registry metadata is absent
  - pending/verified only when on-chain metadata exists and verification is performed

## 6. On-Chain Smoke Test

Only run after contract deployment and wallet setup.

1. Open the deployed app.
2. Connect wallet.
3. Confirm wallet is on the selected testnet.
4. Use `Report On-chain` mode.
5. Generate report.
6. Confirm wallet transaction.
7. Confirm transaction hash appears.
8. Open report detail.
9. Click verify.
10. Confirm local hash matches registry hash and badge shows verified.

## 7. Rollback And Debug Notes

If frontend cannot reach API:

- Check `NEXT_PUBLIC_API_URL`.
- Open `${NEXT_PUBLIC_API_URL}/health`.
- Confirm CORS is enabled on the API.

If report generation fails:

- Check API logs for `/reports`.
- Confirm `REPORTS_DB_PATH` is writable on the host.
- Use simulation mode to isolate Web3 from report creation.

If wallet anchoring fails:

- Confirm `NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS`.
- Confirm wallet network.
- Confirm ABI matches deployed contract.
- Confirm user has testnet funds.

If verification fails:

- Confirm `REPORT_REGISTRY_ADDRESS`.
- Confirm `REPORT_REGISTRY_RPC_URL`.
- Confirm `REPORT_REGISTRY_CHAIN_ID`.
- Confirm the report was created by the same wallet that is being verified.

If live data or Groq fails:

- Leave `GROQ_API_KEY` blank and use deterministic fallback scenarios.
- Use the safe and risky demo prompts from `docs/demo-script.md`.
