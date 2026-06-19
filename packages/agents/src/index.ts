import { createHash, randomUUID } from "node:crypto";
import { analyzeRisk, recommendRoute } from "@sentinelmesh/risk-engine";
import {
  DeFiIntentSchema,
  MODEL_VERSION,
  type AgentResult,
  type DeFiIntent,
  type FixtureScenario,
  type RiskAnalysis,
  type RiskFactors,
  type RiskLevel,
  type RouteAnalysis,
  type RouteDecision,
  type RouteOption,
  type RouteRecommendation,
  type SentinelReport
} from "@sentinelmesh/shared";

export type AgentContext = {
  prompt: string;
  parsedIntent?: DeFiIntent;
  riskAnalysis?: RiskAnalysis;
  routeAnalysis?: RouteAnalysis;
  routeRecommendation?: RouteRecommendation;
  userAddress?: string;
  reportURI?: string;
  chainTxHash?: `0x${string}`;
  fixtures?: FixtureScenario[];
};

export type Agent<TOutput> = {
  name: string;
  run(context: AgentContext): Promise<AgentResult<TOutput>>;
};

const now = () => new Date().toISOString();
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
export const ROUTE_ENGINE_VERSION = "sentinelmesh-route-v0.1";

export const IntentAgent: Agent<DeFiIntent> = {
  name: "IntentAgent",
  async run(context) {
    const groqResult = await parseIntentWithGroq(context.prompt);
    const parsedIntent = groqResult.intent ?? DeFiIntentSchema.parse(parseIntentFallback(context.prompt));
    const usedGroq = Boolean(groqResult.intent);

    return {
      agentName: this.name,
      status: parsedIntent.action === "unsupported" ? "warning" : "completed",
      confidence: usedGroq ? 0.9 : parsedIntent.action === "unsupported" ? 0.48 : parsedIntent.tokenIn || parsedIntent.tokenOut ? 0.82 : 0.68,
      reasoning: [
        usedGroq
          ? `Parsed intent with Groq model ${getGroqModel()} and validated the JSON output.`
          : groqResult.reason ?? "Used deterministic fallback parsing; no LLM dependency or API key is required.",
        "Validated the parsed intent against the shared DeFiIntent schema before returning it.",
        parsedIntent.action === "unsupported"
          ? "No supported DeFi action was detected in the prompt."
          : "Extracted action, tokens, amount, chain, priority, slippage, and risk tolerance where present."
      ],
      output: parsedIntent,
      timestamp: now()
    };
  }
};

export async function runIntentAgent(prompt: string): Promise<AgentResult<DeFiIntent>> {
  return IntentAgent.run({ prompt });
}

export const RiskAgent: Agent<RiskAnalysis> = {
  name: "RiskAgent",
  async run(context) {
    const parsedIntent = requireIntent(context);
    const fixture = matchFixture(context.prompt, context.fixtures);
    const baseOutput = analyzeRisk(parsedIntent, fixture?.riskFactors as RiskFactors | undefined);
    const groqExplanation = await explainRiskWithGroq(parsedIntent, baseOutput);
    const output = groqExplanation
      ? {
          ...baseOutput,
          summary: groqExplanation
        }
      : baseOutput;

    return {
      agentName: this.name,
      status: output.riskLevel === "Critical" ? "warning" : "completed",
      confidence: groqExplanation ? 0.9 : fixture ? 0.94 : 0.82,
      reasoning: [
        "Calculated weighted risk score from slippage, liquidity, price impact, gas, token, and route complexity factors.",
        "MEV exposure was estimated separately and shown as an explanatory factor.",
        groqExplanation
          ? `Generated a two-sentence copilot explanation with Groq model ${getGroqModel()}.`
          : "Used deterministic risk explanation fallback because Groq is not configured or did not return a valid response.",
        describeIntentRisk(parsedIntent),
        output.summary
      ],
      output,
      timestamp: now()
    };
  }
};

export async function runRiskAgent(intent: DeFiIntent): Promise<AgentResult<RiskAnalysis>> {
  return RiskAgent.run({ prompt: "Analyze parsed DeFi intent", parsedIntent: intent });
}

export const RouteAgent: Agent<RouteAnalysis> = {
  name: "RouteAgent",
  async run(context) {
    const parsedIntent = requireIntent(context);
    if (!context.riskAnalysis) throw new Error("RouteAgent requires riskAnalysis");
    const output = buildRouteAnalysis(parsedIntent, context.riskAnalysis);
    const recommendedRoute = output.routes.find((route) => route.routeId === output.recommendedRouteId);

    return {
      agentName: this.name,
      status: recommendedRoute ? "completed" : "warning",
      confidence: parsedIntent.action === "unsupported" ? 0.72 : 0.9,
      reasoning: [
        "Generated deterministic fixture routes from parsed intent and risk output.",
        "Applied transparent v0 route decision rules without executing a transaction.",
        output.decisionSummary
      ],
      output,
      timestamp: now()
    };
  }
};

export async function runRouteAgent(intent: DeFiIntent, analysis: RiskAnalysis): Promise<AgentResult<RouteAnalysis>> {
  return RouteAgent.run({ prompt: "Recommend execution routes", parsedIntent: intent, riskAnalysis: analysis });
}

export const ReportAgent: Agent<SentinelReport> = {
  name: "ReportAgent",
  async run(context) {
    const parsedIntent = requireIntent(context);
    if (!context.riskAnalysis) throw new Error("ReportAgent requires riskAnalysis");
    if (!context.routeRecommendation) throw new Error("ReportAgent requires routeRecommendation");

    const createdAt = now();
    const id = randomUUID();
    const reportURI = context.reportURI ?? `sentinelmesh://reports/${id}`;
    const unsignedReport = {
      id,
      userAddress: context.userAddress,
      originalPrompt: context.prompt,
      parsedIntent,
      riskScore: context.riskAnalysis.riskScore,
      riskLevel: context.riskAnalysis.riskLevel,
      riskFactors: context.riskAnalysis.riskFactors,
      riskFactorExplanations: context.riskAnalysis.factorExplanations,
      recommendedRoute: context.routeRecommendation,
      modelVersion: MODEL_VERSION,
      reportURI,
      createdAt
    };
    const reportHash = hashReportPayload(unsignedReport);
    const report: SentinelReport = {
      ...unsignedReport,
      agentTrace: [],
      reportHash,
      chainTxHash: context.chainTxHash,
      verificationStatus: context.chainTxHash ? "pending" : "local-only"
    };

    return {
      agentName: this.name,
      status: "completed",
      confidence: 0.93,
      reasoning: [
        "Generated a deterministic report hash from canonical report fields.",
        "The report can be stored locally and optionally anchored in SentinelReportRegistry on testnet."
      ],
      output: report,
      timestamp: now()
    };
  }
};

export const VerificationAgent: Agent<{ verified: boolean; localHash: string; onChainHash?: string }> = {
  name: "VerificationAgent",
  async run(context) {
    const report = context as AgentContext & { report?: SentinelReport; onChainHash?: string };
    if (!report.report) throw new Error("VerificationAgent requires report");

    const localHash = recomputeReportHash(report.report);
    const verified = Boolean(report.onChainHash) && localHash.toLowerCase() === report.onChainHash?.toLowerCase();

    return {
      agentName: this.name,
      status: verified ? "completed" : "warning",
      confidence: report.onChainHash ? 0.98 : 0.72,
      reasoning: report.onChainHash
        ? ["Compared the canonical local report hash with the on-chain hash."]
        : ["No on-chain hash was supplied; report remains local-only until registry anchoring is available."],
      output: { verified, localHash, onChainHash: report.onChainHash },
      timestamp: now()
    };
  }
};

export async function runAgents(context: AgentContext): Promise<{
  parsedIntent: DeFiIntent;
  riskAnalysis: RiskAnalysis;
  routeRecommendation: RouteAnalysis;
  agentTrace: AgentResult[];
}> {
  const agentTrace: AgentResult[] = [];

  const intentResult = await IntentAgent.run(context);
  agentTrace.push(intentResult);

  const riskContext = { ...context, parsedIntent: intentResult.output };
  const riskResult = await RiskAgent.run(riskContext);
  agentTrace.push(riskResult);

  const routeContext = { ...riskContext, riskAnalysis: riskResult.output };
  const routeResult = await RouteAgent.run(routeContext);
  agentTrace.push(routeResult);

  return {
    parsedIntent: intentResult.output,
    riskAnalysis: riskResult.output,
    routeRecommendation: routeResult.output,
    agentTrace
  };
}

export async function createReportFromContext(context: AgentContext): Promise<SentinelReport> {
  const parsedIntent = context.parsedIntent ?? (await IntentAgent.run(context)).output;
  const riskAnalysis = context.riskAnalysis ?? analyzeRisk(parsedIntent);
  const routeRecommendation = context.routeRecommendation ?? recommendRoute(riskAnalysis);
  const reportResult = await ReportAgent.run({ ...context, parsedIntent, riskAnalysis, routeRecommendation });
  return reportResult.output;
}

export function buildRouteAnalysis(intent: DeFiIntent, analysis: RiskAnalysis): RouteAnalysis {
  const baseRoutes =
    intent.action === "unsupported"
      ? buildUnsupportedRoutes(intent, analysis)
      : intent.action === "bridge"
        ? buildBridgeRoutes(intent, analysis)
        : intent.action === "analyze"
          ? buildAnalyzeRoutes(intent, analysis)
          : intent.action === "stake"
            ? buildStakeRoutes(intent, analysis)
            : buildSwapRoutes(intent, analysis);
  const routes = applyRouteDecisionRules(baseRoutes, intent, analysis);
  const recommendedRouteId = routes.find((route) => route.isRecommended)?.routeId;

  return {
    routes,
    recommendedRouteId,
    selectedRouteId: recommendedRouteId ?? routes[0]?.routeId,
    decisionSummary: buildRouteDecisionSummary(intent, analysis, routes, recommendedRouteId),
    dataSource: "fixture",
    routeEngineVersion: ROUTE_ENGINE_VERSION
  };
}

function buildSwapRoutes(intent: DeFiIntent, analysis: RiskAnalysis): RouteOption[] {
  const chain = intent.chain ?? "ethereum";
  const tokenIn = intent.tokenIn ?? "UNKNOWN";
  const tokenOut = intent.tokenOut ?? "UNKNOWN";
  const liquidityConfidence = liquidityConfidenceFromRisk(analysis);
  const slippage = slippageFromRisk(analysis, "standard");
  const priceImpact = priceImpactFromRisk(analysis, "standard");

  return [
    createRoute({
      routeId: "swap-standard-dex",
      routeName: "Standard DEX Simulation",
      action: "swap",
      sourceChain: chain,
      inputToken: tokenIn,
      outputToken: tokenOut,
      estimatedGas: gasEstimate(chain, "standard"),
      estimatedTime: "~2 min",
      estimatedSlippage: slippage,
      estimatedPriceImpact: priceImpact,
      liquidityConfidence,
      routeComplexity: "low",
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      pros: ["Fastest simple swap path", "Lowest route complexity", "Good fit for common liquid pairs"],
      cons: ["No execution protection is implied", "Higher exposure if slippage or token risk rises"],
      recommendationReason: "Best only when the overall risk score is low and liquidity confidence is strong.",
      supportedExecutionModes: ["simulation", "report-on-chain", "testnet"]
    }),
    createRoute({
      routeId: "swap-protected-review",
      routeName: "Protected Route Simulation",
      action: "swap",
      sourceChain: chain,
      inputToken: tokenIn,
      outputToken: tokenOut,
      estimatedGas: gasEstimate(chain, "protected"),
      estimatedTime: "~3 min",
      estimatedSlippage: slippageFromRisk(analysis, "protected"),
      estimatedPriceImpact: priceImpactFromRisk(analysis, "protected"),
      liquidityConfidence: Math.min(100, liquidityConfidence + 8),
      routeComplexity: "medium",
      riskScore: clampRouteRisk(analysis.riskScore - 7),
      riskLevel: routeRiskLevel(clampRouteRisk(analysis.riskScore - 7), analysis.riskLevel),
      pros: ["Adds route review before execution", "Better fit for medium-risk swaps", "Keeps report generation available"],
      cons: ["Slightly higher estimated gas", "Still a simulation in v0, not guaranteed MEV prevention"],
      recommendationReason: "Recommended when extra route review improves confidence and liquidity, slippage, and price impact remain acceptable.",
      supportedExecutionModes: ["simulation", "report-on-chain", "testnet"]
    }),
    createRoute({
      routeId: "swap-split-order",
      routeName: "Split Order Simulation",
      action: "swap",
      sourceChain: chain,
      inputToken: tokenIn,
      outputToken: tokenOut,
      estimatedGas: gasEstimate(chain, "split"),
      estimatedTime: "~6 min",
      estimatedSlippage: slippageFromRisk(analysis, "split"),
      estimatedPriceImpact: priceImpactFromRisk(analysis, "split"),
      liquidityConfidence: Math.min(100, liquidityConfidence + 5),
      routeComplexity: "high",
      riskScore: clampRouteRisk(analysis.riskScore - 4),
      riskLevel: routeRiskLevel(clampRouteRisk(analysis.riskScore - 4), analysis.riskLevel),
      pros: ["Can reduce price impact for larger trades", "Useful when a single pool is thin"],
      cons: ["More complex route", "Longer execution window can add timing risk"],
      recommendationReason: "Useful for larger or thinner-liquidity swaps, but only when risk is not high.",
      supportedExecutionModes: ["simulation", "report-on-chain"]
    })
  ];
}

function buildBridgeRoutes(intent: DeFiIntent, analysis: RiskAnalysis): RouteOption[] {
  const sourceChain = intent.chain ?? "ethereum";
  const destinationChain = sourceChain === "base" ? "ethereum" : "base";
  const tokenIn = intent.tokenIn ?? "ETH";
  const confidence = Math.max(20, liquidityConfidenceFromRisk(analysis) - 15);

  return [
    createRoute({
      routeId: "bridge-risk-review",
      routeName: "Bridge Risk Review",
      action: "bridge",
      sourceChain,
      destinationChain,
      inputToken: tokenIn,
      outputToken: tokenIn,
      estimatedGas: gasEstimate(sourceChain, "bridge"),
      estimatedTime: "~12 min",
      estimatedSlippage: slippageFromRisk(analysis, "bridge"),
      estimatedPriceImpact: priceImpactFromRisk(analysis, "bridge"),
      liquidityConfidence: confidence,
      routeComplexity: "high",
      riskScore: Math.max(analysis.riskScore, 58),
      riskLevel: analysis.riskLevel,
      pros: ["Models cross-chain route assumptions", "Keeps report generation available before any transaction"],
      cons: ["Bridge execution is not automated in v0", "Cross-chain finality and liquidity add uncertainty"],
      recommendationReason: "Bridge requests should be reviewed with simulation/report-only unless risk is clearly low.",
      supportedExecutionModes: ["simulation", "report-on-chain"]
    }),
    createRoute({
      routeId: "bridge-report-only",
      routeName: "Report-Only Bridge Assessment",
      action: "bridge",
      sourceChain,
      destinationChain,
      inputToken: tokenIn,
      outputToken: tokenIn,
      estimatedGas: "0 ETH execution gas",
      estimatedTime: "~1 min",
      estimatedSlippage: "0.00%",
      estimatedPriceImpact: "0.00%",
      liquidityConfidence: confidence,
      routeComplexity: "medium",
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      pros: ["Safest v0 handling for bridge uncertainty", "Produces a verifiable local/on-chain risk report"],
      cons: ["Does not execute a bridge transaction", "User still needs a separate bridge app"],
      recommendationReason: "Preferred when bridge complexity or risk is above the low-risk band.",
      supportedExecutionModes: ["simulation", "report-on-chain"]
    })
  ];
}

function buildAnalyzeRoutes(intent: DeFiIntent, analysis: RiskAnalysis): RouteOption[] {
  return [
    createRoute({
      routeId: "analysis-report-only",
      routeName: "Risk Report Only",
      action: "analyze",
      sourceChain: intent.chain ?? "ethereum",
      inputToken: intent.tokenIn ?? "UNKNOWN",
      outputToken: intent.tokenOut,
      estimatedGas: "0 ETH execution gas",
      estimatedTime: "~1 min",
      estimatedSlippage: "0.00%",
      estimatedPriceImpact: "0.00%",
      liquidityConfidence: liquidityConfidenceFromRisk(analysis),
      routeComplexity: "low",
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      pros: ["No execution path is suggested", "Clear fit for user requests that only ask for analysis"],
      cons: ["No executable route is prepared", "Future wallet action must be reviewed separately"],
      recommendationReason: "Analyze-only prompts should produce a report, not a transaction recommendation.",
      supportedExecutionModes: ["simulation", "report-on-chain"]
    })
  ];
}

function buildStakeRoutes(intent: DeFiIntent, analysis: RiskAnalysis): RouteOption[] {
  return [
    createRoute({
      routeId: "stake-report-only",
      routeName: "Staking Risk Review",
      action: "stake",
      sourceChain: intent.chain ?? "ethereum",
      inputToken: intent.tokenIn ?? "UNKNOWN",
      estimatedGas: gasEstimate(intent.chain ?? "ethereum", "protected"),
      estimatedTime: "~4 min",
      estimatedSlippage: "0.00%",
      estimatedPriceImpact: "0.00%",
      liquidityConfidence: Math.max(30, liquidityConfidenceFromRisk(analysis) - 10),
      routeComplexity: "medium",
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      pros: ["Reviews staking assumptions before wallet action", "Keeps v0 within report/simulation scope"],
      cons: ["Protocol-specific staking execution is not implemented", "Yield and lockup assumptions need user review"],
      recommendationReason: "Staking is supported as risk intelligence first; execution adapters are future work.",
      supportedExecutionModes: ["simulation", "report-on-chain"]
    })
  ];
}

function buildUnsupportedRoutes(intent: DeFiIntent, analysis: RiskAnalysis): RouteOption[] {
  return [
    createRoute({
      routeId: "unsupported-fallback",
      routeName: "Unsupported Intent Fallback",
      action: "unsupported",
      sourceChain: intent.chain ?? "unknown",
      inputToken: intent.tokenIn ?? "UNKNOWN",
      outputToken: intent.tokenOut,
      estimatedGas: "0 ETH execution gas",
      estimatedTime: "~1 min",
      estimatedSlippage: "N/A",
      estimatedPriceImpact: "N/A",
      liquidityConfidence: 0,
      routeComplexity: "critical",
      riskScore: Math.max(analysis.riskScore, 90),
      riskLevel: "Critical",
      pros: ["Prevents unsupported intent from being treated as executable", "Keeps the user in a safe report-only flow"],
      cons: ["No route can be recommended", "User must rewrite the prompt as a supported DeFi action"],
      recommendationReason: "SentinelMesh v0 only supports risk intelligence for known DeFi actions.",
      supportedExecutionModes: ["simulation", "report-on-chain"]
    })
  ];
}

function createRoute(route: Omit<RouteOption, "decision" | "isRecommended">): RouteOption {
  return {
    ...route,
    decision: "available",
    isRecommended: false
  };
}

function applyRouteDecisionRules(routes: RouteOption[], intent: DeFiIntent, analysis: RiskAnalysis): RouteOption[] {
  if (intent.action === "unsupported") {
    return routes.map((route) => ({ ...route, decision: "fallback", isRecommended: false }));
  }

  if (analysis.riskLevel === "High" || analysis.riskLevel === "Critical" || analysis.riskScore > 70) {
    return routes.map((route) => ({
      ...route,
      decision: "report-only",
      isRecommended: false,
      supportedExecutionModes: route.supportedExecutionModes.filter((mode) => mode !== "testnet")
    }));
  }

  const recommended =
    analysis.riskLevel === "Low"
      ? [...routes].sort((a, b) => b.liquidityConfidence - a.liquidityConfidence || a.riskScore - b.riskScore)[0]
      : routes.find((route) => route.routeId.includes("protected") && route.liquidityConfidence >= 55 && parseRoutePercent(route.estimatedSlippage) <= 2 && parseRoutePercent(route.estimatedPriceImpact) <= 3) ??
        routes.find((route) => route.liquidityConfidence >= 55 && parseRoutePercent(route.estimatedSlippage) <= 2 && parseRoutePercent(route.estimatedPriceImpact) <= 3);

  return routes.map((route) => {
    const isRecommended = Boolean(recommended && route.routeId === recommended.routeId);
    const decision: RouteDecision = isRecommended ? "recommended" : analysis.riskLevel === "Medium" ? "available" : route.decision;
    return { ...route, decision, isRecommended };
  });
}

function buildRouteDecisionSummary(intent: DeFiIntent, analysis: RiskAnalysis, routes: RouteOption[], recommendedRouteId?: string): string {
  if (intent.action === "unsupported") {
    return "Unsupported or invalid intent: no execution route is recommended. Use the fallback to create a report and rewrite the prompt.";
  }
  if (!recommendedRouteId) {
    return `${analysis.riskLevel} risk detected: SentinelMesh recommends simulation/report-only review and does not suggest execution for this route set.`;
  }
  const route = routes.find((item) => item.routeId === recommendedRouteId);
  if (analysis.riskLevel === "Low") {
    return `Low risk: ${route?.routeName ?? "the safest route"} is recommended because it has the strongest liquidity confidence and manageable execution assumptions.`;
  }
  return `Medium risk: ${route?.routeName ?? "a guarded route"} is recommended because liquidity, slippage, and price impact stay within the v0 acceptance thresholds.`;
}

function liquidityConfidenceFromRisk(analysis: RiskAnalysis): number {
  return Math.max(0, Math.min(100, Math.round(100 - analysis.riskFactors.liquidityRisk * 0.85)));
}

function slippageFromRisk(analysis: RiskAnalysis, mode: "standard" | "protected" | "split" | "bridge"): string {
  const base = analysis.riskFactors.slippageRisk <= 20 ? 0.3 : analysis.riskFactors.slippageRisk <= 45 ? 0.8 : analysis.riskFactors.slippageRisk <= 70 ? 1.8 : 4.5;
  const multiplier = mode === "protected" ? 0.75 : mode === "split" ? 0.65 : mode === "bridge" ? 1.2 : 1;
  return `${Math.max(0.05, base * multiplier).toFixed(2)}%`;
}

function priceImpactFromRisk(analysis: RiskAnalysis, mode: "standard" | "protected" | "split" | "bridge"): string {
  const base = analysis.riskFactors.priceImpactRisk <= 20 ? 0.2 : analysis.riskFactors.priceImpactRisk <= 45 ? 0.9 : analysis.riskFactors.priceImpactRisk <= 70 ? 2.6 : 7.5;
  const multiplier = mode === "protected" ? 0.8 : mode === "split" ? 0.55 : mode === "bridge" ? 1.1 : 1;
  return `${Math.max(0.05, base * multiplier).toFixed(2)}%`;
}

function gasEstimate(chain: string, mode: "standard" | "protected" | "split" | "bridge"): string {
  const normalized = chain.toLowerCase();
  const lowCostChain = normalized.includes("base") || normalized.includes("arbitrum") || normalized.includes("polygon");
  const base = lowCostChain ? 0.0006 : 0.0025;
  const multiplier = mode === "protected" ? 1.25 : mode === "split" ? 1.7 : mode === "bridge" ? 2.2 : 1;
  return `${(base * multiplier).toFixed(4)} ETH`;
}

function clampRouteRisk(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function routeRiskLevel(score: number, fallback: RiskLevel): RiskLevel {
  if (!Number.isFinite(score)) return fallback;
  if (score <= 30) return "Low";
  if (score <= 60) return "Medium";
  if (score <= 80) return "High";
  return "Critical";
}

function parseRoutePercent(value: string): number {
  if (value === "N/A") return Number.POSITIVE_INFINITY;
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function parseIntentFallback(prompt: string): DeFiIntent {
  const normalized = prompt.trim();
  const lower = normalized.toLowerCase();
  const action = inferAction(lower);
  const bridgePair = normalized.match(/\bbridge\s+(\d+(?:\.\d+)?)\s+([a-zA-Z0-9]+)\s+from\s+([a-zA-Z ]+?)\s+to\s+([a-zA-Z ]+?)(?:[.?!,]|$)/i);
  const tokenPair =
    normalized.match(/\b(?:swap|swapping|trade|convert)\s+(\d+(?:\.\d+)?)\s+([a-zA-Z0-9]+)\s+(?:to|for|into)\s+([a-zA-Z0-9]+)/i) ??
    normalized.match(/\b(?:swap|swapping|trade|convert)\s+([a-zA-Z0-9]+)\s+(?:to|for|into)\s+([a-zA-Z0-9]+)/i) ??
    normalized.match(/\b([a-zA-Z0-9]+)\s+(?:to|for|into)\s+([a-zA-Z0-9]+)\s+(?:swap|trade|conversion)\b/i);
  const stakePair = normalized.match(/\bstake\s+(\d+(?:\.\d+)?)\s+([a-zA-Z0-9]+)/i);
  const amount = bridgePair?.[1] ?? stakePair?.[1] ?? (tokenPair?.length === 4 ? tokenPair[1] : normalized.match(/(\d+(?:\.\d+)?)/)?.[1]);
  const tokenIn = bridgePair?.[2] ?? stakePair?.[2] ?? (tokenPair?.length === 4 ? tokenPair[2] : tokenPair?.[1]);
  const tokenOut = tokenPair?.length === 4 ? tokenPair[3] : tokenPair?.[2];
  const maxSlippage = parseSlippage(normalized);
  const riskTolerance = parseRiskTolerance(lower);
  if (action === "unsupported") {
    return {
      action,
      priority: "safety",
      constraints: {}
    };
  }

  const intent: DeFiIntent = {
    action,
    chain: inferChain(normalized, bridgePair?.[3]),
    priority: parsePriority(lower),
    constraints: {}
  };

  if (tokenIn) intent.tokenIn = tokenIn.toUpperCase();
  if (tokenOut) intent.tokenOut = tokenOut.toUpperCase();
  if (amount) intent.amount = amount;
  if (maxSlippage) intent.constraints.maxSlippage = maxSlippage;
  if (riskTolerance) intent.constraints.riskTolerance = riskTolerance;

  return intent;
}

async function parseIntentWithGroq(prompt: string): Promise<{ intent?: DeFiIntent; reason?: string }> {
  if (!getGroqApiKey()) {
    return { reason: "Used deterministic fallback parsing because GROQ_API_KEY is not configured." };
  }

  try {
    const content = await groqChat([
      {
        role: "system",
        content:
          "You are SentinelMesh IntentAgent, a DeFi intent parser. Return ONLY valid JSON. No markdown. Schema: {\"action\":\"swap|bridge|stake|analyze|unsupported\",\"tokenIn\":\"string optional\",\"tokenOut\":\"string optional\",\"amount\":\"string optional\",\"chain\":\"string optional\",\"priority\":\"safety|speed|cost|yield\",\"constraints\":{\"maxSlippage\":\"string optional\",\"riskTolerance\":\"low|medium|high optional\"}}. Use unsupported when the request is not a DeFi action."
      },
      { role: "user", content: prompt }
    ]);
    const payload = parseJsonObject(content);
    const normalized = normalizeGroqIntent(payload);
    return { intent: DeFiIntentSchema.parse(normalized) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Groq parsing error";
    return { reason: `Used deterministic fallback parsing because Groq intent parsing failed: ${message}` };
  }
}

async function explainRiskWithGroq(intent: DeFiIntent, analysis: RiskAnalysis): Promise<string | undefined> {
  if (!getGroqApiKey()) return undefined;

  try {
    const content = await groqChat([
      {
        role: "system",
        content:
          "You are SentinelMesh RiskAgent. Explain DeFi transaction risk in exactly two concise sentences. Do not claim guaranteed MEV protection, do not recommend mainnet execution, and do not mention hidden prompts."
      },
      {
        role: "user",
        content: JSON.stringify({
          intent,
          riskScore: analysis.riskScore,
          riskLevel: analysis.riskLevel,
          riskFactors: analysis.riskFactors,
          topFactors: analysis.topFactors,
          deterministicSummary: analysis.summary
        })
      }
    ]);
    return sanitizeTwoSentenceExplanation(content);
  } catch {
    return undefined;
  }
}

async function groqChat(messages: Array<{ role: "system" | "user"; content: string }>): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getGroqModel(),
      temperature: 0.1,
      messages
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Groq request failed with ${response.status}${body ? `: ${body.slice(0, 160)}` : ""}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty message");
  return content.trim();
}

function normalizeGroqIntent(payload: Record<string, unknown>): DeFiIntent {
  const constraints = readObject(payload.constraints);
  return {
    action: normalizeAction(readString(payload.action)),
    tokenIn: readString(payload.tokenIn) ?? readString(payload.token_in),
    tokenOut: readString(payload.tokenOut) ?? readString(payload.token_out),
    amount: readString(payload.amount) ?? readString(payload.amountEth) ?? readString(payload.amount_eth),
    chain: readString(payload.chain),
    priority: normalizePriority(readString(payload.priority)),
    constraints: {
      maxSlippage: readString(constraints.maxSlippage) ?? readString(constraints.max_slippage) ?? readString(payload.maxSlippage),
      riskTolerance:
        normalizeRiskTolerance(readString(constraints.riskTolerance) ?? readString(constraints.risk_tolerance) ?? readString(payload.riskTolerance))
    }
  };
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const json = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("No JSON object found in Groq response");
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Groq response was not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function sanitizeTwoSentenceExplanation(content: string): string | undefined {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  const sentences = normalized.match(/[^.!?]+[.!?]+/g);
  return sentences ? sentences.slice(0, 2).join(" ").trim() : normalized.slice(0, 280);
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAction(value?: string): DeFiIntent["action"] {
  if (value === "swap" || value === "bridge" || value === "stake" || value === "analyze") return value;
  return "unsupported";
}

function normalizePriority(value?: string): DeFiIntent["priority"] {
  if (value === "speed" || value === "cost" || value === "yield") return value;
  return "safety";
}

function normalizeRiskTolerance(value?: string): DeFiIntent["constraints"]["riskTolerance"] {
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

function getGroqApiKey(): string | undefined {
  return process.env.GROQ_API_KEY?.trim() || undefined;
}

function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

export function hashReportPayload(payload: unknown): `0x${string}` {
  return `0x${createHash("sha256").update(canonicalize(payload)).digest("hex")}`;
}

export function recomputeReportHash(report: SentinelReport): `0x${string}` {
  const {
    agentTrace: _agentTrace,
    reportHash: _reportHash,
    verificationStatus: _verificationStatus,
    chainTxHash: _chainTxHash,
    ...hashable
  } = report;
  return hashReportPayload(hashable);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

function matchFixture(prompt: string, fixtures: FixtureScenario[] = []): FixtureScenario | undefined {
  const normalized = prompt.toLowerCase().replace(/\s+/g, " ").trim();
  return fixtures.find((fixture) => {
    const fixturePrompt = fixture.prompt.toLowerCase().replace(/\s+/g, " ").trim();
    return normalized === fixturePrompt || normalized.includes(fixture.id.replaceAll("-", " "));
  });
}

function inferAction(prompt: string): DeFiIntent["action"] {
  if (/\b(analy[sz]e|check|risk)\b/.test(prompt)) return "analyze";
  if (/\b(swap|convert|trade|swapping)\b/.test(prompt)) return "swap";
  if (/\bbridge\b/.test(prompt)) return "bridge";
  if (/\bstake\b/.test(prompt)) return "stake";
  return "unsupported";
}

function parsePriority(prompt: string): DeFiIntent["priority"] {
  if (/\b(yield|earn|return|stake)\b/.test(prompt)) return "yield";
  if (/\b(fast|quick|urgent|speed)\b/.test(prompt)) return "speed";
  if (/\b(cheap|low gas|cost|best price)\b/.test(prompt)) return "cost";
  if (/\b(safe|safely|low risk|secure)\b/.test(prompt)) return "safety";
  return "safety";
}

function parseRiskTolerance(prompt: string): DeFiIntent["constraints"]["riskTolerance"] {
  if (/\b(high risk|degen|risky)\b/.test(prompt)) return "high";
  if (/\bmedium risk\b/.test(prompt)) return "medium";
  if (/\b(low risk|safely|safe)\b/.test(prompt)) return "low";
  return undefined;
}

function parseSlippage(prompt: string): string | undefined {
  const explicit = prompt.match(/(\d+(?:\.\d+)?)\s*%\s*(?:max\s*)?slippage/i);
  if (explicit) return `${explicit[1]}%`;
  const lower = prompt.toLowerCase();
  if (lower.includes("low slippage")) return "0.5%";
  if (lower.includes("medium slippage")) return "1%";
  if (lower.includes("high slippage")) return "3%";
  return undefined;
}

function inferChain(prompt: string, bridgeSource?: string): string {
  if (bridgeSource) return normalizeChain(bridgeSource);
  const lower = prompt.toLowerCase();
  if (lower.includes("ethereum")) return "ethereum";
  if (lower.includes("base")) return "base";
  if (lower.includes("arbitrum")) return "arbitrum";
  if (lower.includes("polygon")) return "polygon";
  return "ethereum";
}

function normalizeChain(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower.includes("ethereum")) return "ethereum";
  if (lower.includes("base")) return "base";
  if (lower.includes("arbitrum")) return "arbitrum";
  if (lower.includes("polygon")) return "polygon";
  return lower || "unknown";
}

function requireIntent(context: AgentContext): DeFiIntent {
  if (!context.parsedIntent) throw new Error("Agent requires parsedIntent");
  return context.parsedIntent;
}

function describeIntentRisk(intent: DeFiIntent): string {
  const pair = [intent.tokenIn, intent.tokenOut].filter(Boolean).join("/") || intent.action;
  if (intent.constraints.maxSlippage) {
    return `Detected ${pair} with ${intent.constraints.maxSlippage} max slippage from user constraints.`;
  }
  return `Detected ${pair} with ${intent.priority} priority.`;
}
