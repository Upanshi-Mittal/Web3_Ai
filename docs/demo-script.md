# SentinelMesh Demo And Submission Script

Use this as the final Upanshi-side demo guide. Fill live URLs after deployment.

## Links To Fill

- Live app: `LIVE_APP_URL`
- API: `API_URL`
- Contract: `CONTRACT_ADDRESS`
- Demo video: `DEMO_VIDEO_URL`

## 2-Minute Demo Video Script

### 0:00-0:15 - Problem

"DeFi users often sign transactions without understanding slippage, liquidity, token, route, gas, or MEV-style ordering risk. SentinelMesh gives them a risk report before they make that decision."

Show:

- Landing page
- Product safety boundary text

### 0:15-0:35 - Safe Intent

Prompt:

```txt
I want to swap 50 USDC to ETH on a low-risk route with minimal slippage.
```

Narration:

"I can type a normal human DeFi intent. The Intent Agent turns it into structured fields that the user can correct before analysis."

Show:

- `/app`
- Prompt input
- Editable intent card
- Agent timeline after IntentAgent

### 0:35-0:55 - Risk Explanation

Narration:

"The Risk Agent returns a 0-100 risk score with plain-English explanations. It does not hide the result in a black-box response."

Show:

- Risk score
- Top factor cards
- Full risk breakdown

### 0:55-1:15 - Route Recommendation

Narration:

"The Route Agent compares possible routes and clearly marks the recommendation. For v0 this is advisory risk intelligence, not automatic swap execution."

Show:

- Route comparison
- Recommended badge
- Pros/tradeoffs
- Supported execution modes

### 1:15-1:35 - Report Generation

Narration:

"The user can create a deterministic risk report. Without deployed contract metadata, SentinelMesh creates an honest local-only report. With the testnet registry configured, the hash can be anchored on-chain."

Show:

- Wallet/report sidebar
- Transaction state panel
- Report saved state
- Agent timeline showing ReportAgent and VerificationAgent

### 1:35-1:50 - History And Verification

Narration:

"Reports are saved in history, searchable, downloadable, and shareable. The detail page shows verification status, report hash, and the full agent trace."

Show:

- `/reports`
- Search/filter/counts
- Report detail
- Copy link
- Copy hash
- Download JSON
- Verification badge

### 1:50-2:00 - Risky Scenario

Prompt:

```txt
I want to bridge 5000 USDC to a new high-yield protocol on an unfamiliar chain.
```

Narration:

"For risky or unsupported flows, SentinelMesh does not overclaim. It pushes the user toward simulation and report-only review when risk is high."

Show:

- High-risk explanation or unsupported fallback
- Route/report-only state

## Screenshot Checklist

Capture these before submission:

- Landing page hero and safety boundary
- `/app` with parsed safe intent
- Risk score and top risk factors
- Route comparison with recommended route
- Wallet/report sidebar with local-only or transaction state
- Agent timeline with all five agents visible
- `/reports` history with counts/search/filter
- Report detail page with verification badge
- Copy/download actions visible
- Optional: risky scenario showing high-risk/report-only handling

## Final Pitch Text

SentinelMesh is a multi-agent DeFi risk copilot that helps users understand execution risk before signing transactions. A user enters a natural-language intent, SentinelMesh parses it into structured fields, scores slippage/liquidity/token/gas/route/MEV exposure, recommends a safer route, and generates a verifiable report that can be saved, shared, and anchored on-chain through a testnet registry.

## Submission Checklist

- `LIVE_APP_URL` added to README.
- `API_URL` added to README.
- `CONTRACT_ADDRESS` added after Satyam deploys.
- `DEMO_VIDEO_URL` added after upload.
- Safe scenario tested.
- Risky scenario tested.
- Clean-browser smoke test completed.
- README includes setup, deployment, limitations, and demo flow.
- `docs/deployment.md` checked.
- Screenshots captured.
- Demo video uploaded.

## Safety Boundary To Say Out Loud

SentinelMesh v0 is a risk intelligence and verification layer. It does not custody funds, execute swaps, or guarantee MEV protection.
