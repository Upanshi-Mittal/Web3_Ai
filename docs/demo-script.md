# SentinelMesh Demo And Submission Script

Use this as the final Upanshi-side demo guide. Fill live URLs after deployment.

## Links To Fill

- Live app: `LIVE_APP_URL`
- API: `API_URL`
- Contract: `CONTRACT_ADDRESS`
- Demo video: `DEMO_VIDEO_URL`

## 2-Minute Demo Video Script

### 0:00-0:15 - Problem

"AI agents and DeFi users are starting to control wallets, but every signature can move real assets. SentinelMesh acts as an AI transaction firewall: before a wallet or agent signs, it decodes the action, simulates what it can, checks policy, explains risk with evidence, and creates a verifiable safety trail."

Show:

- Landing page
- Product safety boundary text

### 0:15-0:35 - Safe Intent

Prompt:

```txt
Swap 50 USDC to ETH with max 1% slippage.
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

### 0:55-1:15 - Route Recommendation And Firewall

Narration:

"The Route Agent compares possible routes and clearly marks the recommendation. Then the transaction firewall checks the action against wallet policy: slippage limit, token allowlist, liquidity floor, pool age, bridge policy, approval type, and risk threshold."

Show:

- Route comparison
- Recommended badge
- Pros/tradeoffs
- Supported execution modes
- Transaction firewall panel
- `ALLOW` decision for the safe case
- Evidence hash and decoded action

### 1:15-1:35 - Report Generation

Narration:

"The user can create a deterministic risk report. The report hash commits to the risk score, route recommendation, policy decision, and evidence receipt. Without deployed contract metadata, SentinelMesh creates an honest local-only report. With the testnet registry configured, the hash can be anchored on-chain."

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

### 1:50-2:15 - Agent Kill Switch

Prompt:

```txt
Bridge 5000 USDC to a new high-yield protocol on an unknown chain.
```

Narration:

"For the strongest AI-agent story, open Agent Wallet mode. The agent first proposes a safe rebalance, then a suspicious high-yield bridge. SentinelMesh detects policy violations and scam-pattern signals, pauses the agent, requires human approval, and saves a risk attestation."

Show:

- `/agent-wallet`
- Safe rebalance scenario
- Suspicious yield scenario
- High-risk explanation
- Firewall `BLOCK` decision
- Blocking policy violations
- Wallet health score
- Transaction time machine
- Agent kill switch
- Saved local attestation report

## Screenshot Checklist

Capture these before submission:

- Landing page hero and safety boundary
- `/app` with parsed safe intent
- Risk score and top risk factors
- Route comparison with recommended route
- Transaction firewall with ALLOW decision
- Risky scenario with BLOCK decision
- `/agent-wallet` safe scenario
- `/agent-wallet` kill switch paused state
- Wallet health score and scam-pattern cards
- Wallet/report sidebar with local-only or transaction state
- Agent timeline with all five agents visible
- `/reports` history with counts/search/filter
- Report detail page with verification badge
- Copy/download actions visible
- Optional: risky scenario showing high-risk/report-only handling

## Final Pitch Text

SentinelMesh is an AI transaction firewall for DeFi users and autonomous agents. Before a wallet or agent signs, SentinelMesh parses the intent, scores slippage/liquidity/token/gas/route/MEV exposure, checks user-defined policy, explains the decision with evidence, and generates a verifiable report that can be saved, shared, and anchored on-chain through a testnet registry.

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

SentinelMesh v0 is a risk intelligence, policy, and verification layer. It does not custody funds, execute swaps, or guarantee MEV protection.
