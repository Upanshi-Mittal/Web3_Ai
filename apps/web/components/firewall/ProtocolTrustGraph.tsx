"use client";

import { ArrowRight, BadgeCheck, CircleHelp, ShieldAlert } from "lucide-react";
import type { FirewallEvaluation } from "@sentinelmesh/shared";
import { cn, shortHash } from "@/lib/format";

type GraphNode = {
  label: string;
  detail: string;
  tone: "safe" | "review" | "danger";
};

export function ProtocolTrustGraph({ evaluation }: { evaluation?: FirewallEvaluation | null }) {
  const nodes = evaluation ? buildGraphNodes(evaluation) : buildPreviewNodes();
  return (
    <div className="rounded-md border border-border bg-panel2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Protocol trust graph</div>
          <h3 className="mt-1 text-sm font-semibold text-ink">{evaluation ? "Signing path" : "Pre-signing preview"}</h3>
        </div>
        <span className={cn("rounded px-2 py-1 text-[10px] font-bold", evaluation ? decisionTone(evaluation.decision) : "bg-emerald-50 text-teal")}>
          {evaluation?.decision ?? "WAITING"}
        </span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {nodes.map((node, index) => (
          <div key={`${node.label}-${index}`} className="contents">
            <div className={cn("rounded-md border bg-white p-3", nodeTone(node.tone))}>
              <div className="flex items-center gap-2 text-xs font-semibold">
                {node.tone === "safe" ? <BadgeCheck size={14} /> : node.tone === "danger" ? <ShieldAlert size={14} /> : <CircleHelp size={14} />}
                {node.label}
              </div>
              <p className="mt-1 text-[11px] leading-4 text-muted">{node.detail}</p>
            </div>
            {index < nodes.length - 1 && (
              <div className="hidden items-center justify-center text-muted md:flex">
                <ArrowRight size={16} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPreviewNodes(): GraphNode[] {
  return [
    {
      label: "Wallet",
      detail: "Connect or simulate the signer before approval.",
      tone: "review"
    },
    {
      label: "Token",
      detail: "Decoded token approval or swap asset appears here.",
      tone: "review"
    },
    {
      label: "Protocol",
      detail: "Spender/router trust checks appear after evaluation.",
      tone: "review"
    },
    {
      label: "Policy",
      detail: "Firewall rules decide allow, warn, or block.",
      tone: "review"
    }
  ];
}

function buildGraphNodes(evaluation: FirewallEvaluation): GraphNode[] {
  const tx = evaluation.transactionPreview;
  const decoded = tx.decodedTransaction;
  const spender = decoded?.spender ? shortHash(decoded.spender) : "Route adapter";
  const hasCritical = evaluation.scamPatterns.some((pattern) => pattern.severity === "critical");
  return [
    {
      label: "Wallet",
      detail: "User or AI agent initiates the action.",
      tone: evaluation.decision === "ALLOW" ? "safe" : "review"
    },
    {
      label: tx.fromToken ?? "Token",
      detail: tx.approvalType === "none" ? "No token approval detected." : `${tx.approvalType} approval scope.`,
      tone: tx.approvalType === "unlimited" ? "danger" : tx.approvalType === "unknown" ? "review" : "safe"
    },
    {
      label: spender,
      detail: decoded?.spender ? "Decoded spender from calldata." : tx.protocol,
      tone: hasCritical ? "danger" : evaluation.violations.length > 0 ? "review" : "safe"
    },
    {
      label: "Policy",
      detail: evaluation.guardrailState.killSwitchTriggered ? "Agent paused before signing." : evaluation.guardrailState.reason,
      tone: evaluation.decision === "BLOCK" ? "danger" : evaluation.decision === "WARN" ? "review" : "safe"
    }
  ];
}

function nodeTone(tone: GraphNode["tone"]) {
  if (tone === "safe") return "border-success/20 text-success";
  if (tone === "danger") return "border-danger/25 text-danger";
  return "border-warning/25 text-warning";
}

function decisionTone(decision: FirewallEvaluation["decision"]) {
  if (decision === "ALLOW") return "bg-emerald-50 text-success";
  if (decision === "WARN") return "bg-amber-50 text-warning";
  return "bg-red-50 text-danger";
}
