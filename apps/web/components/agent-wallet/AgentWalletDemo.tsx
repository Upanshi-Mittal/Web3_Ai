"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Bot,
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  Gauge,
  Monitor,
  Loader2,
  LockKeyhole,
  PauseCircle,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEFAULT_AGENT_WALLET_POLICY,
  type AgentWalletPolicy,
  type DeFiIntent,
  type FirewallEvaluation,
  type RiskAnalysis,
  type RouteAnalysis,
  type SentinelReport
} from "@sentinelmesh/shared";
import { api } from "@/lib/api";
import { cn, riskColor, shortHash } from "@/lib/format";
import { ExplainableFirewall, RecoveryActions } from "@/components/firewall/FirewallGuidance";
import { ProtocolTrustGraph } from "@/components/firewall/ProtocolTrustGraph";

type AgentScenario = {
  id: string;
  label: string;
  agentThought: string;
  prompt: string;
  intent: DeFiIntent;
  before: Array<{ label: string; value: string; tone?: "good" | "bad" | "warn" }>;
  after: Array<{ label: string; value: string; tone?: "good" | "bad" | "warn" }>;
};

const scenarios: AgentScenario[] = [
  {
    id: "safe-rebalance",
    label: "Safe rebalance",
    agentThought: "Rebalance idle funds into ETH using a small, bounded trade.",
    prompt: "Swap 50 USDC to ETH with max 1% slippage.",
    intent: {
      action: "swap",
      tokenIn: "USDC",
      tokenOut: "ETH",
      amount: "50",
      chain: "base",
      priority: "safety",
      constraints: { maxSlippage: "1%", riskTolerance: "low" }
    },
    before: [
      { label: "USDC balance", value: "50.00 USDC" },
      { label: "ETH balance", value: "0.000 ETH" },
      { label: "Agent status", value: "Active" }
    ],
    after: [
      { label: "Expected receive", value: "~0.014 ETH", tone: "good" },
      { label: "Approval", value: "Exact or reviewed", tone: "warn" },
      { label: "Policy action", value: "Allow / review", tone: "good" }
    ]
  },
  {
    id: "risky-yield",
    label: "Suspicious yield",
    agentThought: "A high-APY pool claims boosted rewards. Try bridging capital and approving USDC.",
    prompt: "Bridge 5000 USDC to a new high-yield protocol on an unknown chain.",
    intent: {
      action: "bridge",
      tokenIn: "USDC",
      amount: "5000",
      chain: "unknown high-yield chain",
      priority: "yield",
      constraints: { maxSlippage: "5%", riskTolerance: "high" }
    },
    before: [
      { label: "USDC balance", value: "5,000 USDC" },
      { label: "Destination", value: "Unknown chain" },
      { label: "Agent status", value: "Active" }
    ],
    after: [
      { label: "Expected receive", value: "Unverified yield token", tone: "bad" },
      { label: "Approval", value: "Unknown spender risk", tone: "bad" },
      { label: "Policy action", value: "Block + pause agent", tone: "bad" }
    ]
  }
];

const agentPolicy: AgentWalletPolicy = {
  ...DEFAULT_AGENT_WALLET_POLICY,
  maxSlippagePercent: 1,
  maxTransactionUsd: 250,
  allowBridges: false,
  allowUnlimitedApprovals: false,
  riskWarnThreshold: 50,
  riskBlockThreshold: 80
};

export function AgentWalletDemo() {
  const [selectedId, setSelectedId] = useState(scenarios[0].id);
  const [risk, setRisk] = useState<RiskAnalysis | null>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis | null>(null);
  const [evaluation, setEvaluation] = useState<FirewallEvaluation | null>(null);
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedScenario = useMemo(() => scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0], [selectedId]);

  async function runScenario(scenario = selectedScenario) {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const riskResult = await api.analyzeRisk(scenario.intent);
      const routes = await api.analyzeRoutes(scenario.intent, riskResult.analysis);
      const firewall = await api.evaluateFirewall(scenario.intent, riskResult.analysis, agentPolicy);
      setRisk(firewall.analysis);
      setRouteAnalysis(routes.recommendation);
      setEvaluation(firewall.evaluation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent guardrail simulation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveAttestation() {
    if (!routeAnalysis || !evaluation) return;
    setSaving(true);
    setError(null);
    try {
      const selectedRouteId = routeAnalysis.selectedRouteId ?? routeAnalysis.recommendedRouteId ?? routeAnalysis.routes[0]?.routeId;
      if (!selectedRouteId) throw new Error("No route is available for attestation.");
      const created = await api.createReport({
        prompt: selectedScenario.prompt,
        parsedIntent: selectedScenario.intent,
        selectedRouteId,
        policy: agentPolicy
      });
      setReport(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent attestation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="sentinel-dark-page px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface rounded-lg p-6">
          <div className="eyebrow flex items-center gap-2"><Bot size={14} /> Agent wallet guardrails</div>
          <h1 className="mt-3 text-3xl font-semibold text-ink">AI agent kill switch</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Demo how SentinelMesh checks an autonomous DeFi agent before signing: risk score, policy rules, scam patterns, wallet health, and a pause decision.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => {
                  setSelectedId(scenario.id);
                  setRisk(null);
                  setRouteAnalysis(null);
                  setEvaluation(null);
                  setReport(null);
                  setError(null);
                }}
                className={cn(
                  "rounded-lg border p-4 text-left transition hover:border-teal/50",
                  selectedId === scenario.id ? "border-teal bg-emerald-50" : "border-border bg-white"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">{scenario.label}</span>
                  {scenario.id === "risky-yield" ? <ShieldAlert className="text-danger" size={18} /> : <ShieldCheck className="text-success" size={18} />}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">{scenario.agentThought}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-border bg-panel2 p-4">
            <div className="flex items-start gap-3">
              <BrainCircuit className="mt-0.5 text-violet" size={20} />
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Agent proposed action</div>
                <p className="mt-2 text-sm font-semibold text-ink">{selectedScenario.prompt}</p>
                <p className="mt-2 text-xs leading-5 text-muted">{selectedScenario.agentThought}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => runScenario()}
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={17} /> : <Play size={17} />}
            Run agent through SentinelMesh
          </button>
          {error && <div className="mt-4 rounded-md border border-danger/20 bg-red-50 p-3 text-sm text-danger">{error}</div>}
        </div>

        <div className="grid gap-5">
          <AgentStatusCard evaluation={evaluation} risk={risk} loading={loading} />
          <WalletHealthCard evaluation={evaluation} />
          <AgentReputationCard evaluation={evaluation} />
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <TimeMachine scenario={selectedScenario} evaluation={evaluation} />
        <PolicyCard />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <ScamPatternCard evaluation={evaluation} />
        <AttestationCard
          evaluation={evaluation}
          routeAnalysis={routeAnalysis}
          report={report}
          saving={saving}
          onSave={saveAttestation}
        />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <ProtocolTrustGraph evaluation={evaluation} />
        {evaluation ? (
          <>
            <BrowserExtensionMock evaluation={evaluation} />
            <ExplainableFirewall evaluation={evaluation} />
            <RecoveryActions evaluation={evaluation} />
          </>
        ) : (
          <div className="surface rounded-lg p-5">
            <div className="eyebrow">Live after evaluation</div>
            <h2 className="mt-1 font-semibold text-ink">Signing guard preview</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Run the safe or suspicious scenario to fill this area with the decoded transaction, firewall explanation,
              recovery actions, and browser-extension signing warning.
            </p>
          </div>
        )}
      </section>
      </div>
    </main>
  );
}

function AgentStatusCard({ evaluation, risk, loading }: { evaluation: FirewallEvaluation | null; risk: RiskAnalysis | null; loading: boolean }) {
  const blocked = evaluation?.guardrailState.killSwitchTriggered;
  return (
    <div className="surface rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2"><PauseCircle size={14} /> Guardrail decision</div>
          <h2 className="mt-1 font-semibold text-ink">Agent status</h2>
        </div>
        <span className={cn("rounded-md px-2 py-1 text-xs font-bold", !evaluation ? "bg-panel2 text-muted" : blocked ? "bg-red-50 text-danger" : evaluation.decision === "WARN" ? "bg-amber-50 text-warning" : "bg-emerald-50 text-success")}>
          {loading ? "RUNNING" : !evaluation ? "WAITING" : blocked ? "PAUSED" : evaluation.decision}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Risk" value={risk ? `${risk.riskScore}/100` : "-"} className={risk ? riskColor(risk.riskLevel) : ""} />
        <Metric label="Decision" value={evaluation?.decision ?? "-"} />
        <Metric label="Human approval" value={evaluation?.guardrailState.humanApprovalRequired ? "Required" : evaluation ? "Not required" : "-"} />
      </div>
      <p className="mt-4 rounded-md border border-border bg-panel2 p-3 text-sm leading-6 text-muted">
        {evaluation?.guardrailState.reason ?? "Run a scenario to see whether the agent can continue, requires approval, or is paused."}
      </p>
    </div>
  );
}

function WalletHealthCard({ evaluation }: { evaluation: FirewallEvaluation | null }) {
  const health = evaluation?.walletHealth;
  return (
    <div className="surface rounded-lg p-5">
      <div className="eyebrow flex items-center gap-2"><Gauge size={14} /> Wallet health score</div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-5xl font-semibold text-ink">{health?.score ?? "--"}</div>
          <div className="mt-1 text-sm font-semibold text-muted">{health?.level ?? "Not scanned"}</div>
        </div>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-panel2">
          <div className={cn("h-full rounded-full", healthTone(health?.level))} style={{ width: `${health?.score ?? 0}%` }} />
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {(health?.signals ?? []).map((signal) => (
          <div key={signal.label} className="rounded-md border border-border bg-panel2 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              {signal.impact === "positive" ? <CheckCircle2 className="text-success" size={16} /> : signal.impact === "negative" ? <AlertTriangle className="text-danger" size={16} /> : <Sparkles className="text-warning" size={16} />}
              {signal.label}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">{signal.detail}</p>
          </div>
        ))}
        {!health && <p className="rounded-md border border-dashed border-border bg-white/60 p-3 text-sm text-muted">Awaiting agent transaction scan.</p>}
      </div>
    </div>
  );
}

function AgentReputationCard({ evaluation }: { evaluation: FirewallEvaluation | null }) {
  const score = evaluation ? Math.max(0, Math.min(100, evaluation.walletHealth.score + (evaluation.guardrailState.killSwitchTriggered ? -8 : 6))) : undefined;
  const blocked = evaluation?.guardrailState.killSwitchTriggered ? 1 : 0;
  const reviewed = evaluation?.guardrailState.humanApprovalRequired ? 1 : 0;
  return (
    <div className="surface rounded-lg p-5">
      <div className="eyebrow flex items-center gap-2"><Bot size={14} /> Agent reputation</div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <div className="text-4xl font-semibold text-ink">{score ?? "--"}</div>
          <div className="mt-1 text-sm font-semibold text-muted">Reliability score</div>
        </div>
        <span className={cn("rounded-md px-2 py-1 text-xs font-bold", score === undefined ? "bg-panel2 text-muted" : score >= 80 ? "bg-emerald-50 text-success" : score >= 55 ? "bg-amber-50 text-warning" : "bg-red-50 text-danger")}>
          {score === undefined ? "WAITING" : score >= 80 ? "TRUSTED" : score >= 55 ? "REVIEW" : "RESTRICTED"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Safe actions" value={evaluation && !blocked ? "1" : "0"} />
        <Metric label="Blocked" value={String(blocked)} />
        <Metric label="Human review" value={String(reviewed)} />
      </div>
    </div>
  );
}

function TimeMachine({ scenario, evaluation }: { scenario: AgentScenario; evaluation: FirewallEvaluation | null }) {
  return (
    <div className="surface rounded-lg p-5">
      <div className="eyebrow">Transaction time machine</div>
      <h2 className="mt-1 font-semibold text-ink">Before and after signing</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StateColumn title="Before" items={scenario.before} />
        <StateColumn title="Projected after" items={scenario.after} />
      </div>
      {evaluation && (
        <div className="mt-4 rounded-md border border-border bg-panel2 p-3">
          <div className="text-xs font-semibold text-ink">Decoded by SentinelMesh</div>
          <p className="mt-1 text-sm leading-6 text-muted">{evaluation.transactionPreview.decodedAction}</p>
        </div>
      )}
    </div>
  );
}

function PolicyCard() {
  return (
    <div className="surface rounded-lg p-5">
      <div className="eyebrow flex items-center gap-2"><LockKeyhole size={14} /> Agent spending limits</div>
      <h2 className="mt-1 font-semibold text-ink">Active policy</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <PolicyItem label="Max spend" value={`$${agentPolicy.maxTransactionUsd}`} />
        <PolicyItem label="Max slippage" value={`${agentPolicy.maxSlippagePercent}%`} />
        <PolicyItem label="Bridges" value={agentPolicy.allowBridges ? "Allowed" : "Blocked"} />
        <PolicyItem label="Unlimited approvals" value={agentPolicy.allowUnlimitedApprovals ? "Allowed" : "Blocked"} />
        <PolicyItem label="Allowed tokens" value={agentPolicy.allowedTokens.slice(0, 5).join(", ")} />
        <PolicyItem label="Human review" value={`Risk >= ${agentPolicy.riskWarnThreshold}`} />
      </div>
    </div>
  );
}

function ScamPatternCard({ evaluation }: { evaluation: FirewallEvaluation | null }) {
  return (
    <div className="surface rounded-lg p-5">
      <div className="eyebrow flex items-center gap-2 text-violet"><ShieldAlert size={14} /> Scam pattern matching</div>
      <h2 className="mt-1 font-semibold text-ink">Matched patterns</h2>
      <div className="mt-4 space-y-3">
        {evaluation?.scamPatterns.length ? (
          evaluation.scamPatterns.map((pattern) => (
            <div key={pattern.patternId} className="rounded-md border border-border bg-panel2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">{pattern.title}</h3>
                <span className={cn("rounded px-2 py-1 text-[10px] font-bold uppercase", pattern.severity === "critical" ? "bg-red-50 text-danger" : "bg-amber-50 text-warning")}>
                  {pattern.severity}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-xs leading-5 text-muted">
                {pattern.evidence.map((line) => <li key={line}>{line}</li>)}
              </ul>
              <p className="mt-3 rounded-md bg-white p-3 text-xs leading-5 text-muted">{pattern.recommendation}</p>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border bg-white/60 p-4 text-sm leading-6 text-muted">
            {evaluation ? "No known v0 scam pattern matched this action." : "Run a scenario to scan for approval drains, suspicious bridges, unknown tokens, thin liquidity, and high slippage."}
          </div>
        )}
      </div>
    </div>
  );
}

function AttestationCard({
  evaluation,
  routeAnalysis,
  report,
  saving,
  onSave
}: {
  evaluation: FirewallEvaluation | null;
  routeAnalysis: RouteAnalysis | null;
  report: SentinelReport | null;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="surface rounded-lg p-5">
      <div className="eyebrow flex items-center gap-2"><FileCheck2 size={14} /> Risk attestation</div>
      <h2 className="mt-1 font-semibold text-ink">Save the safety trail</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Create a local report whose hash commits to the risk score, route, firewall decision, scam patterns, and evidence receipt.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Evidence hash" value={shortHash(evaluation?.transactionPreview.evidence.evidenceHash)} />
        <Metric label="Route set" value={routeAnalysis ? `${routeAnalysis.routes.length} routes` : "-"} />
        <Metric label="Decision" value={evaluation?.decision ?? "-"} />
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={!evaluation || !routeAnalysis || saving}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? <Loader2 className="animate-spin" size={17} /> : <BadgeCheck size={17} />}
        Save agent risk attestation
      </button>
      {report && (
        <div className="mt-4 rounded-md border border-success/20 bg-emerald-50 p-4">
          <div className="text-sm font-semibold text-success">Attestation saved</div>
          <p className="mt-1 text-xs leading-5 text-muted">Report hash {shortHash(report.reportHash)} is ready for local review or testnet anchoring.</p>
          <Link href={`/reports/${report.id}`} className="mt-3 inline-flex text-sm font-semibold text-teal underline">
            Open report
          </Link>
        </div>
      )}
    </div>
  );
}

function BrowserExtensionMock({ evaluation }: { evaluation: FirewallEvaluation }) {
  const blocked = evaluation.decision === "BLOCK";
  return (
    <div className="rounded-lg border border-border bg-ink p-5 text-white shadow-glow">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Monitor size={16} className="text-emerald-200" />
          SentinelMesh signing guard
        </div>
        <span className={cn("rounded px-2 py-1 text-[10px] font-bold", blocked ? "bg-red-400/20 text-red-100" : evaluation.decision === "WARN" ? "bg-amber-300/20 text-amber-100" : "bg-emerald-300/20 text-emerald-100")}>
          {evaluation.decision}
        </span>
      </div>
      <div className="mt-4 rounded-md bg-white/8 p-4">
        <div className="text-xs text-emerald-100">Wallet is about to sign</div>
        <p className="mt-2 text-sm font-semibold leading-6">{evaluation.transactionPreview.decodedAction}</p>
        <p className="mt-2 text-xs leading-5 text-emerald-50/80">{evaluation.guardrailState.reason}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className={cn("rounded-md px-3 py-2 text-sm font-semibold", blocked ? "bg-red-400 text-ink" : "bg-white/10 text-white")}>
          Block
        </button>
        <button type="button" className="rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-white/80">
          Continue anyway
        </button>
      </div>
    </div>
  );
}

function StateColumn({ title, items }: { title: string; items: AgentScenario["before"] | AgentScenario["after"] }) {
  return (
    <div className="rounded-md border border-border bg-panel2 p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded bg-white px-3 py-2 text-sm">
            <span className="text-muted">{item.label}</span>
            <span className={cn("text-right font-semibold text-ink", item.tone === "good" && "text-success", item.tone === "bad" && "text-danger", item.tone === "warn" && "text-warning")}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PolicyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-panel2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value?: string; className?: string }) {
  return (
    <div className={cn("rounded-md border border-border bg-panel2 p-3", className)}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value || "-"}</div>
    </div>
  );
}

function healthTone(level?: FirewallEvaluation["walletHealth"]["level"]) {
  if (level === "Healthy") return "bg-success";
  if (level === "Watch") return "bg-warning";
  if (level === "At Risk") return "bg-orange-500";
  if (level === "Critical") return "bg-danger";
  return "bg-border";
}
