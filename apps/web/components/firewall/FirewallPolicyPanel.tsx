"use client";

import { AlertTriangle, CheckCircle2, LockKeyhole, ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { DEFAULT_AGENT_WALLET_POLICY, type AgentWalletPolicy, type FirewallEvaluation, type RawTransactionInput } from "@sentinelmesh/shared";
import { cn } from "@/lib/format";
import { ExplainableFirewall, RecoveryActions } from "./FirewallGuidance";
import { ProtocolTrustGraph } from "./ProtocolTrustGraph";

export function FirewallPolicyPanel({
  policy,
  evaluation,
  loading,
  error,
  rawTransaction,
  onPolicyChange,
  onRawTransactionChange,
  onEvaluate
}: {
  policy: AgentWalletPolicy;
  evaluation: FirewallEvaluation | null;
  loading: boolean;
  error: string | null;
  rawTransaction: RawTransactionInput | null;
  onPolicyChange: (policy: AgentWalletPolicy) => void;
  onRawTransactionChange: (transaction: RawTransactionInput | null) => void;
  onEvaluate: () => void;
}) {
  const decision = evaluation?.decision;
  return (
    <div className="surface rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow flex items-center gap-2"><LockKeyhole size={14} /> Transaction firewall</div>
          <h2 className="mt-1 font-semibold text-ink">Agent wallet policy</h2>
          <p className="mt-2 text-xs leading-5 text-muted">
            SentinelMesh checks this policy before a user or autonomous agent should sign.
          </p>
        </div>
        <DecisionBadge decision={decision} loading={loading} />
      </div>

      <div className="mt-4 grid gap-3">
        <PolicySlider
          label="Max slippage"
          value={policy.maxSlippagePercent}
          suffix="%"
          min={0.1}
          max={10}
          step={0.1}
          onChange={(value) => onPolicyChange({ ...policy, maxSlippagePercent: value })}
        />
        <PolicySlider
          label="Max transaction"
          value={policy.maxTransactionUsd}
          prefix="$"
          min={100}
          max={100000}
          step={100}
          onChange={(value) => onPolicyChange({ ...policy, maxTransactionUsd: value })}
        />
        <PolicySlider
          label="Min liquidity"
          value={policy.minLiquidityUsd}
          prefix="$"
          min={0}
          max={1000000}
          step={10000}
          onChange={(value) => onPolicyChange({ ...policy, minLiquidityUsd: value })}
        />
      </div>

      <div className="mt-4 grid gap-2 text-xs">
        <label className="flex items-center justify-between rounded-md border border-border bg-panel2 px-3 py-2">
          <span className="font-medium text-ink">Allow bridge actions</span>
          <input
            type="checkbox"
            checked={policy.allowBridges}
            onChange={(event) => onPolicyChange({ ...policy, allowBridges: event.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between rounded-md border border-border bg-panel2 px-3 py-2">
          <span className="font-medium text-ink">Allow unlimited approvals</span>
          <input
            type="checkbox"
            checked={policy.allowUnlimitedApprovals}
            onChange={(event) => onPolicyChange({ ...policy, allowUnlimitedApprovals: event.target.checked })}
          />
        </label>
      </div>

      <div className="mt-4 rounded-md border border-border bg-panel2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-ink">Raw transaction decoder</div>
            <p className="mt-1 text-xs leading-5 text-muted">Optional: paste calldata to detect approvals before wallet signing.</p>
          </div>
          <button
            type="button"
            onClick={() => onRawTransactionChange(sampleUnlimitedApproval())}
            className="shrink-0 rounded border border-teal/30 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-teal"
          >
            Sample approval
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-md border border-border bg-white px-3 py-2 text-xs text-ink outline-none focus:border-teal"
            placeholder="Token contract address"
            value={rawTransaction?.to ?? ""}
            onChange={(event) => onRawTransactionChange({ ...(rawTransaction ?? { data: "0x" }), to: event.target.value as `0x${string}` })}
          />
          <input
            className="rounded-md border border-border bg-white px-3 py-2 text-xs text-ink outline-none focus:border-teal"
            placeholder="Token symbol, e.g. USDC"
            value={rawTransaction?.tokenSymbol ?? ""}
            onChange={(event) => onRawTransactionChange({ ...(rawTransaction ?? { data: "0x" }), tokenSymbol: event.target.value })}
          />
        </div>
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs text-ink outline-none focus:border-teal"
          placeholder="0x calldata"
          value={rawTransaction?.data ?? ""}
          onChange={(event) => onRawTransactionChange(event.target.value ? { ...(rawTransaction ?? {}), data: event.target.value as `0x${string}` } : null)}
        />
        {rawTransaction?.data && (
          <button
            type="button"
            onClick={() => onRawTransactionChange(null)}
            className="mt-2 text-xs font-semibold text-muted underline"
          >
            Clear raw transaction
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onEvaluate}
        disabled={loading}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SlidersHorizontal size={16} />
        {loading ? "Checking policy..." : "Run firewall check"}
      </button>

      {error && (
        <div className="mt-3 rounded-md border border-danger/20 bg-red-50 p-3 text-xs leading-5 text-danger">
          {error}
        </div>
      )}

      {evaluation && <FirewallResult evaluation={evaluation} />}

      {!evaluation && !error && (
        <div className="mt-4 rounded-md border border-dashed border-border bg-white/60 p-3 text-xs leading-5 text-muted">
          Default policy blocks bridges, unknown tokens, unlimited approvals, high slippage, low liquidity, and risk scores above {DEFAULT_AGENT_WALLET_POLICY.riskBlockThreshold}.
        </div>
      )}
    </div>
  );
}

function FirewallResult({ evaluation }: { evaluation: FirewallEvaluation }) {
  return (
    <div className="mt-4 space-y-3">
      <div className={cn("rounded-md border p-3 text-xs leading-5", resultTone(evaluation.decision))}>
        <div className="flex items-center gap-2 font-semibold">
          {evaluation.decision === "ALLOW" ? <CheckCircle2 size={15} /> : evaluation.decision === "WARN" ? <AlertTriangle size={15} /> : <ShieldAlert size={15} />}
          {evaluation.summary}
        </div>
      </div>

      <div className="rounded-md border border-border bg-panel2 p-3">
        <div className="text-xs font-semibold text-ink">Decoded action</div>
        <p className="mt-1 text-xs leading-5 text-muted">{evaluation.transactionPreview.decodedAction}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted">
          <MiniMetric label="Approval" value={evaluation.transactionPreview.approvalType} />
          <MiniMetric label="Simulation" value={evaluation.transactionPreview.simulation.status} />
          <MiniMetric label="Liquidity" value={formatUsd(evaluation.transactionPreview.evidence.liquidityUsd)} />
          <MiniMetric label="Evidence hash" value={shortHash(evaluation.transactionPreview.evidence.evidenceHash)} />
        </div>
        {evaluation.transactionPreview.decodedTransaction && (
          <div className="mt-3 rounded-md border border-border bg-white p-3">
            <div className="text-xs font-semibold text-ink">
              {evaluation.transactionPreview.decodedTransaction.functionName}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              {evaluation.transactionPreview.decodedTransaction.riskNotes.join(" ")}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <MiniMetric label="Wallet health" value={`${evaluation.walletHealth.score}/100 ${evaluation.walletHealth.level}`} />
        <MiniMetric
          label="Agent guardrail"
          value={evaluation.guardrailState.killSwitchTriggered ? "Kill switch" : evaluation.guardrailState.humanApprovalRequired ? "Human review" : "Can continue"}
        />
      </div>

      {evaluation.violations.length > 0 && (
        <div className="space-y-2">
          {evaluation.violations.map((violation) => (
            <div key={violation.ruleId} className="rounded-md border border-border bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">{violation.title}</span>
                <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", violation.severity === "blocking" ? "bg-red-50 text-danger" : "bg-amber-50 text-warning")}>
                  {violation.severity}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">{violation.detail}</p>
            </div>
          ))}
        </div>
      )}

      {evaluation.scamPatterns.length > 0 && (
        <div className="space-y-2">
          {evaluation.scamPatterns.map((pattern) => (
            <div key={pattern.patternId} className="rounded-md border border-border bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">{pattern.title}</span>
                <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", pattern.severity === "critical" ? "bg-red-50 text-danger" : "bg-amber-50 text-warning")}>
                  {pattern.severity}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">{pattern.recommendation}</p>
            </div>
          ))}
        </div>
      )}

      <ProtocolTrustGraph evaluation={evaluation} />
      <ExplainableFirewall evaluation={evaluation} />
      <RecoveryActions evaluation={evaluation} />
    </div>
  );
}

function DecisionBadge({ decision, loading }: { decision?: FirewallEvaluation["decision"]; loading: boolean }) {
  if (loading) return <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-teal">CHECKING</span>;
  const copy = decision ?? "READY";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold", badgeTone(decision))}>
      {decision === "BLOCK" ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
      {copy}
    </span>
  );
}

function PolicySlider({
  label,
  value,
  prefix = "",
  suffix = "",
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-md border border-border bg-panel2 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-ink">{label}</span>
        <span className="text-muted">{prefix}{formatNumber(value)}{suffix}</span>
      </div>
      <input
        className="mt-2 w-full accent-teal"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-white px-2 py-1.5">
      <div>{label}</div>
      <div className="mt-0.5 truncate font-semibold text-ink">{value}</div>
    </div>
  );
}

function resultTone(decision: FirewallEvaluation["decision"]) {
  if (decision === "ALLOW") return "border-success/20 bg-emerald-50 text-success";
  if (decision === "WARN") return "border-warning/20 bg-amber-50 text-warning";
  return "border-danger/20 bg-red-50 text-danger";
}

function badgeTone(decision?: FirewallEvaluation["decision"]) {
  if (decision === "ALLOW") return "bg-emerald-50 text-success";
  if (decision === "WARN") return "bg-amber-50 text-warning";
  if (decision === "BLOCK") return "bg-red-50 text-danger";
  return "bg-panel2 text-muted";
}

function formatUsd(value?: number) {
  if (value === undefined) return "fallback";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function sampleUnlimitedApproval(): RawTransactionInput {
  return {
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenSymbol: "USDC",
    chain: "base",
    data:
      "0x095ea7b3000000000000000000000000000000000000000000000000000000000000deadffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  };
}
