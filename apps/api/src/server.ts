import cors from "cors";
import express from "express";
import morgan from "morgan";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, isAddress, isHash, type Chain } from "viem";
import {
  IntentAgent,
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
  IntentPromptSchema,
  RouteAgentRequestSchema,
  type DeFiIntent,
  type FixtureScenario,
  type RiskAnalysis,
  type SentinelReport
} from "@sentinelmesh/shared";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const reportsPath = path.resolve(repoRoot, process.env.REPORTS_DB_PATH ?? "data/reports.json");
const fixturesPath = path.resolve(repoRoot, "data/fixtures/scenarios.json");
const allowClientSuppliedOnChainHash = process.env.ALLOW_CLIENT_SUPPLIED_ONCHAIN_HASH === "true";

app.use(cors());
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
    const result = await RiskAgent.run({ ...context, parsedIntent });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/risk", async (req, res, next) => {
  try {
    const { intent } = DeFiIntentRequestSchema.parse(req.body);
    const agent = await runRiskAgent(intent);
    res.json({
      analysis: agent.output,
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

app.post("/reports", async (req, res, next) => {
  try {
    const body = req.body as Partial<SentinelReport> & {
      prompt?: string;
      userAddress?: string;
      chainTxHash?: `0x${string}`;
    };

    const prompt = body.originalPrompt ?? body.prompt ?? requirePrompt(body);
    const parsedIntent = body.parsedIntent ?? (await IntentAgent.run({ prompt, fixtures: await loadFixtures() })).output;
    const riskAnalysis =
      body.riskScore !== undefined && body.riskFactors
        ? {
            riskScore: body.riskScore,
            riskLevel: body.riskLevel ?? analyzeRisk(parsedIntent).riskLevel,
            riskFactors: body.riskFactors,
            riskExplanations: analyzeRisk(parsedIntent).riskExplanations,
            topFactors: analyzeRisk(parsedIntent).topFactors,
            factors: body.riskFactors,
            factorExplanations: body.riskFactorExplanations ?? analyzeRisk(parsedIntent).factorExplanations,
            summary: "Risk analysis supplied by client workflow.",
            dataSource: "mixed" as const,
            riskEngineVersion: analyzeRisk(parsedIntent).riskEngineVersion
          }
        : analyzeRisk(parsedIntent);
    const routeRecommendation = body.recommendedRoute ?? recommendRoute(riskAnalysis);

    const agentRun = await runAgents({ prompt, parsedIntent, fixtures: await loadFixtures() });
    const reportContext: AgentContext = {
      prompt,
      parsedIntent,
      riskAnalysis,
      routeRecommendation,
      userAddress: body.userAddress,
      chainTxHash: body.chainTxHash,
      reportURI: body.reportURI,
      fixtures: await loadFixtures()
    };
    const reportResult = await import("@sentinelmesh/agents").then(({ ReportAgent }) => ReportAgent.run(reportContext));
    const report: SentinelReport = {
      ...reportResult.output,
      agentTrace: [...agentRun.agentTrace, reportResult],
      verificationStatus: body.chainTxHash ? "pending" : "local-only"
    };

    const reports = await readReports();
    reports.unshift(report);
    await writeReports(reports);
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
});

app.get("/reports", async (_req, res, next) => {
  try {
    res.json(await readReports());
  } catch (error) {
    next(error);
  }
});

app.get("/reports/:id", async (req, res, next) => {
  try {
    const report = (await readReports()).find((item) => item.id === req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    return res.json(report);
  } catch (error) {
    next(error);
  }
});

app.post("/reports/:id/verify", async (req, res, next) => {
  try {
    const reports = await readReports();
    const index = reports.findIndex((item) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Report not found" });

    const report = reports[index];
    const localHash = recomputeReportHash(report);
    let onChainHash: `0x${string}` | undefined;
    let verificationSource: "registry" | "client-supplied" | "none" = "none";
    let registryReadError: string | undefined;

    try {
      onChainHash = await readOnChainReportHash(report);
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
    if (req.body?.chainTxHash) {
      report.chainTxHash = req.body.chainTxHash;
    }
    report.verificationStatus = localHash.toLowerCase() === report.reportHash.toLowerCase() && result.output.verified ? "verified" : onChainHash ? "mismatch" : "local-only";
    report.agentTrace = [...report.agentTrace.filter((entry) => entry.agentName !== "VerificationAgent"), result];
    reports[index] = report;
    await writeReports(reports);
    return res.json({ ...result, report, verificationSource, registryReadError });
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

app.listen(port, () => {
  console.log(`SentinelMesh API listening on http://localhost:${port}`);
});

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

async function readReports(): Promise<SentinelReport[]> {
  try {
    const raw = await readFile(reportsPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SentinelReport[]) : [];
  } catch {
    return [];
  }
}

async function writeReports(reports: SentinelReport[]) {
  await mkdir(path.dirname(reportsPath), { recursive: true });
  const tmpPath = `${reportsPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
  await rename(tmpPath, reportsPath);
}

function isZodError(error: unknown): error is { issues: Array<{ message: string }> } {
  return Boolean(error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues));
}

async function readOnChainReportHash(report: SentinelReport): Promise<`0x${string}`> {
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
  return match.reportHash;
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
