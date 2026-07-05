import { createPublicClient, formatUnits, http, isAddress, parseUnits, type Address, type Hex } from "viem";
import { base, mainnet } from "viem/chains";
import type { DeFiIntent, QuotePreview } from "@sentinelmesh/shared";

type TokenMetadata = { address: Address; decimals: number };
type ZeroXQuote = {
  buyAmount?: string;
  minBuyAmount?: string;
  gas?: string;
  liquidityAvailable?: boolean;
  issues?: {
    allowance?: unknown;
    balance?: unknown;
    simulationIncomplete?: boolean;
  };
  route?: { fills?: Array<{ source?: string }> };
  transaction?: {
    to?: Address;
    data?: Hex;
    value?: string;
    gas?: string;
  };
};

export async function getQuotePreview(intent: DeFiIntent, takerAddress?: string): Promise<QuotePreview> {
  const chain = quoteChain(intent.chain);
  const pair = `${intent.tokenIn ?? "?"}/${intent.tokenOut ?? "?"}`;
  const fallback = (note: string): QuotePreview => ({
    provider: "fixture",
    status: "fallback",
    chainId: chain.id,
    pair,
    sellAmount: intent.amount ?? "unknown",
    routeSources: [],
    allowanceRequired: false,
    balanceIssue: false,
    simulation: { status: "not-configured" },
    observedAt: new Date().toISOString(),
    notes: [note]
  });

  if (intent.action !== "swap") return fallback("Executable quote preview is available only for swaps.");
  if (!process.env.ZEROX_API_KEY) return fallback("0x quote provider is not configured.");
  if (!takerAddress || !isAddress(takerAddress)) return fallback("Connect and authenticate a wallet to request a taker-specific quote.");
  if (!intent.tokenIn || !intent.tokenOut || !intent.amount) return fallback("Token pair and amount are required for a live quote.");

  const sellToken = tokenMetadata(chain.id, intent.tokenIn);
  const buyToken = tokenMetadata(chain.id, intent.tokenOut);
  if (!sellToken || !buyToken) return fallback("The selected token pair is not in the verified quote allowlist.");

  try {
    const params = new URLSearchParams({
      chainId: String(chain.id),
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: parseUnits(intent.amount, sellToken.decimals).toString(),
      taker: takerAddress
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`https://api.0x.org/swap/allowance-holder/quote?${params}`, {
      headers: {
        "0x-api-key": process.env.ZEROX_API_KEY,
        "0x-version": "v2",
        Accept: "application/json"
      },
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    if (!response.ok) throw new Error("Quote provider request failed");
    const quote = (await response.json()) as ZeroXQuote;
    if (!quote.liquidityAvailable || !quote.buyAmount) return fallback("0x did not find sufficient liquidity for this quote.");

    return {
      provider: "0x",
      status: "live",
      chainId: chain.id,
      pair,
      sellAmount: intent.amount,
      estimatedBuyAmount: formatUnits(BigInt(quote.buyAmount), buyToken.decimals),
      minimumBuyAmount: quote.minBuyAmount ? formatUnits(BigInt(quote.minBuyAmount), buyToken.decimals) : undefined,
      estimatedGas: quote.gas ?? quote.transaction?.gas,
      routeSources: [...new Set((quote.route?.fills ?? []).map((fill) => fill.source).filter((source): source is string => Boolean(source)))],
      allowanceRequired: Boolean(quote.issues?.allowance),
      balanceIssue: Boolean(quote.issues?.balance),
      simulation: await simulateQuote(chain.id, takerAddress, quote.transaction),
      observedAt: new Date().toISOString(),
      notes: [
        "Read-only 0x quote. SentinelMesh does not submit this transaction.",
        ...(quote.issues?.simulationIncomplete ? ["The quote provider reported incomplete simulation."] : [])
      ]
    };
  } catch {
    return fallback("Live quote or simulation data was unavailable; no transaction was prepared.");
  }
}

async function simulateQuote(
  chainId: number,
  account: Address,
  transaction?: ZeroXQuote["transaction"]
): Promise<QuotePreview["simulation"]> {
  const rpcUrl = chainId === base.id ? process.env.BASE_MAINNET_RPC_URL : process.env.ETHEREUM_MAINNET_RPC_URL;
  if (!rpcUrl || !transaction?.to || !transaction.data) return { status: "not-configured" };
  const client = createPublicClient({ chain: chainId === base.id ? base : mainnet, transport: http(rpcUrl) });
  const request = {
    account,
    to: transaction.to,
    data: transaction.data,
    value: BigInt(transaction.value ?? "0")
  } as const;

  try {
    await client.call(request);
    const gasEstimate = await client.estimateGas(request);
    return { status: "success", gasEstimate: gasEstimate.toString() };
  } catch (error) {
    return {
      status: "reverted",
      reason: sanitizeError(error instanceof Error ? error.message : "Simulation reverted")
    };
  }
}

function quoteChain(chain?: string) {
  return chain?.toLowerCase().includes("base") ? base : mainnet;
}

function tokenMetadata(chainId: number, symbol: string): TokenMetadata | undefined {
  const normalized = symbol.trim().toUpperCase();
  const tokens: Record<number, Record<string, TokenMetadata>> = {
    [mainnet.id]: {
      ETH: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
      WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
      USDC: { address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
      DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 }
    },
    [base.id]: {
      ETH: { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
      WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
      USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 }
    }
  };
  return tokens[chainId]?.[normalized];
}

function sanitizeError(message: string) {
  return message.replace(/\s+/g, " ").slice(0, 220);
}
