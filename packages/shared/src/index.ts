import { z } from "zod";

export type AgentStatus = "pending" | "running" | "completed" | "warning" | "failed";

export type AgentResult<TOutput = unknown> = {
  agentName: string;
  status: AgentStatus;
  confidence: number;
  reasoning: string[];
  output: TOutput;
  timestamp: string;
};

export type DeFiAction = "swap" | "bridge" | "stake" | "analyze" | "unsupported";
export type DeFiPriority = "safety" | "speed" | "cost" | "yield";
export type RiskTolerance = "low" | "medium" | "high";

export type DeFiIntent = {
  action: DeFiAction;
  tokenIn?: string;
  tokenOut?: string;
  amount?: string;
  chain?: string;
  priority: DeFiPriority;
  constraints: {
    maxSlippage?: string;
    riskTolerance?: RiskTolerance;
  };
};

export const DeFiIntentSchema = z.object({
  action: z.enum(["swap", "bridge", "stake", "analyze", "unsupported"]),
  tokenIn: z.string().optional(),
  tokenOut: z.string().optional(),
  amount: z.string().optional(),
  chain: z.string().optional(),
  priority: z.enum(["safety", "speed", "cost", "yield"]),
  constraints: z.object({
    maxSlippage: z.string().optional(),
    riskTolerance: z.enum(["low", "medium", "high"]).optional()
  })
}) satisfies z.ZodType<DeFiIntent>;

export const IntentPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Prompt is required")
    .max(1000, "Prompt must be 1000 characters or fewer")
});

export const DeFiIntentRequestSchema = z.object({
  intent: DeFiIntentSchema
});

export type RiskFactors = {
  slippageRisk: number;
  liquidityRisk: number;
  priceImpactRisk: number;
  gasRisk: number;
  tokenRisk: number;
  routeComplexityRisk: number;
  mevExposureRisk: number;
};

export type RiskFactorExplanation = {
  key: keyof RiskFactors;
  label: string;
  score: number;
  explanation: string;
};

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export type MarketEvidence = {
  source: "dexscreener" | "fixture";
  status: "live" | "fallback" | "unavailable";
  chain: string;
  pair: string;
  dex?: string;
  liquidityUsd?: number;
  volume24hUsd?: number;
  priceChange24h?: number;
  pairAgeDays?: number;
  url?: string;
  observedAt: string;
  notes: string[];
};

export type RiskAnalysis = {
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactors;
  riskExplanations: Record<keyof RiskFactors, string>;
  topFactors: RiskFactorExplanation[];
  dataSource: "fixture" | "live" | "mixed";
  riskEngineVersion: string;
  summary: string;
  factors: RiskFactors;
  factorExplanations: RiskFactorExplanation[];
  marketEvidence?: MarketEvidence;
};

export const RiskAnalysisSchema = z.object({
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(["Low", "Medium", "High", "Critical"]),
  riskFactors: z.object({
    slippageRisk: z.number().min(0).max(100),
    liquidityRisk: z.number().min(0).max(100),
    priceImpactRisk: z.number().min(0).max(100),
    gasRisk: z.number().min(0).max(100),
    tokenRisk: z.number().min(0).max(100),
    routeComplexityRisk: z.number().min(0).max(100),
    mevExposureRisk: z.number().min(0).max(100)
  }),
  riskExplanations: z.record(z.string()),
  topFactors: z.array(
    z.object({
      key: z.enum([
        "slippageRisk",
        "liquidityRisk",
        "priceImpactRisk",
        "gasRisk",
        "tokenRisk",
        "routeComplexityRisk",
        "mevExposureRisk"
      ]),
      label: z.string(),
      score: z.number().min(0).max(100),
      explanation: z.string()
    })
  ),
  dataSource: z.enum(["fixture", "live", "mixed"]),
  riskEngineVersion: z.string(),
  summary: z.string(),
  factors: z.object({
    slippageRisk: z.number().min(0).max(100),
    liquidityRisk: z.number().min(0).max(100),
    priceImpactRisk: z.number().min(0).max(100),
    gasRisk: z.number().min(0).max(100),
    tokenRisk: z.number().min(0).max(100),
    routeComplexityRisk: z.number().min(0).max(100),
    mevExposureRisk: z.number().min(0).max(100)
  }),
  factorExplanations: z.array(
    z.object({
      key: z.enum([
        "slippageRisk",
        "liquidityRisk",
        "priceImpactRisk",
        "gasRisk",
        "tokenRisk",
        "routeComplexityRisk",
        "mevExposureRisk"
      ]),
      label: z.string(),
      score: z.number().min(0).max(100),
      explanation: z.string()
    })
  ),
  marketEvidence: z
    .object({
      source: z.enum(["dexscreener", "fixture"]),
      status: z.enum(["live", "fallback", "unavailable"]),
      chain: z.string(),
      pair: z.string(),
      dex: z.string().optional(),
      liquidityUsd: z.number().nonnegative().optional(),
      volume24hUsd: z.number().nonnegative().optional(),
      priceChange24h: z.number().optional(),
      pairAgeDays: z.number().nonnegative().optional(),
      url: z.string().url().optional(),
      observedAt: z.string(),
      notes: z.array(z.string())
    })
    .optional()
}) satisfies z.ZodType<RiskAnalysis>;

export type RouteType =
  | "STANDARD_ROUTE"
  | "PROTECTED_ROUTE"
  | "DELAYED_EXECUTION"
  | "SPLIT_ORDER"
  | "BLOCKED_UNSAFE";

export type RouteRecommendation = {
  recommendedRoute: RouteType;
  alternatives: RouteType[];
  pros: string[];
  cons: string[];
  explanation: string;
};

export type RouteExecutionMode = "simulation" | "report-on-chain" | "testnet";
export type RouteDecision = "recommended" | "available" | "report-only" | "not-recommended" | "fallback";
export type RouteComplexity = "low" | "medium" | "high" | "critical";

export type RouteOption = {
  routeId: string;
  routeName: string;
  action: DeFiAction;
  sourceChain: string;
  destinationChain?: string;
  inputToken: string;
  outputToken?: string;
  estimatedGas: string;
  estimatedTime: string;
  estimatedSlippage: string;
  estimatedPriceImpact: string;
  liquidityConfidence: number;
  routeComplexity: RouteComplexity;
  riskLevel: RiskLevel;
  riskScore: number;
  pros: string[];
  cons: string[];
  recommendationReason: string;
  supportedExecutionModes: RouteExecutionMode[];
  decision: RouteDecision;
  isRecommended: boolean;
};

export type RouteAnalysis = {
  routes: RouteOption[];
  recommendedRouteId?: string;
  selectedRouteId?: string;
  decisionSummary: string;
  dataSource: "fixture";
  routeEngineVersion: string;
};

const RouteOptionSchema = z.object({
  routeId: z.string().min(1),
  routeName: z.string().min(1),
  action: z.enum(["swap", "bridge", "stake", "analyze", "unsupported"]),
  sourceChain: z.string().min(1),
  destinationChain: z.string().min(1).optional(),
  inputToken: z.string().min(1),
  outputToken: z.string().min(1).optional(),
  estimatedGas: z.string().min(1),
  estimatedTime: z.string().min(1),
  estimatedSlippage: z.string().min(1),
  estimatedPriceImpact: z.string().min(1),
  liquidityConfidence: z.number().min(0).max(100),
  routeComplexity: z.enum(["low", "medium", "high", "critical"]),
  riskLevel: z.enum(["Low", "Medium", "High", "Critical"]),
  riskScore: z.number().min(0).max(100),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  recommendationReason: z.string(),
  supportedExecutionModes: z.array(z.enum(["simulation", "report-on-chain", "testnet"])),
  decision: z.enum(["recommended", "available", "report-only", "not-recommended", "fallback"]),
  isRecommended: z.boolean()
}) satisfies z.ZodType<RouteOption>;

export const RouteAnalysisSchema = z.object({
  routes: z.array(RouteOptionSchema).min(1),
  recommendedRouteId: z.string().optional(),
  selectedRouteId: z.string().optional(),
  decisionSummary: z.string(),
  dataSource: z.literal("fixture"),
  routeEngineVersion: z.string()
}) satisfies z.ZodType<RouteAnalysis>;

export const RouteAgentRequestSchema = z.object({
  intent: DeFiIntentSchema,
  analysis: RiskAnalysisSchema
});

export const QuotePreviewRequestSchema = z
  .object({
    intent: DeFiIntentSchema,
    takerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid taker address").optional()
  })
  .strict();

export type QuotePreview = {
  provider: "0x" | "fixture";
  status: "live" | "fallback" | "unavailable";
  chainId: number;
  pair: string;
  sellAmount: string;
  estimatedBuyAmount?: string;
  minimumBuyAmount?: string;
  estimatedGas?: string;
  routeSources: string[];
  allowanceRequired: boolean;
  balanceIssue: boolean;
  simulation: {
    status: "not-configured" | "success" | "reverted";
    gasEstimate?: string;
    reason?: string;
  };
  observedAt: string;
  notes: string[];
};

export type FirewallDecision = "ALLOW" | "WARN" | "BLOCK";

export type AgentWalletPolicy = {
  maxSlippagePercent: number;
  maxTransactionUsd: number;
  allowedTokens: string[];
  allowedProtocols: string[];
  allowBridges: boolean;
  allowUnlimitedApprovals: boolean;
  minLiquidityUsd: number;
  minPoolAgeDays: number;
  requireVerifiedContracts: boolean;
  riskBlockThreshold: number;
  riskWarnThreshold: number;
};

export type PolicyViolation = {
  ruleId: string;
  severity: "warning" | "blocking";
  title: string;
  detail: string;
};

export type ScamPatternMatch = {
  patternId: string;
  severity: "info" | "warning" | "critical";
  title: string;
  evidence: string[];
  recommendation: string;
};

export type AgentGuardrailState = {
  killSwitchTriggered: boolean;
  humanApprovalRequired: boolean;
  reason: string;
};

export type WalletHealthScore = {
  score: number;
  level: "Healthy" | "Watch" | "At Risk" | "Critical";
  signals: Array<{
    label: string;
    impact: "positive" | "neutral" | "negative";
    detail: string;
  }>;
};

export type EvidenceReceipt = {
  liquidityUsd?: number;
  volume24hUsd?: number;
  poolAgeDays?: number;
  slippageEstimatePercent?: number;
  priceImpactEstimatePercent?: number;
  approvalType: "none" | "exact" | "unknown" | "unlimited";
  simulationStatus: QuotePreview["simulation"]["status"];
  simulationGasEstimate?: string;
  routeSources: string[];
  evidenceHash: `0x${string}`;
  observedAt: string;
  notes: string[];
};

export type TransactionPreview = {
  decodedAction: string;
  chain: string;
  fromToken?: string;
  toToken?: string;
  amount?: string;
  protocol: string;
  approvalType: EvidenceReceipt["approvalType"];
  simulation: QuotePreview["simulation"];
  evidence: EvidenceReceipt;
  decodedTransaction?: DecodedTransaction;
};

export type FirewallEvaluation = {
  decision: FirewallDecision;
  policy: AgentWalletPolicy;
  violations: PolicyViolation[];
  scamPatterns: ScamPatternMatch[];
  guardrailState: AgentGuardrailState;
  walletHealth: WalletHealthScore;
  transactionPreview: TransactionPreview;
  summary: string;
  evaluatedAt: string;
};

export type RawTransactionInput = {
  to?: `0x${string}`;
  data: `0x${string}`;
  valueWei?: string;
  chain?: string;
  tokenSymbol?: string;
};

export type DecodedTransaction = {
  kind: "erc20-approve" | "erc20-transfer" | "erc20-transfer-from" | "unknown";
  functionName: string;
  contractAddress?: `0x${string}`;
  spender?: `0x${string}`;
  recipient?: `0x${string}`;
  owner?: `0x${string}`;
  amountRaw?: string;
  isUnlimitedApproval: boolean;
  riskNotes: string[];
};

export const AgentWalletPolicySchema = z
  .object({
    maxSlippagePercent: z.number().min(0).max(100),
    maxTransactionUsd: z.number().min(0),
    allowedTokens: z.array(z.string().trim().min(1)).max(30),
    allowedProtocols: z.array(z.string().trim().min(1)).max(30),
    allowBridges: z.boolean(),
    allowUnlimitedApprovals: z.boolean(),
    minLiquidityUsd: z.number().min(0),
    minPoolAgeDays: z.number().min(0),
    requireVerifiedContracts: z.boolean(),
    riskBlockThreshold: z.number().min(0).max(100),
    riskWarnThreshold: z.number().min(0).max(100)
  })
  .strict() satisfies z.ZodType<AgentWalletPolicy>;

export const DEFAULT_AGENT_WALLET_POLICY: AgentWalletPolicy = {
  maxSlippagePercent: 1,
  maxTransactionUsd: 5000,
  allowedTokens: ["ETH", "WETH", "USDC", "USDT", "DAI", "WBTC"],
  allowedProtocols: ["0x", "Uniswap", "Base", "SentinelMesh"],
  allowBridges: false,
  allowUnlimitedApprovals: false,
  minLiquidityUsd: 100_000,
  minPoolAgeDays: 30,
  requireVerifiedContracts: true,
  riskBlockThreshold: 85,
  riskWarnThreshold: 55
};

export const FirewallEvaluateRequestSchema = z
  .object({
    intent: DeFiIntentSchema,
    analysis: RiskAnalysisSchema.optional(),
    quote: z.unknown().optional(),
    rawTransaction: z
      .object({
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid transaction target").optional(),
        data: z.string().regex(/^0x[a-fA-F0-9]*$/, "Invalid calldata"),
        valueWei: z.string().regex(/^\d+$/, "Invalid transaction value").optional(),
        chain: z.string().trim().min(1).max(80).optional(),
        tokenSymbol: z.string().trim().min(1).max(20).optional()
      })
      .strict()
      .optional(),
    policy: AgentWalletPolicySchema.optional()
  })
  .strict();

export const RawTransactionDecodeRequestSchema = z
  .object({
    transaction: z
      .object({
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid transaction target").optional(),
        data: z.string().regex(/^0x[a-fA-F0-9]*$/, "Invalid calldata"),
        valueWei: z.string().regex(/^\d+$/, "Invalid transaction value").optional(),
        chain: z.string().trim().min(1).max(80).optional(),
        tokenSymbol: z.string().trim().min(1).max(20).optional()
      })
      .strict()
  })
  .strict();

export type OrchestrationStepStatus = "queued" | "running" | "completed" | "warning" | "blocked" | "failed";

export type OrchestrationStep = {
  id: string;
  label: string;
  agentName: string;
  status: OrchestrationStepStatus;
  dependencies: string[];
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  summary: string;
};

export type OrchestrationGate = {
  id: string;
  label: string;
  status: "pass" | "warn" | "block";
  reason: string;
};

export type OrchestrationRun = {
  runId: string;
  status: "completed" | "needs-review" | "blocked" | "failed";
  mode: "simulation";
  prompt: string;
  parsedIntent: DeFiIntent;
  riskAnalysis: RiskAnalysis;
  routeAnalysis: RouteAnalysis;
  quotePreview: QuotePreview;
  firewallEvaluation: FirewallEvaluation;
  selectedRouteId?: string;
  agentTrace: AgentResult[];
  steps: OrchestrationStep[];
  gates: OrchestrationGate[];
  nextActions: string[];
  summary: string;
  startedAt: string;
  completedAt: string;
};

export const OrchestrationRunRequestSchema = z
  .object({
    prompt: IntentPromptSchema.shape.prompt,
    policy: AgentWalletPolicySchema.optional(),
    rawTransaction: z
      .object({
        to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid transaction target").optional(),
        data: z.string().regex(/^0x[a-fA-F0-9]*$/, "Invalid calldata"),
        valueWei: z.string().regex(/^\d+$/, "Invalid transaction value").optional(),
        chain: z.string().trim().min(1).max(80).optional(),
        tokenSymbol: z.string().trim().min(1).max(20).optional()
      })
      .strict()
      .optional()
  })
  .strict();

export const ReportCreateRequestSchema = z
  .object({
    prompt: IntentPromptSchema.shape.prompt,
    parsedIntent: DeFiIntentSchema,
    selectedRouteId: z.string().trim().min(1).max(120),
    userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address").optional(),
    policy: AgentWalletPolicySchema.optional()
  })
  .strict();

export type ExecutionMode = "Simulation Only" | "Report On-chain";

export type SentinelReport = {
  id: string;
  userAddress?: string;
  originalPrompt: string;
  parsedIntent: DeFiIntent;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactors;
  riskFactorExplanations: RiskFactorExplanation[];
  marketEvidence?: MarketEvidence;
  evidenceReceipt?: EvidenceReceipt;
  firewallEvaluation?: FirewallEvaluation;
  recommendedRoute: RouteRecommendation;
  agentTrace: AgentResult[];
  modelVersion: string;
  reportHash: `0x${string}`;
  reportURI: string;
  chainTxHash?: `0x${string}`;
  verificationStatus: "pending" | "verified" | "mismatch" | "local-only";
  createdAt: string;
};

export type FixtureScenario = {
  id: string;
  label: string;
  prompt: string;
  parsedIntent: DeFiIntent;
  riskFactors: RiskFactors;
  notes: string[];
};

export const MODEL_VERSION = "sentinelmesh-risk-v0.1";

export const RISK_FACTOR_LABELS: Record<keyof RiskFactors, string> = {
  slippageRisk: "Slippage Risk",
  liquidityRisk: "Liquidity Risk",
  priceImpactRisk: "Price Impact Risk",
  gasRisk: "Gas Risk",
  tokenRisk: "Token Risk",
  routeComplexityRisk: "Route Complexity Risk",
  mevExposureRisk: "MEV Exposure Risk"
};
