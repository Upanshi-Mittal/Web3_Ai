import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const account = privateKeyToAccount("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
const intent = {
  action: "swap",
  tokenIn: "ETH",
  tokenOut: "USDC",
  amount: "0.2",
  chain: "ethereum",
  priority: "safety",
  constraints: { maxSlippage: "0.5%", riskTolerance: "low" }
};

test("API enforces SIWE ownership, server-authoritative reports, and history privacy", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sentinelmesh-api-"));
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "sentinelmesh-integration-session-secret-32-characters";
  process.env.AUTH_ALLOWED_DOMAINS = "localhost:3000";
  process.env.REPORTS_DB_PATH = path.join(directory, "reports.json");
  process.env.DISABLE_LIVE_MARKET_DATA = "true";

  const { app } = await import("./server.js");
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const forged = await post(baseUrl, "/reports", {
      prompt: "Swap safely",
      parsedIntent: intent,
      selectedRouteId: "swap-protected-review",
      riskScore: 1
    });
    assert.equal(forged.status, 400);

    const anonymous = await post(baseUrl, "/reports", {
      prompt: "Swap safely",
      parsedIntent: intent,
      selectedRouteId: "swap-protected-review"
    });
    assert.equal(anonymous.status, 201);
    const anonymousReport = await anonymous.json() as { id: string; riskScore: number };
    assert.notEqual(anonymousReport.riskScore, 1);

    const quote = await post(baseUrl, "/api/quote", { intent });
    assert.equal(quote.status, 200);
    const quoteBody = await quote.json() as { provider: string; status: string };
    assert.equal(quoteBody.provider, "fixture");
    assert.equal(quoteBody.status, "fallback");

    const nonceResponse = await fetch(`${baseUrl}/auth/nonce`);
    const { nonce } = await nonceResponse.json() as { nonce: string };
    const message = createSiweMessage({
      address: account.address,
      chainId: 84532,
      domain: "localhost:3000",
      nonce,
      uri: "http://localhost:3000",
      version: "1"
    });
    const signature = await account.signMessage({ message });
    const authResponse = await post(baseUrl, "/auth/verify", { message, signature });
    assert.equal(authResponse.status, 200);
    const cookie = authResponse.headers.get("set-cookie");
    assert.ok(cookie?.includes("HttpOnly"));

    const owned = await post(
      baseUrl,
      "/reports",
      {
        prompt: "Authenticated swap",
        parsedIntent: intent,
        selectedRouteId: "swap-protected-review",
        userAddress: account.address
      },
      cookie ?? undefined
    );
    assert.equal(owned.status, 201);
    const ownedReport = await owned.json() as { id: string };

    const publicHistory = await fetch(`${baseUrl}/reports`).then((response) => response.json()) as Array<{ id: string }>;
    assert.ok(publicHistory.some((report) => report.id === anonymousReport.id));
    assert.ok(!publicHistory.some((report) => report.id === ownedReport.id));

    const walletHistory = await fetch(`${baseUrl}/reports`, { headers: { Cookie: cookie ?? "" } }).then((response) => response.json()) as Array<{ id: string }>;
    assert.ok(walletHistory.some((report) => report.id === ownedReport.id));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

function post(baseUrl: string, pathname: string, body: unknown, cookie?: string) {
  return fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body)
  });
}
