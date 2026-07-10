import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_AGENT_WALLET_POLICY, ReportCreateRequestSchema } from "@sentinelmesh/shared";

const validRequest = {
  prompt: "Swap 0.2 ETH to USDC safely",
  parsedIntent: {
    action: "swap",
    tokenIn: "ETH",
    tokenOut: "USDC",
    amount: "0.2",
    chain: "base",
    priority: "safety",
    constraints: { maxSlippage: "0.5%", riskTolerance: "low" }
  },
  selectedRouteId: "protected-swap"
};

test("accepts only the reviewed intent and selected route for report creation", () => {
  const parsed = ReportCreateRequestSchema.parse(validRequest);
  assert.equal(parsed.selectedRouteId, "protected-swap");
});

test("accepts a validated wallet policy for firewall-backed reports", () => {
  const parsed = ReportCreateRequestSchema.parse({
    ...validRequest,
    policy: DEFAULT_AGENT_WALLET_POLICY
  });
  assert.equal(parsed.policy?.allowBridges, false);
});

test("rejects client-supplied risk scores and recommendations", () => {
  assert.throws(
    () =>
      ReportCreateRequestSchema.parse({
        ...validRequest,
        riskScore: 1,
        recommendedRoute: { recommendedRoute: "STANDARD_ROUTE" }
      }),
    /Unrecognized key/
  );
});
