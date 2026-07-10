import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRisk } from "@sentinelmesh/risk-engine";
import { DEFAULT_AGENT_WALLET_POLICY, type DeFiIntent } from "@sentinelmesh/shared";
import { evaluateFirewall } from "./firewall.js";
import { decodeRawTransaction } from "./transaction-decoder.js";

const safeSwap: DeFiIntent = {
  action: "swap",
  tokenIn: "ETH",
  tokenOut: "USDC",
  amount: "0.02",
  chain: "base",
  priority: "safety",
  constraints: { maxSlippage: "0.5%", riskTolerance: "low" }
};

test("firewall allows a low-risk swap that satisfies policy", () => {
  const analysis = {
    ...analyzeRisk(safeSwap),
    marketEvidence: {
      source: "fixture" as const,
      status: "live" as const,
      chain: "base",
      pair: "ETH/USDC",
      liquidityUsd: 2_000_000,
      volume24hUsd: 850_000,
      pairAgeDays: 420,
      observedAt: new Date().toISOString(),
      notes: ["fixture evidence"]
    }
  };
  const result = evaluateFirewall({ intent: safeSwap, analysis, policy: DEFAULT_AGENT_WALLET_POLICY });

  assert.equal(result.decision, "ALLOW");
  assert.equal(result.violations.length, 0);
  assert.equal(result.guardrailState.killSwitchTriggered, false);
  assert.equal(result.walletHealth.level, "Healthy");
  assert.match(result.transactionPreview.evidence.evidenceHash, /^0x[a-f0-9]{64}$/);
});

test("firewall blocks bridges and high-risk actions under default policy", () => {
  const bridge: DeFiIntent = {
    action: "bridge",
    tokenIn: "USDC",
    amount: "5000",
    chain: "unknown high-yield chain",
    priority: "yield",
    constraints: { maxSlippage: "5%", riskTolerance: "high" }
  };
  const result = evaluateFirewall({
    intent: bridge,
    analysis: analyzeRisk(bridge),
    policy: DEFAULT_AGENT_WALLET_POLICY
  });

  assert.equal(result.decision, "BLOCK");
  assert.ok(result.violations.some((violation) => violation.ruleId === "bridge-disabled"));
  assert.equal(result.guardrailState.killSwitchTriggered, true);
  assert.ok(result.scamPatterns.some((pattern) => pattern.patternId === "suspicious-bridge-yield"));
});

test("firewall blocks raw unlimited ERC-20 approval calldata", () => {
  const decodedTransaction = decodeRawTransaction({
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenSymbol: "USDC",
    data:
      "0x095ea7b3000000000000000000000000000000000000000000000000000000000000deadffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  });
  const result = evaluateFirewall({
    intent: safeSwap,
    analysis: analyzeRisk(safeSwap),
    decodedTransaction,
    policy: DEFAULT_AGENT_WALLET_POLICY
  });

  assert.equal(result.transactionPreview.approvalType, "unlimited");
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.guardrailState.killSwitchTriggered, true);
  assert.ok(result.scamPatterns.some((pattern) => pattern.patternId === "approval-drain"));
});
