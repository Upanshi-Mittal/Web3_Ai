import type {
  AgentResult,
  AgentWalletPolicy,
  DecodedTransaction,
  DeFiIntent,
  FirewallEvaluation,
  OrchestrationRun,
  QuotePreview,
  RawTransactionInput,
  RiskAnalysis,
  RouteAnalysis,
  RouteOption,
  SentinelReport
} from "@sentinelmesh/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
const API_PROXY_URL = "/api/backend";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithProxyFallback(path, init);

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? "SentinelMesh API error");
  }

  return response.json() as Promise<T>;
}

async function fetchWithProxyFallback(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, requestInit(init));
  } catch (error) {
    if (API_URL === API_PROXY_URL) throw error;
    return fetch(`${API_PROXY_URL}${path}`, requestInit(init));
  }
}

function requestInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    cache: "no-store",
    credentials: "include"
  };
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

export type AuthUser = {
  address: `0x${string}`;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
};

export const api = {
  getAuthNonce() {
    return request<{ nonce: string }>("/auth/nonce");
  },
  verifyAuth(message: string, signature: string) {
    return request<{ authenticated: true; user: AuthUser }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ message: String(message), signature: String(signature) })
    });
  },
  getAuthSession() {
    return request<{ authenticated: boolean; user?: AuthUser }>("/auth/session");
  },
  logout() {
    return request<{ authenticated: false }>("/auth/logout", { method: "POST", body: "{}" });
  },
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
  getQuotePreview(intent: DeFiIntent, takerAddress?: string) {
    return request<QuotePreview>("/api/quote", {
      method: "POST",
      body: JSON.stringify({ intent, takerAddress })
    });
  },
  decodeTransaction(transaction: RawTransactionInput) {
    return request<{ decodedTransaction: DecodedTransaction }>("/api/transaction/decode", {
      method: "POST",
      body: JSON.stringify({ transaction })
    });
  },
  evaluateFirewall(intent: DeFiIntent, analysis?: RiskAnalysis, policy?: AgentWalletPolicy, rawTransaction?: RawTransactionInput) {
    return request<{ evaluation: FirewallEvaluation; quote: QuotePreview; analysis: RiskAnalysis }>("/api/firewall", {
      method: "POST",
      body: JSON.stringify({ intent, analysis, policy, rawTransaction })
    });
  },
  runOrchestration(prompt: string, policy?: AgentWalletPolicy, rawTransaction?: RawTransactionInput) {
    return request<OrchestrationRun>("/api/orchestrations/run", {
      method: "POST",
      body: JSON.stringify({ prompt, policy, rawTransaction })
    });
  },
  createReport(input: {
    prompt: string;
    parsedIntent: DeFiIntent;
    selectedRouteId: string;
    userAddress?: string;
    policy?: AgentWalletPolicy;
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
    return request<{ report: SentinelReport; output: { verified: boolean }; verificationSource: string; registryReadError?: string; transactionVerified: boolean }>(`/reports/${id}/verify`, {
      method: "POST",
      body: JSON.stringify(body ?? {})
    });
  }
};
