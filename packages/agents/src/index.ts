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
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

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
