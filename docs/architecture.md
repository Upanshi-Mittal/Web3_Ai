# SentinelMesh Architecture

## Ownership

Satyam owns Solidity, Foundry tests, wallet/web3 integration, registry deployment, explorer links, and chain adapters.

Upanshi owns Next.js UI, API endpoints, agent orchestration, intent parsing, risk engine wiring, report storage, and demo polish.

Shared ownership includes product scope, integration, testing, README, demo flow, and final submission.

## Agent Contract

Every agent returns:

```ts
type AgentResult = {
  agentName: string;
  status: "pending" | "running" | "completed" | "warning" | "failed";
  confidence: number;
  reasoning: string[];
  output: unknown;
  timestamp: string;
};
```

Agents:

- `IntentAgent`: prompt to structured DeFi intent
- `RiskAgent`: explainable score and risk factors
- `RouteAgent`: route recommendation
- `ReportAgent`: deterministic report hash and report object
- `VerificationAgent`: local hash versus registry hash check

## Transaction Firewall

The API owns the firewall decision. The browser may edit policy settings, but the backend validates policy input and recomputes risk, quote fallback, evidence receipt, and final verdict before report creation.

Policy verdicts:

- `ALLOW`: no active policy violation and risk is below the warning threshold
- `WARN`: the action is usable only after reviewing policy warnings
- `BLOCK`: at least one blocking policy rule failed or risk is above the block threshold

Default policy checks:

- slippage limit
- transaction size limit
- token allowlist
- bridge enablement
- unlimited approval blocking
- minimum liquidity
- minimum pool age
- risk warning/block thresholds

The evidence receipt stores read-only observations such as liquidity, 24h volume, pool age, slippage estimate, approval type, simulation status, route sources, and evidence hash. Report hashes commit to the evidence receipt and firewall verdict.

## Raw Transaction Decoding

The API includes a v0 calldata decoder for common ERC-20 methods:

- `approve(address spender, uint256 amount)`
- `transfer(address to, uint256 amount)`
- `transferFrom(address from, address to, uint256 amount)`

When raw calldata is supplied to the firewall, decoded approval scope overrides the fallback approval estimate. `uint256.max` approvals are treated as unlimited approval risk, matched to the approval-drain scam pattern, and blocked by the default policy. Unsupported calldata remains `unknown` and does not create fake certainty.

## User-Facing Safety Surfaces

The frontend layers product-oriented views over the same server-computed firewall evaluation:

- Protocol trust graph: wallet -> token -> spender/protocol -> policy
- Explain mode: plain-English versus advanced calldata/policy details
- Recovery actions: what to do after `WARN` or `BLOCK`
- Browser signing guard mock: what a future wallet extension could show before MetaMask signing
- Agent reputation score: demo-friendly reliability score derived from blocked attempts, human-review requirements, and wallet health

These surfaces do not add hidden security decisions. They make the server verdict understandable for users, judges, and future integration partners.

## Agent Wallet Guardrails

`/agent-wallet` is a judge-facing prototype for autonomous-agent safety. It demonstrates:

- agent spending limits
- safe versus suspicious proposed actions
- policy-based allow/warn/block
- scam-pattern matching
- wallet health score
- transaction time machine
- kill switch / human-approval state
- local risk attestation report generation

The kill switch is a v0 policy decision, not an on-chain custody freeze. It means SentinelMesh would prevent the autonomous agent workflow from proceeding and require human approval before any wallet signature.

## Security Boundary

The report registry is intentionally narrow. It stores:

- user address
- report hash
- risk score
- recommendation
- report URI
- timestamp

It does not execute swaps, hold user funds, enforce custody rules on-chain, or make MEV guarantees.
