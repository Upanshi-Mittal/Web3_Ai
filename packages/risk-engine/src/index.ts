import {
  type DeFiIntent,
  RISK_FACTOR_LABELS,
  type RiskAnalysis,
  type RiskFactors,
  type RiskLevel,
  type RouteRecommendation,
  type RouteType
} from "@sentinelmesh/shared";

export const RISK_ENGINE_VERSION = "sentinelmesh-risk-v0.3";

export const RISK_WEIGHTS: Record<Exclude<keyof RiskFactors, "mevExposureRisk">, number> = {
  slippageRisk: 0.2,
  liquidityRisk: 0.2,
  priceImpactRisk: 0.2,
  gasRisk: 0.15,
  tokenRisk: 0.15,
  routeComplexityRisk: 0.1
};

const COMMON_TOKENS = new Set(["ETH", "WETH", "USDC", "USDT", "DAI", "WBTC"]);
const MEME_TOKENS = new Set(["PEPE", "SHIB", "DOGE", "FLOKI", "BONK"]);
const COMMON_PAIRS = new Set(["ETH/USDC", "WETH/USDC", "ETH/DAI", "USDC/DAI"]);
const LOW_GAS_CHAINS = new Set(["base", "arbitrum", "optimism", "polygon"]);

export function clampRisk(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getRiskLevel(score: number): RiskLevel {
  const clamped = clampRisk(score);
  if (clamped <= 30) return "Low";
  if (clamped <= 60) return "Medium";
  if (clamped <= 80) return "High";
  return "Critical";
}

export function calculateRiskScore(factors: RiskFactors): number {
  const weighted =
    clampRisk(factors.slippageRisk) * RISK_WEIGHTS.slippageRisk +
    clampRisk(factors.liquidityRisk) * RISK_WEIGHTS.liquidityRisk +
    clampRisk(factors.priceImpactRisk) * RISK_WEIGHTS.priceImpactRisk +
    clampRisk(factors.gasRisk) * RISK_WEIGHTS.gasRisk +
    clampRisk(factors.tokenRisk) * RISK_WEIGHTS.tokenRisk +
    clampRisk(factors.routeComplexityRisk) * RISK_WEIGHTS.routeComplexityRisk;

  return clampRisk(weighted);
}

export function estimateRiskFactors(intent: DeFiIntent): RiskFactors {
  const baseFactors = {
    slippageRisk: scoreSlippageRisk(intent),
    liquidityRisk: scoreLiquidityRisk(intent),
    priceImpactRisk: scorePriceImpactRisk(intent),
    gasRisk: scoreGasRisk(intent),
    tokenRisk: scoreTokenRisk(intent),
    routeComplexityRisk: scoreRouteComplexityRisk(intent),
    mevExposureRisk: scoreMevExposureRisk(intent)
  };

  return clampFactors(baseFactors);
}

export function analyzeRisk(intent: DeFiIntent, fixtureFactors?: RiskFactors): RiskAnalysis {
  const riskFactors = clampFactors(fixtureFactors ?? estimateRiskFactors(intent));
  const riskScore = calculateRiskScore(riskFactors);
  const riskLevel = getRiskLevel(riskScore);
  const riskExplanations = buildRiskExplanations(intent, riskFactors);
  const factorExplanations = (Object.entries(riskFactors) as Array<[keyof RiskFactors, number]>).map(([key, score]) => ({
    key,
    label: RISK_FACTOR_LABELS[key],
    score,
    explanation: riskExplanations[key]
  }));
  const topFactors = [...factorExplanations].sort((a, b) => b.score - a.score).slice(0, 3);
  const summary = buildRiskSummary(riskLevel, intent, topFactors);

  return {
    riskScore,
    riskLevel,
    riskFactors,
    riskExplanations,
    topFactors,
    dataSource: fixtureFactors ? "fixture" : "mixed",
    riskEngineVersion: RISK_ENGINE_VERSION,
    summary,
    factors: riskFactors,
    factorExplanations
  };
}

export function recommendRoute(analysis: RiskAnalysis): RouteRecommendation {
  const score = analysis.riskScore;
  const mevRisk = analysis.riskFactors.mevExposureRisk;
  const priceImpact = analysis.riskFactors.priceImpactRisk;
  let recommendedRoute: RouteType;

  if (score > 85) {
    recommendedRoute = "BLOCKED_UNSAFE";
  } else if (score > 70) {
    recommendedRoute = mevRisk >= 75 || priceImpact >= 70 ? "SPLIT_ORDER" : "PROTECTED_ROUTE";
  } else if (score > 40) {
    recommendedRoute = "DELAYED_EXECUTION";
  } else {
    recommendedRoute = "STANDARD_ROUTE";
  }

  return {
    recommendedRoute,
    alternatives: buildAlternatives(recommendedRoute),
    pros: routePros(recommendedRoute),
    cons: routeCons(recommendedRoute),
    explanation: routeExplanation(recommendedRoute, analysis)
  };
}

function scoreSlippageRisk(intent: DeFiIntent): number {
  if (intent.action === "unsupported") return 85;
  const slippage = parsePercent(intent.constraints.maxSlippage);
  const riskToleranceBump = intent.constraints.riskTolerance === "high" ? 15 : 0;
  if (slippage === undefined) {
    if (intent.priority === "safety") return 25 + riskToleranceBump;
    if (intent.priority === "speed") return 55 + riskToleranceBump;
    return 40 + riskToleranceBump;
  }
  if (slippage <= 0.5) return 15 + riskToleranceBump;
  if (slippage <= 1) return 30 + riskToleranceBump;
  if (slippage <= 3) return 60 + riskToleranceBump;
  return 85 + riskToleranceBump;
}

function scoreLiquidityRisk(intent: DeFiIntent): number {
  if (intent.action === "bridge" || intent.action === "unsupported") return 70;
  if (hasUnknownToken(intent)) return 85;
  if (isCommonPair(intent)) return 15;
  if (hasCommonToken(intent) && hasMemeToken(intent)) return intent.constraints.riskTolerance === "high" ? 65 : 60;
  if (hasCommonToken(intent)) return 25;
  return 85;
}

function scorePriceImpactRisk(intent: DeFiIntent): number {
  if (intent.action === "unsupported") return 75;
  const amount = parseAmount(intent.amount);
  if (amount === undefined) return 45;

  const tokenIn = normalizeToken(intent.tokenIn);
  let score: number;
  if (tokenIn === "ETH" || tokenIn === "WETH") {
    score = amount <= 1 ? 15 : amount <= 10 ? 35 : amount <= 50 ? 65 : 90;
  } else if (tokenIn === "USDC" || tokenIn === "USDT" || tokenIn === "DAI") {
    score = amount <= 1000 ? 15 : amount <= 10000 ? 35 : amount <= 100000 ? 65 : 90;
  } else {
    score = 50;
  }

  if (isMemeToken(intent.tokenOut) || isUnknownToken(intent.tokenOut)) score += 15;
  if (intent.constraints.riskTolerance === "high") score += 20;
  return score;
}

function scoreGasRisk(intent: DeFiIntent): number {
  const chain = normalizeChain(intent.chain);
  let score = chain === "ethereum" ? 45 : LOW_GAS_CHAINS.has(chain) ? 20 : 35;
  if (intent.priority === "speed") score += 10;
  if (intent.priority === "cost") score -= 10;
  return score;
}

function scoreTokenRisk(intent: DeFiIntent): number {
  if (intent.action === "unsupported") return 90;
  if (hasUnknownToken(intent)) return 85;
  if (hasMemeToken(intent)) return 60;
  if (areBothTokensCommon(intent)) return 10;
  return 45;
}

function scoreRouteComplexityRisk(intent: DeFiIntent): number {
  const chain = normalizeChain(intent.chain);
  const unknownChainBump = chain === "unknown" ? 10 : 0;
  const map: Record<DeFiIntent["action"], number> = {
    swap: 15,
    stake: 35,
    bridge: 65,
    analyze: 25,
    unsupported: 90
  };
  return map[intent.action] + unknownChainBump;
}

function scoreMevExposureRisk(intent: DeFiIntent): number {
  let score = intent.action === "bridge" || intent.action === "unsupported" ? 50 : 25;
  if (intent.priority === "speed") score += 15;
  if ((parsePercent(intent.constraints.maxSlippage) ?? 0) > 3) score += 20;
  if (isLargeTrade(intent)) score += 25;
  if (hasUnknownToken(intent) || hasMemeToken(intent)) score += 15;
  return score;
}

function buildRiskExplanations(intent: DeFiIntent, factors: RiskFactors): Record<keyof RiskFactors, string> {
  return {
    slippageRisk: explainSlippage(factors.slippageRisk),
    liquidityRisk: explainLiquidity(intent),
    priceImpactRisk: "Large trades can move the execution price more, especially in lower-liquidity pools.",
    gasRisk: "Gas risk depends on the selected chain and whether the user prioritizes speed or cost.",
    tokenRisk: explainTokenRisk(intent),
    routeComplexityRisk: explainRouteComplexity(intent),
    mevExposureRisk:
      "MEV exposure means bots may attempt to profit from transaction ordering. SentinelMesh estimates exposure but does not guarantee MEV protection."
  };
}

function explainSlippage(score: number): string {
  if (score <= 20) return "User requested conservative slippage, reducing chance of receiving much less than expected.";
  if (score <= 60) return "Slippage tolerance is moderate, so execution price may differ from estimate.";
  return "High slippage tolerance can allow poor execution.";
}

function explainLiquidity(intent: DeFiIntent): string {
  if (intent.action === "bridge" || intent.action === "unsupported") {
    return "Bridge or unsupported actions carry higher liquidity uncertainty in the v0 deterministic model.";
  }
  if (hasUnknownToken(intent)) return "An unknown token is involved, so liquidity is treated as high risk.";
  if (hasMemeToken(intent)) return "A speculative token is involved, so available liquidity may be thinner or more volatile.";
  if (isCommonPair(intent)) return "The token pair is common and usually has deeper liquidity.";
  return "The pair uses known assets, but it is not one of the deepest fixture pairs.";
}

function explainTokenRisk(intent: DeFiIntent): string {
  if (intent.action === "unsupported") return "Unsupported actions cannot be safely analyzed as executable DeFi intents in v0.";
  if (hasUnknownToken(intent)) return "An unknown token was detected, which increases contract and market risk.";
  if (hasMemeToken(intent)) return "A speculative token was detected, which increases volatility and liquidity risk.";
  if (areBothTokensCommon(intent)) return "Both tokens are common assets in the v0 allowlist.";
  return "The token set is partially known, so the model applies a moderate token-risk default.";
}

function explainRouteComplexity(intent: DeFiIntent): string {
  if (intent.action === "bridge") return "Bridge routes involve cross-chain complexity and are riskier than simple swaps.";
  if (intent.action === "unsupported") return "Unsupported actions are treated as high complexity because SentinelMesh cannot model them safely.";
  if (intent.action === "stake") return "Staking has more protocol-specific assumptions than a simple swap.";
  if (intent.action === "analyze") return "Analyze-only requests avoid execution but still need a risk explanation.";
  return "A simple swap has low route complexity in the v0 model.";
}

function buildRiskSummary(level: RiskLevel, intent: DeFiIntent, topFactors: Array<{ label: string }>): string {
  if (intent.action === "unsupported") {
    return "Unsupported actions cannot be safely analyzed as executable routes; review or rewrite the prompt.";
  }
  const factorList = topFactors.map((factor) => factor.label).join(", ");
  return `${level} risk based on ${factorList || "the deterministic v0 risk factors"}.`;
}

function parsePercent(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseAmount(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isLargeTrade(intent: DeFiIntent): boolean {
  const amount = parseAmount(intent.amount);
  const tokenIn = normalizeToken(intent.tokenIn);
  if (amount === undefined) return false;
  if (tokenIn === "ETH" || tokenIn === "WETH") return amount > 10;
  if (tokenIn === "USDC" || tokenIn === "USDT" || tokenIn === "DAI") return amount > 10000;
  return amount > 10;
}

function clampFactors(factors: RiskFactors): RiskFactors {
  return {
    slippageRisk: clampRisk(factors.slippageRisk),
    liquidityRisk: clampRisk(factors.liquidityRisk),
    priceImpactRisk: clampRisk(factors.priceImpactRisk),
    gasRisk: clampRisk(factors.gasRisk),
    tokenRisk: clampRisk(factors.tokenRisk),
    routeComplexityRisk: clampRisk(factors.routeComplexityRisk),
    mevExposureRisk: clampRisk(factors.mevExposureRisk)
  };
}

function normalizeToken(token?: string): string {
  return token?.trim().toUpperCase() ?? "";
}

function normalizeChain(chain?: string): string {
  return chain?.trim().toLowerCase() || "unknown";
}

function isCommonToken(token?: string): boolean {
  return COMMON_TOKENS.has(normalizeToken(token));
}

function isMemeToken(token?: string): boolean {
  return MEME_TOKENS.has(normalizeToken(token));
}

function isUnknownToken(token?: string): boolean {
  const normalized = normalizeToken(token);
  return Boolean(normalized && !COMMON_TOKENS.has(normalized) && !MEME_TOKENS.has(normalized));
}

function hasCommonToken(intent: DeFiIntent): boolean {
  return isCommonToken(intent.tokenIn) || isCommonToken(intent.tokenOut);
}

function hasMemeToken(intent: DeFiIntent): boolean {
  return isMemeToken(intent.tokenIn) || isMemeToken(intent.tokenOut);
}

function hasUnknownToken(intent: DeFiIntent): boolean {
  return isUnknownToken(intent.tokenIn) || isUnknownToken(intent.tokenOut);
}

function areBothTokensCommon(intent: DeFiIntent): boolean {
  return isCommonToken(intent.tokenIn) && (!intent.tokenOut || isCommonToken(intent.tokenOut));
}

function isCommonPair(intent: DeFiIntent): boolean {
  const pair = `${normalizeToken(intent.tokenIn)}/${normalizeToken(intent.tokenOut)}`;
  const reversePair = `${normalizeToken(intent.tokenOut)}/${normalizeToken(intent.tokenIn)}`;
  return COMMON_PAIRS.has(pair) || COMMON_PAIRS.has(reversePair);
}

function buildAlternatives(route: RouteType): RouteType[] {
  const all: RouteType[] = ["STANDARD_ROUTE", "PROTECTED_ROUTE", "DELAYED_EXECUTION", "SPLIT_ORDER", "BLOCKED_UNSAFE"];
  return all.filter((item) => item !== route).slice(0, 3);
}

function routePros(route: RouteType): string[] {
  const map: Record<RouteType, string[]> = {
    STANDARD_ROUTE: ["Lowest friction", "Works well for low-risk known pairs"],
    PROTECTED_ROUTE: ["Reduces public mempool exposure", "Better fit for safety-priority intents"],
    DELAYED_EXECUTION: ["Waits for safer gas/liquidity conditions", "Avoids rushing into moderate-risk routes"],
    SPLIT_ORDER: ["Reduces price impact", "Lowers single-transaction MEV exposure"],
    BLOCKED_UNSAFE: ["Protects the user from critical risk", "Creates a clear audit trail for the blocked recommendation"]
  };
  return map[route];
}

function routeCons(route: RouteType): string[] {
  const map: Record<RouteType, string[]> = {
    STANDARD_ROUTE: ["No special protection", "Not appropriate for high slippage or unknown tokens"],
    PROTECTED_ROUTE: ["May be slower or more expensive", "Still not guaranteed MEV protection"],
    DELAYED_EXECUTION: ["Execution is not immediate", "User must re-check conditions later"],
    SPLIT_ORDER: ["More operational complexity", "Multiple transactions may cost more gas"],
    BLOCKED_UNSAFE: ["No execution route is produced", "User must adjust the intent"]
  };
  return map[route];
}

function routeExplanation(route: RouteType, analysis: RiskAnalysis): string {
  const base = `Risk score ${analysis.riskScore}/100 (${analysis.riskLevel}).`;
  const map: Record<RouteType, string> = {
    STANDARD_ROUTE: `${base} Standard routing is acceptable for low-risk simulation and reporting.`,
    PROTECTED_ROUTE: `${base} Protected routing is recommended to reduce public-route exposure without claiming a guarantee.`,
    DELAYED_EXECUTION: `${base} Delayed execution is safer until slippage, gas, or liquidity conditions improve.`,
    SPLIT_ORDER: `${base} Splitting the order is recommended because price impact or MEV exposure is elevated.`,
    BLOCKED_UNSAFE: `${base} SentinelMesh should block this route in v0 and only generate a risk report.`
  };
  return map[route];
}
