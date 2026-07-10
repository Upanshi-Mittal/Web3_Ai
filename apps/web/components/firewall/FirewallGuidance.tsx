"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import type { FirewallEvaluation } from "@sentinelmesh/shared";
import { cn, shortHash } from "@/lib/format";

export function ExplainableFirewall({ evaluation }: { evaluation: FirewallEvaluation }) {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const decoded = evaluation.transactionPreview.decodedTransaction;
  return (
    <div className="rounded-md border border-border bg-panel2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Explain mode</div>
          <h3 className="mt-1 text-sm font-semibold text-ink">{mode === "simple" ? "Plain English" : "Advanced details"}</h3>
        </div>
        <div className="grid grid-cols-2 rounded-md border border-border bg-white p-0.5 text-xs font-semibold">
          {(["simple", "advanced"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={cn("rounded px-2 py-1 capitalize", mode === item ? "bg-ink text-white" : "text-muted")}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {mode === "simple" ? (
        <div className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-muted">
          {simpleExplanation(evaluation)}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 text-xs">
          <Detail label="Function" value={decoded?.functionName ?? "Intent-based route"} />
          <Detail label="Approval" value={evaluation.transactionPreview.approvalType} />
          <Detail label="Spender" value={shortHash(decoded?.spender)} />
          <Detail label="Risk decision" value={evaluation.decision} />
          <Detail label="Evidence hash" value={shortHash(evaluation.transactionPreview.evidence.evidenceHash)} />
        </div>
      )}
    </div>
  );
}

export function RecoveryActions({ evaluation }: { evaluation: FirewallEvaluation }) {
  const actions = recoveryActions(evaluation);
  return (
    <div className="rounded-md border border-border bg-panel2 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <RotateCcw size={16} className="text-teal" />
        Recommended recovery
      </div>
      <div className="mt-3 grid gap-2">
        {actions.map((action, index) => (
          <div key={action} className="flex gap-3 rounded-md bg-white p-3 text-xs leading-5 text-muted">
            <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", evaluation.decision === "BLOCK" ? "bg-red-50 text-danger" : "bg-emerald-50 text-success")}>
              {index + 1}
            </span>
            {action}
          </div>
        ))}
      </div>
    </div>
  );
}

function simpleExplanation(evaluation: FirewallEvaluation) {
  if (evaluation.transactionPreview.approvalType === "unlimited") {
    return "This transaction gives another address unlimited permission to spend your token. If that spender is malicious or compromised, funds can be drained later without another approval.";
  }
  if (evaluation.decision === "BLOCK") {
    return `SentinelMesh blocked this action because it violates policy before signing. ${evaluation.guardrailState.reason}`;
  }
  if (evaluation.decision === "WARN") {
    return "This action is not automatically blocked, but it has enough uncertainty that a human should review it before any wallet signature.";
  }
  return "This action is within the active policy limits. SentinelMesh still records the evidence trail so the decision can be reviewed later.";
}

function recoveryActions(evaluation: FirewallEvaluation) {
  if (evaluation.transactionPreview.approvalType === "unlimited") {
    return [
      "Do not sign the unlimited approval transaction.",
      "Use exact-amount approval or revoke existing allowances before retrying.",
      "Verify the spender contract and protocol route before allowing the agent to continue.",
      "Save a risk attestation so the blocked attempt is auditable."
    ];
  }
  if (evaluation.decision === "BLOCK") {
    return [
      "Do not sign this transaction in the current state.",
      "Lower slippage, reduce transaction size, or switch to an allowlisted token/protocol.",
      "Require human approval before the AI agent can retry.",
      "Generate a report to preserve the blocked decision and evidence hash."
    ];
  }
  if (evaluation.decision === "WARN") {
    return [
      "Review policy warnings before signing.",
      "Prefer a protected or report-only route if liquidity or approval scope is uncertain.",
      "Save a report before proceeding with any wallet action."
    ];
  }
  return [
    "Proceed only after confirming the wallet prompt matches the decoded action.",
    "Save the risk report for the audit trail.",
    "Use the same policy before any autonomous agent retry."
  ];
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="break-all text-right font-semibold text-ink">{value}</span>
    </div>
  );
}
