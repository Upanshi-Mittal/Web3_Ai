import { createHash } from "node:crypto";
import {
  DEFAULT_AGENT_WALLET_POLICY,
  type AgentWalletPolicy,
  type AgentGuardrailState,
  type DecodedTransaction,
  type DeFiIntent,
  type EvidenceReceipt,
  type FirewallDecision,
  type FirewallEvaluation,
  type PolicyViolation,
  type QuotePreview,
  type RiskAnalysis,
  type ScamPatternMatch,
  type TransactionPreview,
  type WalletHealthScore
} from "@sentinelmesh/shared";
import { decodedAction as decodedTransactionAction } from "./transaction-decoder.js";

export function evaluateFirewall({
  intent,
  analysis,
  quote,
  decodedTransaction,
  policy = DEFAULT_AGENT_WALLET_POLICY
}: {
  intent: DeFiIntent;
  analysis: RiskAnalysis;
  quote?: QuotePreview;
  decodedTransaction?: DecodedTransaction;
  policy?: AgentWalletPolicy;
}): FirewallEvaluation {
  const normalizedPolicy = normalizePolicy(policy);
  const evidence = buildEvidenceReceipt(intent, analysis, quote, decodedTransaction);
  const violations = evaluatePolicyRules(intent, analysis, evidence, normalizedPolicy);
  const scamPatterns = detectScamPatterns(intent, analysis, evidence, violations);
  const decision = chooseDecision(analysis.riskScore, violations, normalizedPolicy);
  const guardrailState = buildGuardrailState(decision, scamPatterns, violations, analysis.riskScore);
  const walletHealth = scoreWalletHealth(analysis.riskScore, violations, scamPatterns);
  const transactionPreview: TransactionPreview = {
    decodedAction: decodedTransaction ? decodedTransactionAction(decodedTransaction, intent.tokenIn) : decodeAction(intent),
    chain: intent.chain ?? "ethereum",
    fromToken: intent.tokenIn,
    toToken: intent.tokenOut,
    amount: intent.amount,
    protocol: quote?.provider === "0x" ? "0x" : "SentinelMesh fixture route",
    approvalType: evidence.approvalType,
    simulation: quote?.simulation ?? { status: "not-configured" },
    evidence,
    decodedTransaction
  };

  return {
    decision,
    policy: normalizedPolicy,
    violations,
    scamPatterns,
    guardrailState,
    walletHealth,
    transactionPreview,
    summary: buildSummary(decision, analysis.riskScore, violations),
    evaluatedAt: new Date().toISOString()
  };
}

function evaluatePolicyRules(
  intent: DeFiIntent,
  analysis: RiskAnalysis,
  evidence: EvidenceReceipt,
  policy: AgentWalletPolicy
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const slippage = evidence.slippageEstimatePercent ?? parsePercent(intent.constraints.maxSlippage);
  const amountUsd = estimateUsdAmount(intent);
  const tokenSymbols = [intent.tokenIn, intent.tokenOut].filter((token): token is string => Boolean(token));

  if (intent.action === "bridge" && !policy.allowBridges) {
    violations.push({
      ruleId: "bridge-disabled",
      severity: "blocking",
      title: "Bridge action blocked",
      detail: "The active agent wallet policy does not allow bridge transactions."
    });
  }

  if (slippage !== undefined && slippage > policy.maxSlippagePercent) {
    violations.push({
      ruleId: "max-slippage",
      severity: slippage > policy.maxSlippagePercent * 2 ? "blocking" : "warning",
      title: "Slippage above policy",
      detail: `Estimated or requested slippage is ${formatPercent(slippage)}, above the ${formatPercent(policy.maxSlippagePercent)} policy limit.`
    });
  }

  if (amountUsd !== undefined && amountUsd > policy.maxTransactionUsd) {
    violations.push({
      ruleId: "max-transaction-size",
      severity: amountUsd > policy.maxTransactionUsd * 2 ? "blocking" : "warning",
      title: "Transaction size above policy",
      detail: `Estimated transaction size is ${formatUsd(amountUsd)}, above the ${formatUsd(policy.maxTransactionUsd)} policy limit.`
    });
  }

  for (const token of tokenSymbols) {
    if (!policy.allowedTokens.map(normalizeSymbol).includes(normalizeSymbol(token))) {
      violations.push({
        ruleId: "token-allowlist",
        severity: "blocking",
        title: "Token outside allowlist",
        detail: `${token.toUpperCase()} is not allowed by the active agent wallet policy.`
      });
    }
  }

  if (evidence.approvalType === "unlimited" && !policy.allowUnlimitedApprovals) {
    violations.push({
      ruleId: "unlimited-approval",
      severity: "blocking",
      title: "Unlimited approval blocked",
      detail: "The transaction appears to require an unlimited token approval, which the policy blocks."
    });
  }

  if (evidence.approvalType === "unknown" && !policy.allowUnlimitedApprovals) {
    violations.push({
      ruleId: "approval-unknown",
      severity: "warning",
      title: "Approval requirement unknown",
      detail: "The quote provider could not prove the approval is exact-amount only."
    });
  }

  if (evidence.liquidityUsd !== undefined && evidence.liquidityUsd < policy.minLiquidityUsd) {
    violations.push({
      ruleId: "min-liquidity",
      severity: evidence.liquidityUsd < policy.minLiquidityUsd / 2 ? "blocking" : "warning",
      title: "Liquidity below policy",
      detail: `Observed liquidity is ${formatUsd(evidence.liquidityUsd)}, below the ${formatUsd(policy.minLiquidityUsd)} policy floor.`
    });
  }

  if (evidence.poolAgeDays !== undefined && evidence.poolAgeDays < policy.minPoolAgeDays) {
    violations.push({
      ruleId: "pool-age",
      severity: evidence.poolAgeDays < 7 ? "blocking" : "warning",
      title: "Pool is too new",
      detail: `Observed pool age is ${Math.floor(evidence.poolAgeDays)} days, below the ${policy.minPoolAgeDays}-day policy floor.`
    });
  }

  if (analysis.riskScore >= policy.riskBlockThreshold) {
    violations.push({
      ruleId: "risk-block-threshold",
      severity: "blocking",
      title: "Risk score above block threshold",
      detail: `Server-computed risk score is ${analysis.riskScore}/100.`
    });
  } else if (analysis.riskScore >= policy.riskWarnThreshold) {
    violations.push({
      ruleId: "risk-warn-threshold",
      severity: "warning",
      title: "Risk score above warning threshold",
      detail: `Server-computed risk score is ${analysis.riskScore}/100.`
    });
  }

  return dedupeViolations(violations);
}

function buildEvidenceReceipt(
  intent: DeFiIntent,
  analysis: RiskAnalysis,
  quote?: QuotePreview,
  decodedTransaction?: DecodedTransaction
): EvidenceReceipt {
  const slippageEstimatePercent = parsePercent(intent.constraints.maxSlippage) ?? inferSlippageFromQuote(quote);
  const approvalType = inferApprovalType(intent, quote, decodedTransaction);
  const evidenceBase = {
    liquidityUsd: analysis.marketEvidence?.liquidityUsd,
    volume24hUsd: analysis.marketEvidence?.volume24hUsd,
    poolAgeDays: analysis.marketEvidence?.pairAgeDays,
    slippageEstimatePercent,
    priceImpactEstimatePercent: inferPriceImpact(analysis),
    approvalType,
    simulationStatus: quote?.simulation.status ?? "not-configured",
    simulationGasEstimate: quote?.simulation.gasEstimate,
    routeSources: quote?.routeSources ?? [],
    observedAt: new Date().toISOString(),
    notes: [
      ...(analysis.marketEvidence?.notes ?? []),
      ...(quote?.notes ?? []),
      "Evidence receipt is read-only and is not a guarantee of execution outcome."
    ]
  } satisfies Omit<EvidenceReceipt, "evidenceHash">;

  return {
    ...evidenceBase,
    evidenceHash: hashPayload(evidenceBase)
  };
}

function chooseDecision(score: number, violations: PolicyViolation[], policy: AgentWalletPolicy): FirewallDecision {
  if (violations.some((violation) => violation.severity === "blocking") || score >= policy.riskBlockThreshold) return "BLOCK";
  if (violations.length > 0 || score >= policy.riskWarnThreshold) return "WARN";
  return "ALLOW";
}

function detectScamPatterns(
  intent: DeFiIntent,
  analysis: RiskAnalysis,
  evidence: EvidenceReceipt,
  violations: PolicyViolation[]
): ScamPatternMatch[] {
  const matches: ScamPatternMatch[] = [];
  const hasViolation = (ruleId: string) => violations.some((violation) => violation.ruleId === ruleId);

  if (evidence.approvalType === "unlimited" || hasViolation("unlimited-approval")) {
    matches.push({
      patternId: "approval-drain",
      severity: "critical",
      title: "Approval drain pattern",
      evidence: ["Transaction requests broad token spend permission.", "Policy blocks unlimited approvals."],
      recommendation: "Block signing and generate a report. Revoke any existing unlimited allowance before retrying."
    });
  }

  if (evidence.approvalType === "unknown" && normalizeSymbol(intent.tokenIn) !== "ETH") {
    matches.push({
      patternId: "unknown-approval-scope",
      severity: "warning",
      title: "Unknown approval scope",
      evidence: ["Live quote evidence did not prove exact approval scope.", "ERC-20 sell token may require spender permission."],
      recommendation: "Require human review or a live quote that proves exact approval amount."
    });
  }

  if (intent.action === "bridge" && /yield|high|unknown|unfamiliar|new/i.test(`${intent.chain ?? ""} ${intent.tokenOut ?? ""}`)) {
    matches.push({
      patternId: "suspicious-bridge-yield",
      severity: "critical",
      title: "Suspicious bridge/yield pattern",
      evidence: ["Bridge action increases route complexity.", "Prompt or parsed fields imply unknown high-yield destination."],
      recommendation: "Block autonomous execution. Require manual treasury review and verified protocol metadata."
    });
  }

  if (hasViolation("token-allowlist") || analysis.riskFactors.tokenRisk >= 80) {
    matches.push({
      patternId: "unknown-token",
      severity: "critical",
      title: "Unknown or untrusted token",
      evidence: ["Token is outside the configured allowlist or scored high risk.", `Token risk factor is ${analysis.riskFactors.tokenRisk}/100.`],
      recommendation: "Do not sign until token contract, holder distribution, and liquidity source are verified."
    });
  }

  if (hasViolation("min-liquidity") || analysis.riskFactors.liquidityRisk >= 75) {
    matches.push({
      patternId: "thin-liquidity",
      severity: "warning",
      title: "Thin liquidity pattern",
      evidence: ["Liquidity signal is below policy floor or scored high risk.", `Liquidity risk factor is ${analysis.riskFactors.liquidityRisk}/100.`],
      recommendation: "Avoid market orders. Use smaller size, lower slippage, or a deeper route."
    });
  }

  if (hasViolation("max-slippage") || analysis.riskFactors.slippageRisk >= 75) {
    matches.push({
      patternId: "high-slippage-loss",
      severity: "warning",
      title: "High slippage loss pattern",
      evidence: ["Slippage is above policy or scored high risk.", `Slippage risk factor is ${analysis.riskFactors.slippageRisk}/100.`],
      recommendation: "Lower slippage tolerance before signing."
    });
  }

  return dedupeScamPatterns(matches);
}

function buildGuardrailState(
  decision: FirewallDecision,
  scamPatterns: ScamPatternMatch[],
  violations: PolicyViolation[],
  riskScore: number
): AgentGuardrailState {
  const criticalPattern = scamPatterns.find((pattern) => pattern.severity === "critical");
  if (decision === "BLOCK" || criticalPattern) {
    return {
      killSwitchTriggered: true,
      humanApprovalRequired: true,
      reason: criticalPattern
        ? `Agent paused: ${criticalPattern.title.toLowerCase()} detected.`
        : "Agent paused: blocking policy violation detected before signing."
    };
  }
  if (decision === "WARN" || riskScore >= 55 || violations.length > 0) {
    return {
      killSwitchTriggered: false,
      humanApprovalRequired: true,
      reason: "Human approval required before the agent can continue."
    };
  }
  return {
    killSwitchTriggered: false,
    humanApprovalRequired: false,
    reason: "Agent can continue under the current policy."
  };
}

function scoreWalletHealth(
  riskScore: number,
  violations: PolicyViolation[],
  scamPatterns: ScamPatternMatch[]
): WalletHealthScore {
  const blockingCount = violations.filter((violation) => violation.severity === "blocking").length;
  const warningCount = violations.filter((violation) => violation.severity === "warning").length;
  const criticalPatterns = scamPatterns.filter((pattern) => pattern.severity === "critical").length;
  const score = clampHealth(100 - riskScore * 0.55 - blockingCount * 18 - warningCount * 8 - criticalPatterns * 20);
  const level = score >= 80 ? "Healthy" : score >= 60 ? "Watch" : score >= 35 ? "At Risk" : "Critical";

  return {
    score,
    level,
    signals: [
      {
        label: "Policy violations",
        impact: violations.length === 0 ? "positive" : blockingCount > 0 ? "negative" : "neutral",
        detail: violations.length === 0 ? "No active policy violations." : `${blockingCount} blocking and ${warningCount} warning policy issues.`
      },
      {
        label: "Scam-pattern matches",
        impact: scamPatterns.length === 0 ? "positive" : criticalPatterns > 0 ? "negative" : "neutral",
        detail: scamPatterns.length === 0 ? "No known v0 scam pattern matched." : `${scamPatterns.length} pattern match${scamPatterns.length === 1 ? "" : "es"} detected.`
      },
      {
        label: "Risk engine score",
        impact: riskScore <= 30 ? "positive" : riskScore >= 70 ? "negative" : "neutral",
        detail: `Server-computed transaction risk is ${riskScore}/100.`
      }
    ]
  };
}

function normalizePolicy(policy: AgentWalletPolicy): AgentWalletPolicy {
  return {
    ...DEFAULT_AGENT_WALLET_POLICY,
    ...policy,
    riskWarnThreshold: Math.min(policy.riskWarnThreshold, policy.riskBlockThreshold)
  };
}

function decodeAction(intent: DeFiIntent) {
  if (intent.action === "swap") {
    return `Swap ${intent.amount ?? "an unknown amount of"} ${intent.tokenIn ?? "token"} to ${intent.tokenOut ?? "token"}`;
  }
  if (intent.action === "bridge") return `Bridge ${intent.amount ?? "funds"} ${intent.tokenIn ?? "token"} to another chain`;
  if (intent.action === "stake") return `Stake ${intent.amount ?? "funds"} ${intent.tokenIn ?? "token"}`;
  if (intent.action === "analyze") return "Analyze a DeFi position without execution";
  return "Unsupported transaction intent";
}

function inferApprovalType(intent: DeFiIntent, quote?: QuotePreview, decodedTransaction?: DecodedTransaction): EvidenceReceipt["approvalType"] {
  if (decodedTransaction?.kind === "erc20-approve") return decodedTransaction.isUnlimitedApproval ? "unlimited" : "exact";
  if (intent.action !== "swap" || normalizeSymbol(intent.tokenIn) === "ETH") return "none";
  if (!quote || quote.status !== "live") return "unknown";
  return quote.allowanceRequired ? "exact" : "none";
}

function inferSlippageFromQuote(quote?: QuotePreview) {
  if (!quote?.estimatedBuyAmount || !quote.minimumBuyAmount) return undefined;
  const estimate = Number(quote.estimatedBuyAmount);
  const minimum = Number(quote.minimumBuyAmount);
  if (!Number.isFinite(estimate) || !Number.isFinite(minimum) || estimate <= 0) return undefined;
  return Math.max(0, ((estimate - minimum) / estimate) * 100);
}

function inferPriceImpact(analysis: RiskAnalysis) {
  return Math.max(0.05, Math.round((analysis.riskFactors.priceImpactRisk / 100) * 500) / 100);
}

function estimateUsdAmount(intent: DeFiIntent) {
  const amount = Number.parseFloat(intent.amount ?? "");
  if (!Number.isFinite(amount)) return undefined;
  const token = normalizeSymbol(intent.tokenIn);
  const prices: Record<string, number> = {
    ETH: 3400,
    WETH: 3400,
    WBTC: 62000,
    USDC: 1,
    USDT: 1,
    DAI: 1
  };
  return prices[token] ? amount * prices[token] : undefined;
}

function parsePercent(value?: string) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeSymbol(value?: string) {
  return (value ?? "").trim().toUpperCase();
}

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function buildSummary(decision: FirewallDecision, score: number, violations: PolicyViolation[]) {
  if (decision === "ALLOW") return `ALLOW: risk score ${score}/100 and no active policy violations.`;
  const blocking = violations.filter((violation) => violation.severity === "blocking").length;
  const warning = violations.filter((violation) => violation.severity === "warning").length;
  if (decision === "BLOCK") return `BLOCK: ${blocking} blocking policy issue${blocking === 1 ? "" : "s"} detected before signing.`;
  return `WARN: ${warning || violations.length} policy warning${warning === 1 ? "" : "s"} should be reviewed before signing.`;
}

function dedupeViolations(violations: PolicyViolation[]) {
  const seen = new Set<string>();
  return violations.filter((violation) => {
    if (seen.has(violation.ruleId)) return false;
    seen.add(violation.ruleId);
    return true;
  });
}

function dedupeScamPatterns(patterns: ScamPatternMatch[]) {
  const seen = new Set<string>();
  return patterns.filter((pattern) => {
    if (seen.has(pattern.patternId)) return false;
    seen.add(pattern.patternId);
    return true;
  });
}

function clampHealth(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hashPayload(payload: unknown): `0x${string}` {
  return `0x${createHash("sha256").update(stableStringify(payload)).digest("hex")}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}
