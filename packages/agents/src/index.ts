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
  type RouteRecommendation,
  type SentinelReport
} from "@sentinelmesh/shared";

export type AgentContext = {
  prompt: string;
  parsedIntent?: DeFiIntent;
  riskAnalysis?: RiskAnalysis;
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

export const IntentAgent: Agent<DeFiIntent> = {
  name: "IntentAgent",
  async run(context) {
    const parsedIntent = DeFiIntentSchema.parse(parseIntentFallback(context.prompt));

    return {
      agentName: this.name,
      status: parsedIntent.action === "unsupported" ? "warning" : "completed",
      confidence: parsedIntent.action === "unsupported" ? 0.48 : parsedIntent.tokenIn || parsedIntent.tokenOut ? 0.82 : 0.68,
      reasoning: [
        "Used deterministic fallback parsing; no LLM dependency or API key is required.",
        "Validated the parsed intent against the shared DeFiIntent schema.",
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
    const output = analyzeRisk(parsedIntent, fixture?.riskFactors as RiskFactors | undefined);

    return {
      agentName: this.name,
      status: output.riskLevel === "Critical" ? "warning" : "completed",
      confidence: fixture ? 0.94 : 0.82,
      reasoning: [
        "Calculated weighted risk score from slippage, liquidity, price impact, gas, token, and route complexity factors.",
        "MEV exposure was estimated separately and shown as an explanatory factor.",
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

export const RouteAgent: Agent<RouteRecommendation> = {
  name: "RouteAgent",
  async run(context) {
    if (!context.riskAnalysis) throw new Error("RouteAgent requires riskAnalysis");
    const output = recommendRoute(context.riskAnalysis);

    return {
      agentName: this.name,
      status: output.recommendedRoute === "BLOCKED_UNSAFE" ? "warning" : "completed",
      confidence: 0.9,
      reasoning: [
        "Applied deterministic route decision rules from the v0 product spec.",
        "The recommendation is advisory and does not execute swaps or claim guaranteed protection.",
        output.explanation
      ],
      output,
      timestamp: now()
    };
  }
};

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
  routeRecommendation: RouteRecommendation;
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
