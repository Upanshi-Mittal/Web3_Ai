import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRisk } from "@sentinelmesh/risk-engine";
import type { DeFiIntent, MarketEvidence } from "@sentinelmesh/shared";
import { applyMarketEvidence } from "./market-intelligence.js";

const intent: DeFiIntent = {
  action: "swap",
  tokenIn: "ETH",
  tokenOut: "USDC",
  amount: "0.2",
  chain: "base",
  priority: "safety",
  constraints: { maxSlippage: "0.5%", riskTolerance: "low" }
};

test("live thin liquidity raises the explainable liquidity factor", () => {
  const evidence: MarketEvidence = {
    source: "dexscreener",
    status: "live",
    chain: "base",
    pair: "ETH/USDC",
    dex: "test-dex",
    liquidityUsd: 25_000,
    observedAt: new Date().toISOString(),
    notes: []
  };
  const result = applyMarketEvidence(analyzeRisk(intent), evidence);

  assert.equal(result.riskFactors.liquidityRisk, 90);
  assert.match(result.riskExplanations.liquidityRisk, /Live pool liquidity/);
  assert.equal(result.marketEvidence?.status, "live");
});

test("fallback evidence preserves deterministic factors", () => {
  const base = analyzeRisk(intent);
  const result = applyMarketEvidence(base, {
    source: "fixture",
    status: "fallback",
    chain: "base",
    pair: "ETH/USDC",
    observedAt: new Date().toISOString(),
    notes: ["offline"]
  });

  assert.deepEqual(result.riskFactors, base.riskFactors);
  assert.equal(result.marketEvidence?.status, "fallback");
});
