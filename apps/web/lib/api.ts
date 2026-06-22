import type { AgentResult, DeFiIntent, RiskAnalysis, RouteAnalysis, RouteOption, RouteRecommendation, SentinelReport } from "@sentinelmesh/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? "SentinelMesh API error");
  }

  return response.json() as Promise<T>;
}

export type AgentRunResponse = {
  parsedIntent: DeFiIntent;
  riskAnalysis: RiskAnalysis;
  routeRecommendation: RouteAnalysis;
  agentTrace: AgentResult[];
};

export type IntentParseResponse = {
  parsedIntent: DeFiIntent;
  confidence: number;
  reasoning: string[];
};

export type RiskAnalyzeResponse = {
  analysis: RiskAnalysis;
  agent: AgentResult<RiskAnalysis>;
};

export type RouteAnalyzeResponse = {
  recommendation: RouteAnalysis;
  routes: RouteOption[];
  agent: AgentResult<RouteAnalysis>;
};

export const api = {
  parseIntent(prompt: string) {
    return request<IntentParseResponse>("/api/intent", {
      method: "POST",
      body: JSON.stringify({ prompt })
    });
  },
  runAgents(prompt: string) {
    return request<AgentRunResponse>("/agents/run", {
      method: "POST",
      body: JSON.stringify({ prompt })
    });
  },
  analyzeRisk(intent: DeFiIntent) {
    return request<RiskAnalyzeResponse>("/api/risk", {
      method: "POST",
      body: JSON.stringify({ intent })
    });
  },
  analyzeRoutes(intent: DeFiIntent, analysis: RiskAnalysis) {
    return request<RouteAnalyzeResponse>("/api/routes", {
      method: "POST",
      body: JSON.stringify({ intent, analysis })
    });
  },
  createReport(input: {
    prompt: string;
    parsedIntent: DeFiIntent;
    riskScore: number;
    riskLevel: string;
    riskFactors: unknown;
    riskFactorExplanations: unknown;
    recommendedRoute: RouteRecommendation;
    agentTrace: AgentResult[];
    userAddress?: string;
    chainTxHash?: string;
  }) {
    return request<SentinelReport>("/reports", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  listReports() {
    return request<SentinelReport[]>("/reports");
  },
  getReport(id: string) {
    return request<SentinelReport>(`/reports/${id}`);
  },
  verifyReport(id: string, body?: { onChainHash?: string; chainTxHash?: string }) {
    return request<{ report: SentinelReport; output: { verified: boolean }; verificationSource: string; registryReadError?: string }>(`/reports/${id}/verify`, {
      method: "POST",
      body: JSON.stringify(body ?? {})
    });
  }
};
