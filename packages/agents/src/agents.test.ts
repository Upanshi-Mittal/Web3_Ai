import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashReportPayload, parseIntentFallback, recomputeReportHash, runAgents, runIntentAgent, runRiskAgent } from ".";
import { IntentPromptSchema, type SentinelReport } from "@sentinelmesh/shared";

describe("intent parser fallback", () => {
  it("parses the core swap demo prompt", () => {
    const intent = parseIntentFallback("Swap 0.2 ETH to USDC safely with low slippage");

    assert.deepEqual(
      {
        action: intent.action,
        tokenIn: intent.tokenIn,
        tokenOut: intent.tokenOut,
        amount: intent.amount,
        chain: intent.chain,
        priority: intent.priority,
        constraints: intent.constraints
      },
      {
        action: "swap",
        tokenIn: "ETH",
        tokenOut: "USDC",
        amount: "0.2",
        chain: "ethereum",
        priority: "safety",
        constraints: { maxSlippage: "0.5%", riskTolerance: "low" }
      }
    );
  });

  it("parses a risky high-slippage ETH to PEPE swap", () => {
    assert.deepEqual(parseIntentFallback("Swap 10 ETH to PEPE as fast as possible with high slippage"), {
      action: "swap",
      tokenIn: "ETH",
      tokenOut: "PEPE",
      amount: "10",
      chain: "ethereum",
      priority: "speed",
      constraints: { maxSlippage: "3%" }
    });
  });

  it("parses an ETH bridge from Ethereum to Base", () => {
    assert.deepEqual(parseIntentFallback("Bridge 1 ETH from Ethereum to Base"), {
      action: "bridge",
      tokenIn: "ETH",
      amount: "1",
      chain: "ethereum",
      priority: "safety",
      constraints: {}
    });
  });

  it("parses an analyze prompt with token pair and amount", () => {
    const intent = parseIntentFallback("Analyze risk of swapping 2 ETH to DAI");

    assert.equal(intent.action, "analyze");
    assert.equal(intent.tokenIn, "ETH");
    assert.equal(intent.tokenOut, "DAI");
    assert.equal(intent.amount, "2");
  });

  it("marks unknown actions unsupported", () => {
    assert.deepEqual(parseIntentFallback("What is the weather today?"), {
      action: "unsupported",
      priority: "safety",
      constraints: {}
    });
  });

  it("rejects empty prompt validation", () => {
    assert.throws(() => IntentPromptSchema.parse({ prompt: "" }), /Prompt is required/);
  });

  it("extracts explicit slippage percentages", () => {
    assert.equal(parseIntentFallback("Swap 1 ETH to USDC with 1.25% slippage").constraints.maxSlippage, "1.25%");
  });

  it("returns a validated IntentAgent result", async () => {
    const result = await runIntentAgent("Convert 1 ETH into USDC");

    assert.equal(result.agentName, "IntentAgent");
    assert.equal(result.output.action, "swap");
    assert.equal(result.output.tokenIn, "ETH");
    assert.equal(result.output.tokenOut, "USDC");
  });
});

describe("agent orchestration", () => {
  it("returns structured trace outputs", async () => {
    const result = await runAgents({ prompt: "Swap 0.2 ETH to USDC safely with low slippage." });

    assert.equal(result.agentTrace.length, 3);
    assert.equal(result.parsedIntent.action, "swap");
    assert.ok(result.riskAnalysis.riskScore >= 0);
    assert.ok(result.routeRecommendation.recommendedRoute);
  });
});

describe("risk agent", () => {
  it("returns completed status and structured risk output for valid intent", async () => {
    const result = await runRiskAgent({
      action: "swap",
      tokenIn: "ETH",
      tokenOut: "USDC",
      amount: "0.2",
      chain: "ethereum",
      priority: "safety",
      constraints: { maxSlippage: "0.5%" }
    });

    assert.equal(result.agentName, "RiskAgent");
    assert.equal(result.status, "completed");
    assert.ok(result.output.riskScore >= 0);
    assert.ok(result.output.riskLevel);
    assert.ok(result.output.riskFactors);
    assert.ok(result.output.riskExplanations);
    assert.equal(result.output.topFactors.length, 3);
  });
});

describe("report hashing", () => {
  it("uses deterministic canonical hashing", () => {
    const payload = { b: 2, a: 1 };
    assert.equal(hashReportPayload(payload), hashReportPayload({ a: 1, b: 2 }));
  });

  it("recomputes a report hash from hashable fields", () => {
    const report = {
      id: "1",
      originalPrompt: "Swap 0.2 ETH to USDC",
      parsedIntent: { action: "swap", priority: "safety", constraints: {} },
      riskScore: 10,
      riskLevel: "Low",
      riskFactors: {
        slippageRisk: 1,
        liquidityRisk: 1,
        priceImpactRisk: 1,
        gasRisk: 1,
        tokenRisk: 1,
        routeComplexityRisk: 1,
        mevExposureRisk: 1
      },
      riskFactorExplanations: [],
      recommendedRoute: {
        recommendedRoute: "STANDARD_ROUTE",
        alternatives: [],
        pros: [],
        cons: [],
        explanation: "ok"
      },
      agentTrace: [],
      modelVersion: "test",
      reportHash: "0x0",
      reportURI: "sentinelmesh://reports/1",
      verificationStatus: "local-only",
      createdAt: "2026-06-15T00:00:00.000Z"
    } satisfies SentinelReport;

    assert.match(recomputeReportHash({ ...report, reportHash: recomputeReportHash(report) }), /^0x[a-f0-9]{64}$/);
  });
});
