import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createPublicClient, http, isAddress, verifyMessage, type Hex } from "viem";
import { parseSiweMessage, verifySiweMessage } from "viem/siwe";
import { supportedChains } from "@sentinelmesh/web3";

export type AuthSession = {
  address: `0x${string}`;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
};

export function createAuthService({
  secret,
  allowedDomains,
  nonceTtlMs = 5 * 60_000,
  sessionTtlMs = 7 * 24 * 60 * 60_000
}: {
  secret: string;
  allowedDomains: string[];
  nonceTtlMs?: number;
  sessionTtlMs?: number;
}) {
  if (secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  const nonces = new Map<string, number>();

  function issueNonce() {
    const now = Date.now();
    for (const [nonce, expiresAt] of nonces) {
      if (expiresAt <= now) nonces.delete(nonce);
    }
    const nonce = randomBytes(16).toString("hex");
    nonces.set(nonce, now + nonceTtlMs);
    return nonce;
  }

  async function verifySiwe({ message, signature }: { message: string; signature: Hex }): Promise<AuthSession> {
    const parsed = parseSiweMessage(message);
    if (!parsed.address || !isAddress(parsed.address) || !parsed.chainId || !parsed.domain || !parsed.nonce) {
      throw new Error("SIWE message is missing required fields");
    }
    if (!allowedDomains.includes(parsed.domain)) throw new Error("SIWE domain is not allowed");

    const nonceExpiresAt = nonces.get(parsed.nonce);
    nonces.delete(parsed.nonce);
    if (!nonceExpiresAt || nonceExpiresAt <= Date.now()) throw new Error("SIWE nonce is invalid or expired");

    const chain = supportedChains.find((candidate) => candidate.id === parsed.chainId);
    if (!chain) throw new Error("SIWE chain is not supported");

    let valid = await verifyMessage({ address: parsed.address, message, signature });
    if (!valid) {
      const client = createPublicClient({ chain, transport: http() });
      valid = await verifySiweMessage(client, {
        address: parsed.address,
        domain: parsed.domain,
        message,
        nonce: parsed.nonce,
        signature
      });
    }
    if (!valid) throw new Error("SIWE signature is invalid");

    const issuedAt = Date.now();
    return {
      address: parsed.address,
      chainId: parsed.chainId,
      issuedAt,
      expiresAt: issuedAt + sessionTtlMs
    };
  }

  function createSessionToken(session: AuthSession) {
    const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
    return `${payload}.${sign(payload, secret)}`;
  }

  function readSessionToken(token?: string): AuthSession | undefined {
    if (!token) return undefined;
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return undefined;
    try {
      const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSession;
      if (!isAddress(session.address) || !supportedChains.some((chain) => chain.id === session.chainId)) return undefined;
      if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) return undefined;
      return session;
    } catch {
      return undefined;
    }
  }

  return { issueNonce, verifySiwe, createSessionToken, readSessionToken };
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
