import cors from "cors";
import express from "express";
import morgan from "morgan";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, decodeEventLog, http, isAddress, isHash, isHex, type Chain, type Hex } from "viem";
import {
  IntentAgent,
  ReportAgent,
  RiskAgent,
  RouteAgent,
  VerificationAgent,
  recomputeReportHash,
  runAgents,
  runRouteAgent,
  runRiskAgent,
  type AgentContext
} from "@sentinelmesh/agents";
import { analyzeRisk, recommendRoute } from "@sentinelmesh/risk-engine";
import { sentinelReportRegistryAbi, supportedChains } from "@sentinelmesh/web3";
import {
  DeFiIntentRequestSchema,
  FirewallEvaluateRequestSchema,
  IntentPromptSchema,
  OrchestrationRunRequestSchema,
  QuotePreviewRequestSchema,
  RawTransactionDecodeRequestSchema,
  ReportCreateRequestSchema,
  RouteAgentRequestSchema,
  type AgentResult,
  type DeFiIntent,
  type FirewallEvaluation,
  type FixtureScenario,
  type RawTransactionInput,
  type RiskAnalysis,
  type OrchestrationGate,
  type OrchestrationRun,
  type OrchestrationStep,
  type RouteAnalysis,
  type RouteOption,
  type RouteRecommendation,
  type RouteType,
  type SentinelReport
} from "@sentinelmesh/shared";
import { createAuthService } from "./auth.js";
import { evaluateFirewall } from "./firewall.js";
import { applyMarketEvidence, inspectMarket } from "./market-intelligence.js";
import { getQuotePreview } from "./quote-adapter.js";
import { createReportRepository } from "./report-repository.js";
import { decodeRawTransaction } from "./transaction-decoder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
loadEnvFile(path.resolve(repoRoot, ".env"));

const app = express();
const port = Number(process.env.PORT ?? 4000);
const reportsPath = path.resolve(repoRoot, process.env.REPORTS_DB_PATH ?? "data/reports.json");
const reportRepositoryPromise = createReportRepository({
  jsonPath: reportsPath,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "require"
});
const fixturesPath = path.resolve(repoRoot, "data/fixtures/scenarios.json");
const allowClientSuppliedOnChainHash = process.env.ALLOW_CLIENT_SUPPLIED_ONCHAIN_HASH === "true";
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const requestWindows = new Map<string, { count: number; resetAt: number }>();
const authCookieName = "sentinelmesh_session";
const authService = createAuthService({
  secret: getSessionSecret(),
  allowedDomains: getAuthAllowedDomains(allowedOrigins)
});

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by SentinelMesh CORS policy"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
    credentials: true
  })
);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(rateLimit({ maxRequests: Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? 120), windowMs: 60_000 }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sentinelmesh-api",
    version: "0.1.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/ready", async (_req, res) => {
  try {
    await loadFixtures();
    const { repository, provider } = await reportRepositoryPromise;
    await repository.list();
    res.json({
      ok: true,
      capabilities: {
        deterministicFallback: true,
        llmConfigured: Boolean(process.env.GROQ_API_KEY),
        registryConfigured: Boolean(getRegistryAddress() && getRegistryRpcUrl()),
        quoteConfigured: Boolean(process.env.ZEROX_API_KEY),
        quoteSimulationConfigured: Boolean(
          process.env.BASE_MAINNET_RPC_URL || process.env.ETHEREUM_MAINNET_RPC_URL
        )
      },
      storage: provider,
      network: getRegistryChain().name,
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({ ok: false, error: "SentinelMesh dependencies are not ready" });
  }
});

app.get("/auth/nonce", (_req, res) => {
  res.json({ nonce: authService.issueNonce() });
});

app.post("/auth/verify", async (req, res, next) => {
  try {
    const message = readAuthString(req.body?.message);
    const signature = readAuthString(req.body?.signature);
    if (!message || !isHex(signature)) return res.status(400).json({ error: "Valid SIWE message and signature are required" });

    const session = await authService.verifySiwe({ message, signature: signature as Hex });
    res.setHeader("Set-Cookie", serializeAuthCookie(authService.createSessionToken(session), session.expiresAt));
    return res.json({ authenticated: true, user: session });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/session", (req, res) => {
  const session = getAuthSession(req);
  res.json({ authenticated: Boolean(session), user: session });
});

app.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", serializeAuthCookie("", 0));
  res.json({ authenticated: false });
});

app.post("/api/intent", async (req, res, next) => {
  try {
    const prompt = requirePrompt(req.body);
    const result = await IntentAgent.run({ prompt });
    res.json({
      parsedIntent: result.output,
      confidence: result.confidence,
      reasoning: result.reasoning
    });
  } catch (error) {
    next(error);
  }
});

app.post("/intent/parse", async (req, res, next) => {
  try {
    const prompt = requirePrompt(req.body);
    const result = await IntentAgent.run({ prompt });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/risk/analyze", async (req, res, next) => {
  try {
    const context = await contextFromBody(req.body);
    const parsedIntent = context.parsedIntent ?? (await IntentAgent.run(context)).output;
    const { agent } = await runAuthoritativeRisk(parsedIntent);
    res.json(agent);
  } catch (error) {
    next(error);
  }
});

app.post("/api/risk", async (req, res, next) => {
  try {
    const { intent } = DeFiIntentRequestSchema.parse(req.body);
    const { analysis, agent } = await runAuthoritativeRisk(intent);
    res.json({
      analysis,
      agent
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/routes", async (req, res, next) => {
  try {
    const { intent, analysis } = RouteAgentRequestSchema.parse(req.body);
    const agent = await runRouteAgent(intent, analysis);
    res.json({
      recommendation: agent.output,
      routes: agent.output.routes,
      agent
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/quote", async (req, res, next) => {
  try {
    const { intent, takerAddress } = QuotePreviewRequestSchema.parse(req.body);
    if (takerAddress) {
      const session = getAuthSession(req);
      if (!session) {
        return res.status(401).json({ error: "Wallet authentication is required for a taker-specific quote" });
      }
      if (session.address.toLowerCase() !== takerAddress.toLowerCase()) {
        return res.status(403).json({ error: "Authenticated wallet does not match the quote taker" });
      }
    }
    return res.json(await getQuotePreview(intent, takerAddress));
  } catch (error) {
    next(error);
  }
});

app.post("/api/transaction/decode", async (req, res, next) => {
  try {
    const { transaction } = RawTransactionDecodeRequestSchema.parse(req.body);
    return res.json({ decodedTransaction: decodeRawTransaction(transaction as RawTransactionInput) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/firewall", async (req, res, next) => {
  try {
    const { intent, analysis, rawTransaction, policy } = FirewallEvaluateRequestSchema.parse(req.body);
    const session = getAuthSession(req);
    const authoritativeAnalysis = analysis ?? (await runAuthoritativeRisk(intent)).analysis;
    const quote = await getQuotePreview(intent, session?.address);
    const decodedTransaction = rawTransaction ? decodeRawTransaction(rawTransaction as RawTransactionInput) : undefined;
    const evaluation = evaluateFirewall({
      intent,
      analysis: authoritativeAnalysis,
      quote,
      decodedTransaction,
      policy
    });
    return res.json({ evaluation, quote, analysis: authoritativeAnalysis });
  } catch (error) {
    next(error);
  }
});

app.post("/route/recommend", async (req, res, next) => {
  try {
    const context = await contextFromBody(req.body);
    const parsedIntent = context.parsedIntent ?? (await IntentAgent.run(context)).output;
    const riskAnalysis = context.riskAnalysis ?? analyzeRisk(parsedIntent);
    const result = await RouteAgent.run({ ...context, parsedIntent, riskAnalysis });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/agents/run", async (req, res, next) => {
  try {
    const prompt = requirePrompt(req.body);
    res.json(await runAgents({ prompt, fixtures: await loadFixtures() }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/orchestrations/run", async (req, res, next) => {
  try {
    const body = OrchestrationRunRequestSchema.parse(req.body);
    const startedAt = new Date().toISOString();
    const steps: OrchestrationStep[] = [];
    const agentTrace: AgentResult[] = [];
    const session = getAuthSession(req);

    const intentResult = await timedStep(steps, {
      id: "intent",
      label: "Parse natural-language intent",
      agentName: "IntentAgent",
      dependencies: [],
      run: async () => IntentAgent.run({ prompt: body.prompt, fixtures: await loadFixtures() })
    });
    agentTrace.push(intentResult);

    const riskResult = await timedStep(steps, {
      id: "risk",
      label: "Score transaction risk",
      agentName: "RiskAgent",
      dependencies: ["intent"],
      run: async () => (await runAuthoritativeRisk(intentResult.output)).agent
    });
    agentTrace.push(riskResult);

    const routeResult = await timedStep(steps, {
      id: "route",
      label: "Build route recommendation set",
      agentName: "RouteAgent",
      dependencies: ["risk"],
      run: () => runRouteAgent(intentResult.output, riskResult.output)
    });
    agentTrace.push(routeResult);

    const quoteStart = Date.now();
    const quoteStartedAt = new Date().toISOString();
    const quotePreview = await getQuotePreview(intentResult.output, session?.address);
    steps.push({
      id: "quote",
      label: "Attach quote and simulation evidence",
      agentName: "QuoteAdapter",
      status: quotePreview.status === "live" ? "completed" : "warning",
      dependencies: ["route"],
      startedAt: quoteStartedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - quoteStart,
      summary:
        quotePreview.status === "live"
          ? "Live quote evidence attached to the run."
          : "Used fallback quote evidence so the orchestration remains demoable."
    });

    const firewallStart = Date.now();
    const firewallStartedAt = new Date().toISOString();
    const decodedTransaction = body.rawTransaction ? decodeRawTransaction(body.rawTransaction as RawTransactionInput) : undefined;
    const firewallEvaluation = evaluateFirewall({
      intent: intentResult.output,
      analysis: riskResult.output,
      quote: quotePreview,
      decodedTransaction,
      policy: body.policy
    });
    steps.push({
      id: "firewall",
      label: "Evaluate policy and signing firewall",
      agentName: "FirewallOrchestrator",
      status: firewallEvaluation.decision === "BLOCK" ? "blocked" : firewallEvaluation.decision === "WARN" ? "warning" : "completed",
      dependencies: ["quote"],
      startedAt: firewallStartedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - firewallStart,
      summary: firewallEvaluation.summary
    });

    const selectedRouteId = routeResult.output.selectedRouteId ?? routeResult.output.recommendedRouteId ?? routeResult.output.routes[0]?.routeId;
    const gates = buildOrchestrationGates(riskResult.output, routeResult.output, firewallEvaluation);
    const blocked = gates.some((gate) => gate.status === "block");
    const warned = gates.some((gate) => gate.status === "warn");
    const completedAt = new Date().toISOString();
    const run: OrchestrationRun = {
      runId: randomUUID(),
      status: blocked ? "blocked" : warned ? "needs-review" : "completed",
      mode: "simulation",
      prompt: body.prompt,
      parsedIntent: intentResult.output,
      riskAnalysis: riskResult.output,
      routeAnalysis: routeResult.output,
      quotePreview,
      firewallEvaluation,
      selectedRouteId,
      agentTrace,
      steps,
      gates,
      nextActions: buildOrchestrationNextActions(blocked, warned, firewallEvaluation.decision),
      summary: buildOrchestrationSummary(blocked, warned, riskResult.output, firewallEvaluation.decision),
      startedAt,
      completedAt
    };
    res.json(run);
  } catch (error) {
    next(error);
  }
});

app.post("/reports", async (req, res, next) => {
  try {
    const body = ReportCreateRequestSchema.parse(req.body);
    const session = getAuthSession(req);
    if (body.userAddress && !session) {
      return res.status(401).json({ error: "Wallet authentication is required for wallet-owned reports" });
    }
    if (body.userAddress && session && body.userAddress.toLowerCase() !== session.address.toLowerCase()) {
      return res.status(403).json({ error: "Authenticated wallet does not match the report owner" });
    }
    const authenticatedUserAddress = body.userAddress ? session?.address : undefined;

    const prompt = body.prompt;
    const parsedIntent = body.parsedIntent;
    const intentResult: AgentResult<DeFiIntent> = {
      agentName: "IntentAgent",
      status: parsedIntent.action === "unsupported" ? "warning" : "completed",
      confidence: 1,
      reasoning: ["Accepted the user-reviewed structured intent as the authoritative report input."],
      output: parsedIntent,
      timestamp: new Date().toISOString()
    };
    const { agent: riskResult } = await runAuthoritativeRisk(parsedIntent);
    const routeResult = await runRouteAgent(parsedIntent, riskResult.output);
    const selectedRoute = routeResult.output.routes.find((route) => route.routeId === body.selectedRouteId);
    if (!selectedRoute) return res.status(400).json({ error: "Selected route is not valid for the server-computed analysis" });
    const routeRecommendation = routeOptionToRecommendation(routeResult.output, selectedRoute);
    const quotePreview = await getQuotePreview(parsedIntent, authenticatedUserAddress);
    const firewallEvaluation = evaluateFirewall({
      intent: parsedIntent,
      analysis: riskResult.output,
      quote: quotePreview,
      policy: body.policy
    });

    const reportContext: AgentContext = {
      prompt,
      parsedIntent,
      riskAnalysis: riskResult.output,
      routeRecommendation,
      evidenceReceipt: firewallEvaluation.transactionPreview.evidence,
      firewallEvaluation,
      userAddress: authenticatedUserAddress,
      fixtures: await loadFixtures()
    };
    const reportResult = await ReportAgent.run(reportContext);
    const report: SentinelReport = {
      ...reportResult.output,
      agentTrace: [intentResult, riskResult, routeResult, reportResult],
      verificationStatus: "local-only"
    };

    const { repository } = await reportRepositoryPromise;
    await repository.insert(report);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

function routeOptionToRecommendation(analysis: RouteAnalysis, selected: RouteOption): RouteRecommendation {
  return {
    recommendedRoute: routeOptionType(selected),
    alternatives: analysis.routes
      .filter((route) => route.routeId !== selected.routeId)
      .map(routeOptionType)
      .filter((route, index, routes) => routes.indexOf(route) === index),
    pros: selected.pros,
    cons: selected.cons,
    explanation: selected.recommendationReason
  };
}

function routeOptionType(route: RouteOption): RouteType {
  if (route.decision === "fallback" || route.riskScore > 85) return "BLOCKED_UNSAFE";
  if (route.routeId.includes("split")) return "SPLIT_ORDER";
  if (route.routeId.includes("protected")) return "PROTECTED_ROUTE";
  if (route.decision === "report-only" || route.routeId.includes("report")) return "DELAYED_EXECUTION";
  return "STANDARD_ROUTE";
}

async function timedStep<TOutput>(
  steps: OrchestrationStep[],
  config: {
    id: string;
    label: string;
    agentName: string;
    dependencies: string[];
    run: () => Promise<AgentResult<TOutput>>;
  }
): Promise<AgentResult<TOutput>> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const result = await config.run();
    steps.push({
      id: config.id,
      label: config.label,
      agentName: config.agentName,
      dependencies: config.dependencies,
      status: result.status === "failed" ? "failed" : result.status === "warning" ? "warning" : "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      summary: result.reasoning[0] ?? `${config.agentName} completed.`
    });
    return result;
  } catch (error) {
    steps.push({
      id: config.id,
      label: config.label,
      agentName: config.agentName,
      dependencies: config.dependencies,
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      summary: error instanceof Error ? error.message : `${config.agentName} failed.`
    });
    throw error;
  }
}

function buildOrchestrationGates(
  risk: RiskAnalysis,
  routeAnalysis: RouteAnalysis,
  firewall: FirewallEvaluation
): OrchestrationGate[] {
  const selectedRoute = routeAnalysis.routes.find((route) => route.routeId === routeAnalysis.selectedRouteId || route.routeId === routeAnalysis.recommendedRouteId);
  return [
    {
      id: "intent-supported",
      label: "Intent supported",
      status: selectedRoute?.decision === "fallback" ? "block" : "pass",
      reason: selectedRoute?.decision === "fallback" ? "The request is outside the v0 execution policy." : "The request maps to a supported v0 review path."
    },
    {
      id: "risk-threshold",
      label: "Risk threshold",
      status: risk.riskScore > 85 ? "block" : risk.riskScore > 55 ? "warn" : "pass",
      reason: `Risk score is ${risk.riskScore}/100 (${risk.riskLevel}).`
    },
    {
      id: "route-available",
      label: "Route available",
      status: routeGateStatus(selectedRoute),
      reason: selectedRoute ? selectedRoute.recommendationReason : "No route candidate was selected."
    },
    {
      id: "firewall-policy",
      label: "Firewall policy",
      status: firewall.decision === "BLOCK" ? "block" : firewall.decision === "WARN" ? "warn" : "pass",
      reason: firewall.summary
    },
    {
      id: "report-readiness",
      label: "Report readiness",
      status: firewall.decision === "BLOCK" ? "warn" : "pass",
      reason:
        firewall.decision === "BLOCK"
          ? "A local evidence report can still be saved, but execution should remain blocked."
          : "The run has enough deterministic evidence for a local verifiable report."
    }
  ];
}

function routeGateStatus(route?: RouteOption): OrchestrationGate["status"] {
  if (!route || route.decision === "fallback" || route.riskScore > 85) return "block";
  if (route.decision === "report-only") return "warn";
  return "pass";
}

function buildOrchestrationNextActions(blocked: boolean, warned: boolean, decision: FirewallEvaluation["decision"]) {
  if (blocked || decision === "BLOCK") {
    return [
      "Do not ask the wallet to sign this transaction.",
      "Review the blocking policy violations and scam-pattern matches.",
      "Generate a local evidence report for audit/history if needed."
    ];
  }
  if (warned || decision === "WARN") {
    return [
      "Require human approval before signing.",
      "Prefer the recommended lower-risk route.",
      "Save a report before continuing."
    ];
  }
  return [
    "Proceed in simulation/report mode.",
    "Save a local report hash.",
    "Anchor the hash on Base Sepolia later when faucet funding is available."
  ];
}

function buildOrchestrationSummary(
  blocked: boolean,
  warned: boolean,
  risk: RiskAnalysis,
  decision: FirewallEvaluation["decision"]
) {
  if (blocked) return `Orchestration blocked signing: firewall=${decision}, risk=${risk.riskScore}/100.`;
  if (warned) return `Orchestration needs review before signing: firewall=${decision}, risk=${risk.riskScore}/100.`;
  return `Orchestration completed in simulation mode: firewall=${decision}, risk=${risk.riskScore}/100.`;
}

async function runAuthoritativeRisk(intent: DeFiIntent) {
  const baseAgent = await runRiskAgent(intent);
  const marketEvidence = await inspectMarket(intent);
  const analysis = applyMarketEvidence(baseAgent.output, marketEvidence);
  const agent: AgentResult<RiskAnalysis> = {
    ...baseAgent,
    output: analysis,
    reasoning: [
      ...baseAgent.reasoning,
      marketEvidence.status === "live"
        ? "Applied read-only live market evidence to explainable risk factors."
        : "Live market evidence was unavailable or not applicable; retained deterministic fallback factors."
    ]
  };
  return { analysis, agent };
}

app.get("/reports", async (req, res, next) => {
  try {
    const { repository } = await reportRepositoryPromise;
    const reports = await repository.list();
    const session = getAuthSession(req);
    const visibleReports = session
      ? reports.filter((report) => !report.userAddress || report.userAddress.toLowerCase() === session.address.toLowerCase())
      : reports.filter((report) => !report.userAddress);
    res.json(visibleReports);
  } catch (error) {
    next(error);
  }
});

app.get("/reports/:id", async (req, res, next) => {
  try {
    const { repository } = await reportRepositoryPromise;
    const report = await repository.get(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    return res.json(report);
  } catch (error) {
    next(error);
  }
});

app.post("/reports/:id/verify", async (req, res, next) => {
  try {
    const { repository } = await reportRepositoryPromise;
    const report = await repository.get(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    const localHash = recomputeReportHash(report);
    const proposedTxHash = req.body?.chainTxHash ?? report.chainTxHash;
    if (proposedTxHash && !isHash(proposedTxHash)) {
      return res.status(400).json({ error: "Invalid transaction hash" });
    }
    let onChainHash: `0x${string}` | undefined;
    let verificationSource: "registry" | "client-supplied" | "none" = "none";
    let registryReadError: string | undefined;
    let transactionVerified = false;

    try {
      const registryResult = await readOnChainReportHash(report, proposedTxHash);
      onChainHash = registryResult.reportHash;
      transactionVerified = registryResult.transactionVerified;
      verificationSource = "registry";
    } catch (error) {
      registryReadError = error instanceof Error ? error.message : "Unable to read report registry";
      if (allowClientSuppliedOnChainHash && isHash(req.body?.onChainHash)) {
        onChainHash = req.body.onChainHash;
        verificationSource = "client-supplied";
      }
    }

    const result = await VerificationAgent.run({ prompt: report.originalPrompt, report, onChainHash } as AgentContext & {
      report: SentinelReport;
      onChainHash?: `0x${string}`;
    });
    if (proposedTxHash && transactionVerified) {
      report.chainTxHash = proposedTxHash;
    }
    report.agentTrace = [...report.agentTrace.filter((entry) => entry.agentName !== "VerificationAgent"), result];
    report.verificationStatus = localHash.toLowerCase() === report.reportHash.toLowerCase() && result.output.verified ? "verified" : onChainHash ? "mismatch" : "local-only";
    await repository.replace(report);
    return res.json({ ...result, report, verificationSource, registryReadError, transactionVerified });
  } catch (error) {
    next(error);
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (isZodError(err)) {
    return res.status(400).json({ error: err.issues[0]?.message ?? "Invalid request body" });
  }
  const message = err instanceof Error ? err.message : "Unknown API error";
  res.status(400).json({ error: message });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`SentinelMesh API listening on http://localhost:${port}`);
  });
}

export { app };

async function contextFromBody(body: { prompt?: string; parsedIntent?: DeFiIntent; riskAnalysis?: RiskAnalysis }) {
  const prompt = body.prompt ?? "Analyze DeFi intent";
  return {
    prompt,
    parsedIntent: body.parsedIntent,
    riskAnalysis: body.riskAnalysis,
    fixtures: await loadFixtures()
  };
}

function requirePrompt(body: { prompt?: unknown; originalPrompt?: unknown }): string {
  const prompt = body.prompt ?? body.originalPrompt;
  return IntentPromptSchema.parse({ prompt }).prompt;
}

async function loadFixtures(): Promise<FixtureScenario[]> {
  const raw = await readFile(fixturesPath, "utf8");
  return JSON.parse(raw) as FixtureScenario[];
}

function isZodError(error: unknown): error is { issues: Array<{ message: string }> } {
  return Boolean(error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues));
}

function getAuthSession(req: express.Request) {
  return authService.readSessionToken(parseCookies(req.headers.cookie)[authCookieName]);
}

function parseCookies(header?: string) {
  return Object.fromEntries(
    (header ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator === -1 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      })
  );
}

function serializeAuthCookie(token: string, expiresAt: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = expiresAt > Date.now() ? Math.floor((expiresAt - Date.now()) / 1000) : 0;
  return `${authCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function readAuthString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const wrapped = value as { message?: unknown; signature?: unknown; value?: unknown };
  if (typeof wrapped.message === "string") return wrapped.message.trim();
  if (typeof wrapped.signature === "string") return wrapped.signature.trim();
  if (typeof wrapped.value === "string") return wrapped.value.trim();
  return "";
}

function loadEnvFile(filePath: string) {
  try {
    const contents = readFileSync(filePath, "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Local development can run without a .env file; production should provide real environment variables.
  }
}

function getSessionSecret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production");
  return randomBytes(32).toString("hex");
}

function getAuthAllowedDomains(origins: string[]) {
  const configured = process.env.AUTH_ALLOWED_DOMAINS?.split(",").map((domain) => domain.trim()).filter(Boolean);
  if (configured?.length) return configured;
  return origins.map((origin) => {
    try {
      return new URL(origin).host;
    } catch {
      return origin;
    }
  });
}

function rateLimit({ maxRequests, windowMs }: { maxRequests: number; windowMs: number }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = req.ip || "unknown";
    const current = requestWindows.get(key);
    const window = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    window.count += 1;
    requestWindows.set(key, window);
    res.setHeader("RateLimit-Limit", maxRequests);
    res.setHeader("RateLimit-Remaining", Math.max(0, maxRequests - window.count));
    res.setHeader("RateLimit-Reset", Math.ceil(window.resetAt / 1000));
    if (window.count > maxRequests) {
      return res.status(429).json({ error: "Too many requests. Retry after the current rate-limit window." });
    }
    return next();
  };
}

async function readOnChainReportHash(
  report: SentinelReport,
  transactionHash?: `0x${string}`
): Promise<{ reportHash: `0x${string}`; transactionVerified: boolean }> {
  const registryAddress = getRegistryAddress();
  const rpcUrl = getRegistryRpcUrl();
  const chain = getRegistryChain();

  if (!registryAddress) throw new Error("REPORT_REGISTRY_ADDRESS or NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS is not configured");
  if (!rpcUrl) throw new Error("REPORT_REGISTRY_RPC_URL, BASE_SEPOLIA_RPC_URL, or SEPOLIA_RPC_URL is not configured");
  if (!report.userAddress || !isAddress(report.userAddress)) throw new Error("Report does not include a valid wallet address");

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl)
  });
  const userReports = await client.readContract({
    address: registryAddress,
    abi: sentinelReportRegistryAbi,
    functionName: "getUserReports",
    args: [report.userAddress]
  });
  const match = [...userReports].reverse().find((item) => {
    return item.reportURI === report.reportURI || item.reportHash.toLowerCase() === report.reportHash.toLowerCase();
  });

  if (!match) throw new Error("No matching report found in SentinelReportRegistry for this wallet");
  if (!transactionHash) return { reportHash: match.reportHash, transactionVerified: false };

  const receipt = await client.getTransactionReceipt({ hash: transactionHash });
  if (receipt.status !== "success") throw new Error("Registry transaction did not succeed");
  const matchingEvent = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== registryAddress.toLowerCase()) return false;
    try {
      const decoded = decodeEventLog({
        abi: sentinelReportRegistryAbi,
        eventName: "ReportCreated",
        data: log.data,
        topics: log.topics
      });
      return (
        decoded.args.user.toLowerCase() === report.userAddress?.toLowerCase() &&
        decoded.args.reportHash.toLowerCase() === report.reportHash.toLowerCase() &&
        decoded.args.reportURI === report.reportURI
      );
    } catch {
      return false;
    }
  });
  if (!matchingEvent) throw new Error("Transaction receipt does not contain the matching ReportCreated event");

  return { reportHash: match.reportHash, transactionVerified: true };
}

function getRegistryAddress(): `0x${string}` | undefined {
  const value = process.env.REPORT_REGISTRY_ADDRESS ?? process.env.NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS;
  return value && isAddress(value) ? value : undefined;
}

function getRegistryRpcUrl(): string | undefined {
  return process.env.REPORT_REGISTRY_RPC_URL ?? process.env.BASE_SEPOLIA_RPC_URL ?? process.env.SEPOLIA_RPC_URL;
}

function getRegistryChain(): Chain {
  const chainId = Number(process.env.REPORT_REGISTRY_CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
  return supportedChains.find((chain) => chain.id === chainId) ?? supportedChains[0];
}
