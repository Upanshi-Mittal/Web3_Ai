import type { DeFiIntent, MarketEvidence, RiskAnalysis, RiskFactors } from "@sentinelmesh/shared";
import { calculateRiskScore, getRiskLevel } from "@sentinelmesh/risk-engine";

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  baseToken?: { symbol?: string };
  quoteToken?: { symbol?: string };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  pairCreatedAt?: number;
};

export async function inspectMarket(intent: DeFiIntent): Promise<MarketEvidence> {
  const pair = `${intent.tokenIn ?? "?"}/${intent.tokenOut ?? "?"}`;
  const chain = marketChain(intent.chain);
  if (process.env.DISABLE_LIVE_MARKET_DATA === "true") {
    return fallbackEvidence(chain, pair, "Live market data is disabled for this runtime.");
  }
  if (!intent.tokenIn || !intent.tokenOut || !["swap", "analyze"].includes(intent.action)) {
    return fallbackEvidence(chain, pair, "Live pair data is not applicable to this intent.");
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const tokenAddress = knownTokenAddress(chain, intent.tokenIn);
    const endpoint = tokenAddress
      ? `https://api.dexscreener.com/token-pairs/v1/${chain}/${tokenAddress}`
      : `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(pair)}`;
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    if (!response.ok) throw new Error("Market provider request failed");
    const payload = (await response.json()) as { pairs?: DexPair[] } | DexPair[];
    const pairs = Array.isArray(payload) ? payload : (payload.pairs ?? []);
    const matches = pairs
      .filter((candidate) => candidate.chainId === chain)
      .filter((candidate) => pairMatches(candidate, intent.tokenIn!, intent.tokenOut!))
      .sort((left, right) => (right.liquidity?.usd ?? 0) - (left.liquidity?.usd ?? 0));
    const best = matches[0];
    if (!best) return fallbackEvidence(chain, pair, "No matching live liquidity pool was found.");

    return {
      source: "dexscreener",
      status: "live",
      chain,
      pair,
      dex: best.dexId,
      liquidityUsd: finiteNumber(best.liquidity?.usd),
      volume24hUsd: finiteNumber(best.volume?.h24),
      priceChange24h: finiteNumber(best.priceChange?.h24),
      pairAgeDays: best.pairCreatedAt ? Math.max(0, (Date.now() - best.pairCreatedAt) / 86_400_000) : undefined,
      url: best.url,
      observedAt: new Date().toISOString(),
      notes: ["Read-only market evidence; SentinelMesh does not execute this pool route."]
    };
  } catch {
    return fallbackEvidence(chain, pair, "Live market data was unavailable; deterministic risk defaults remain active.");
  }
}

export function applyMarketEvidence(analysis: RiskAnalysis, evidence: MarketEvidence): RiskAnalysis {
  if (evidence.status !== "live") return { ...analysis, marketEvidence: evidence };

  const riskFactors: RiskFactors = { ...analysis.riskFactors };
  const riskExplanations = { ...analysis.riskExplanations };
  if (evidence.liquidityUsd !== undefined) {
    riskFactors.liquidityRisk = liquidityRisk(evidence.liquidityUsd);
    riskExplanations.liquidityRisk = `Live pool liquidity is approximately ${formatUsd(evidence.liquidityUsd)} on ${evidence.dex ?? "the selected DEX"}.`;
  }
  if (evidence.priceChange24h !== undefined && Math.abs(evidence.priceChange24h) >= 20) {
    riskFactors.tokenRisk = Math.max(riskFactors.tokenRisk, 65);
    riskExplanations.tokenRisk = `The live pair moved ${evidence.priceChange24h.toFixed(1)}% over 24 hours, increasing volatility risk.`;
  }

  const riskScore = calculateRiskScore(riskFactors);
  const riskLevel = getRiskLevel(riskScore);
  const factorExplanations = analysis.factorExplanations.map((factor) => ({
    ...factor,
    score: riskFactors[factor.key],
    explanation: riskExplanations[factor.key]
  }));
  const topFactors = [...factorExplanations].sort((left, right) => right.score - left.score).slice(0, 3);

  return {
    ...analysis,
    riskScore,
    riskLevel,
    riskFactors,
    riskExplanations,
    topFactors,
    dataSource: "mixed",
    summary: `${riskLevel} risk using deterministic policy signals plus live market evidence.`,
    factors: riskFactors,
    factorExplanations,
    marketEvidence: evidence
  };
}

function pairMatches(pair: DexPair, tokenIn: string, tokenOut: string) {
  const base = pair.baseToken?.symbol ?? "";
  const quote = pair.quoteToken?.symbol ?? "";
  return (sameToken(base, tokenIn) && sameToken(quote, tokenOut)) || (sameToken(base, tokenOut) && sameToken(quote, tokenIn));
}

function sameToken(left: string, right: string) {
  const normalize = (value: string) => value.trim().toUpperCase().replace(/^WETH$/, "ETH");
  return normalize(left) === normalize(right);
}

function marketChain(chain?: string) {
  return chain?.toLowerCase().includes("base") ? "base" : "ethereum";
}

function knownTokenAddress(chain: string, symbol: string) {
  const addresses: Record<string, Record<string, string>> = {
    ethereum: {
      ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      USDC: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    },
    base: {
      ETH: "0x4200000000000000000000000000000000000006",
      WETH: "0x4200000000000000000000000000000000000006",
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }
  };
  return addresses[chain]?.[symbol.trim().toUpperCase()];
}

function liquidityRisk(liquidityUsd: number) {
  if (liquidityUsd < 50_000) return 90;
  if (liquidityUsd < 250_000) return 70;
  if (liquidityUsd < 1_000_000) return 50;
  if (liquidityUsd < 5_000_000) return 30;
  return 10;
}

function fallbackEvidence(chain: string, pair: string, note: string): MarketEvidence {
  return {
    source: "fixture",
    status: "fallback",
    chain,
    pair,
    observedAt: new Date().toISOString(),
    notes: [note]
  };
}

function finiteNumber(value?: number) {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
