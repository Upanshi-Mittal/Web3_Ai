import assert from "node:assert/strict";
import test from "node:test";
import type { DeFiIntent } from "@sentinelmesh/shared";
import { getQuotePreview } from "./quote-adapter.js";

const intent: DeFiIntent = {
  action: "swap",
  tokenIn: "ETH",
  tokenOut: "USDC",
  amount: "0.2",
  chain: "base",
  priority: "safety",
  constraints: { maxSlippage: "0.5%" }
};

test("returns a safe fallback when 0x is not configured", async () => {
  const previousKey = process.env.ZEROX_API_KEY;
  delete process.env.ZEROX_API_KEY;
  try {
    const quote = await getQuotePreview(intent, "0x1111111111111111111111111111111111111111");
    assert.equal(quote.status, "fallback");
    assert.equal(quote.simulation.status, "not-configured");
    assert.match(quote.notes[0], /not configured/);
  } finally {
    if (previousKey) process.env.ZEROX_API_KEY = previousKey;
  }
});
