import cors from "cors";
import express from "express";
import morgan from "morgan";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  IntentAgent,
  RiskAgent,
  RouteAgent,
  VerificationAgent,
  recomputeReportHash,
  runAgents,
  runRiskAgent,
  type AgentContext
} from "@sentinelmesh/agents";
import { analyzeRisk, recommendRoute } from "@sentinelmesh/risk-engine";
import { DeFiIntentRequestSchema, IntentPromptSchema, type DeFiIntent, type FixtureScenario, type SentinelReport } from "@sentinelmesh/shared";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const reportsPath = path.resolve(repoRoot, process.env.REPORTS_DB_PATH ?? "data/reports.json");
const fixturesPath = path.resolve(repoRoot, "data/fixtures/scenarios.json");

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
    const onChainHash = req.body?.onChainHash;
    const result = await VerificationAgent.run({ prompt: report.originalPrompt, report, onChainHash } as AgentContext & {
      report: SentinelReport;
      onChainHash: string;
    });
    if (req.body?.chainTxHash) {
      report.chainTxHash = req.body.chainTxHash;
    }
    report.verificationStatus = result.output.verified ? "verified" : onChainHash ? "mismatch" : "local-only";
    reports[index] = report;
    await writeReports(reports);
    return res.json({ ...result, report });
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

async function contextFromBody(body: { prompt?: string; parsedIntent?: DeFiIntent; riskAnalysis?: ReturnType<typeof analyzeRisk> }) {
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
    return JSON.parse(raw) as SentinelReport[];
  } catch {
    return [];
  }
}

async function writeReports(reports: SentinelReport[]) {
  await mkdir(path.dirname(reportsPath), { recursive: true });
  await writeFile(reportsPath, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
}

function isZodError(error: unknown): error is { issues: Array<{ message: string }> } {
  return Boolean(error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues));
}
