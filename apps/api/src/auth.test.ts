import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { createAuthService } from "./auth.js";

const account = privateKeyToAccount("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
const secret = "sentinelmesh-test-session-secret-32-characters";

test("verifies SIWE once and rejects nonce replay", async () => {
  const auth = createAuthService({ secret, allowedDomains: ["localhost:3000"] });
  const nonce = auth.issueNonce();
  const message = createSiweMessage({
    address: account.address,
    chainId: 84532,
    domain: "localhost:3000",
    nonce,
    uri: "http://localhost:3000",
    version: "1"
  });
  const signature = await account.signMessage({ message });
  const session = await auth.verifySiwe({ message, signature });

  assert.equal(session.address, account.address);
  await assert.rejects(() => auth.verifySiwe({ message, signature }), /nonce is invalid or expired/);
});

test("signed session tokens reject tampering", () => {
  const auth = createAuthService({ secret, allowedDomains: ["localhost:3000"] });
  const session = {
    address: account.address,
    chainId: 84532,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000
  };
  const token = auth.createSessionToken(session);

  assert.deepEqual(auth.readSessionToken(token), session);
  assert.equal(auth.readSessionToken(`${token}x`), undefined);
});
