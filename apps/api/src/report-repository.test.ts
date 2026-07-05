import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SentinelReport } from "@sentinelmesh/shared";
import { createReportRepository, JsonReportRepository } from "./report-repository.js";

test("serializes concurrent report inserts without losing data", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sentinelmesh-reports-"));
  try {
    const repository = new JsonReportRepository(path.join(directory, "reports.json"));
    const reports = Array.from({ length: 25 }, (_, index) => reportFixture(String(index)));

    await Promise.all(reports.map((report) => repository.insert(report)));

    const stored = await repository.list();
    assert.equal(stored.length, reports.length);
    assert.deepEqual(new Set(stored.map((report) => report.id)), new Set(reports.map((report) => report.id)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("uses the local JSON repository when DATABASE_URL is not configured", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sentinelmesh-repository-"));
  try {
    const result = await createReportRepository({
      jsonPath: path.join(directory, "reports.json"),
      databaseUrl: undefined,
      databaseSsl: false
    });
    assert.equal(result.provider, "json");
    assert.ok(result.repository instanceof JsonReportRepository);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function reportFixture(id: string): SentinelReport {
  return {
    id,
    originalPrompt: "test",
    parsedIntent: { action: "analyze", priority: "safety", constraints: {} },
    riskScore: 10,
    riskLevel: "Low",
    riskFactors: {
      slippageRisk: 10,
      liquidityRisk: 10,
      priceImpactRisk: 10,
      gasRisk: 10,
      tokenRisk: 10,
      routeComplexityRisk: 10,
      mevExposureRisk: 10
    },
    riskFactorExplanations: [],
    recommendedRoute: {
      recommendedRoute: "STANDARD_ROUTE",
      alternatives: [],
      pros: [],
      cons: [],
      explanation: "test"
    },
    agentTrace: [],
    modelVersion: "test",
    reportHash: `0x${"1".repeat(64)}`,
    reportURI: `sentinelmesh://reports/${id}`,
    verificationStatus: "local-only",
    createdAt: new Date().toISOString()
  };
}
