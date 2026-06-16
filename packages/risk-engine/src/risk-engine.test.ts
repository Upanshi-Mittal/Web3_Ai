import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeRisk, calculateRiskScore, clampRisk, getRiskLevel } from ".";
import type { DeFiIntent, RiskFactors } from "@sentinelmesh/shared";

const safeSwap: DeFiIntent = {
  action: "swap",
  tokenIn: "ETH",
  tokenOut: "USDC",
  amount: "0.2",
  chain: "ethereum",
  priority: "safety",
  constraints: { maxSlippage: "0.5%", riskTolerance: "low" }
};

describe("risk scoring", () => {
  it("calculates the weighted score using the v0 model without MEV exposure", () => {
    const factors: RiskFactors = {
      slippageRisk: 100,
      liquidityRisk: 50,
      priceImpactRisk: 50,
      gasRisk: 20,
      tokenRisk: 10,
      routeComplexityRisk: 0,
      mevExposureRisk: 100
    };

    assert.equal(calculateRiskScore(factors), 45);
  });

  it("clamps risk scores to 0-100", () => {
    assert.equal(clampRisk(-20), 0);
    assert.equal(clampRisk(120), 100);
    assert.equal(clampRisk(Number.NaN), 0);
  });

  it("maps risk level boundaries", () => {
    assert.equal(getRiskLevel(30), "Low");
    assert.equal(getRiskLevel(31), "Medium");
    assert.equal(getRiskLevel(60), "Medium");
    assert.equal(getRiskLevel(61), "High");
    assert.equal(getRiskLevel(80), "High");
    assert.equal(getRiskLevel(81), "Critical");
  });

  it("scores safe ETH to USDC swap as low risk", () => {
    const analysis = analyzeRisk(safeSwap);

    assert.equal(analysis.riskLevel, "Low");
    assert.equal(analysis.riskFactors.tokenRisk, 10);
    assert.equal(analysis.riskFactors.liquidityRisk, 15);
    assert.equal(analysis.topFactors.length, 3);
  });

  it("scores risky meme swap with high token, slippage, and MEV exposure", () => {
    const analysis = analyzeRisk({
      action: "swap",
      tokenIn: "ETH",
      tokenOut: "PEPE",
      amount: "10",
      chain: "ethereum",
      priority: "speed",
      constraints: { maxSlippage: "3%", riskTolerance: "high" }
    });

    assert.ok(["High", "Critical"].includes(analysis.riskLevel));
    assert.ok(analysis.riskFactors.tokenRisk >= 60);
    assert.ok(analysis.riskFactors.slippageRisk >= 60);
    assert.ok(analysis.riskFactors.mevExposureRisk >= 55);
  });

  it("scores unknown token with high token and liquidity risk", () => {
    const analysis = analyzeRisk({
      action: "swap",
      tokenIn: "ETH",
      tokenOut: "RANDOMXYZ",
      amount: "1",
      chain: "ethereum",
      priority: "safety",
      constraints: {}
    });

    assert.equal(analysis.riskFactors.tokenRisk, 85);
    assert.equal(analysis.riskFactors.liquidityRisk, 85);
  });

  it("scores large trade with high price impact and MEV exposure", () => {
    const analysis = analyzeRisk({
      action: "swap",
      tokenIn: "ETH",
      tokenOut: "USDC",
      amount: "100",
      chain: "ethereum",
      priority: "safety",
      constraints: { maxSlippage: "1%" }
    });

    assert.equal(analysis.riskFactors.priceImpactRisk, 90);
    assert.ok(analysis.riskFactors.mevExposureRisk >= 50);
  });

  it("scores bridge with higher route complexity", () => {
    const analysis = analyzeRisk({
      action: "bridge",
      tokenIn: "ETH",
      amount: "1",
      chain: "ethereum",
      priority: "safety",
      constraints: {}
    });

    assert.equal(analysis.riskFactors.routeComplexityRisk, 65);
    assert.ok(["Medium", "High"].includes(analysis.riskLevel));
  });

  it("scores unsupported intent as high or critical with clear explanation", () => {
    const analysis = analyzeRisk({
      action: "unsupported",
      priority: "safety",
      constraints: {}
    });

    assert.ok(["High", "Critical"].includes(analysis.riskLevel));
    assert.ok(analysis.riskExplanations.tokenRisk.includes("Unsupported actions"));
  });
});
