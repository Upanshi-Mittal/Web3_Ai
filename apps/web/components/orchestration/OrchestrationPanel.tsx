"use client";

import { AlertTriangle, CheckCircle2, GitBranch, Loader2, OctagonAlert, Play, ShieldCheck } from "lucide-react";
import type { OrchestrationRun, OrchestrationStep } from "@sentinelmesh/shared";
import { cn } from "@/lib/format";

export function OrchestrationPanel({
  run,
  loading,
  error,
  onRun
}: {
  run: OrchestrationRun | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#7eed61]/25 bg-[#07130f]/92 p-5 text-white shadow-[0_22px_80px_rgba(4,18,13,0.34)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(126,237,97,0.16),transparent_28%),radial-gradient(circle_at_92%_8%,rgba(33,214,151,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(126,237,97,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(126,237,97,0.035)_1px,transparent_1px)] bg-[length:34px_34px]" />
      <div className="relative">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase text-[#a8ff8d]"><GitBranch size={14} /> Orchestration layer</div>
          <h2 className="mt-1 text-xl font-black text-white">Control-plane run</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            Coordinates parser, risk engine, route builder, quote evidence, firewall policy, and report readiness in simulation mode.
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#7eed61] px-4 py-2.5 text-xs font-black text-black shadow-[0_0_24px_rgba(126,237,97,0.32)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />}
          Run
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/12 p-3 text-sm font-medium text-red-100">
          {error}
        </div>
      )}

      <div className="mt-5 border-l border-[#7eed61]/35 pl-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-white/45">Run status</span>
          <span className={cn("rounded px-2 py-1 text-[10px] font-bold uppercase", statusTone(run?.status))}>
            {loading ? "running" : run?.status ?? "waiting"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-white/80">
          {run?.summary ?? "Run the orchestrator to see the full decision path before generating a report."}
        </p>
      </div>

      <div className="mt-5 grid gap-0">
        {(run?.steps ?? previewSteps).map((step, index, steps) => (
          <div key={step.id} className="grid grid-cols-[28px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border bg-black/50", stepTone(step.status))}>
                {step.status === "blocked" || step.status === "failed" ? <OctagonAlert size={15} /> : step.status === "warning" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              </span>
              {index < steps.length - 1 && <span className="mt-1 h-full min-h-4 w-px bg-[#7eed61]/18" />}
            </div>
            <div className="border-b border-white/8 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{step.label}</span>
                <span className="text-[11px] font-semibold text-[#a8ff8d]">{step.agentName}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/50">{step.summary}</p>
              {typeof step.durationMs === "number" && (
                <div className="mt-2 text-[10px] font-semibold text-white/40">{step.durationMs} ms</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {run && (
        <>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {run.gates.map((gate) => (
              <div key={gate.id} className={cn("border-l px-3 py-2", gateTone(gate.status))}>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <ShieldCheck size={14} />
                  {gate.label}
                </div>
                <p className="mt-1 text-xs leading-5">{gate.reason}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="text-xs font-semibold text-white">Next actions</div>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-white/60">
              {run.nextActions.map((action) => (
                <li key={action} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7eed61]" />
                  {action}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

const previewSteps: OrchestrationStep[] = [
  {
    id: "intent",
    label: "Parse natural-language intent",
    agentName: "IntentAgent",
    status: "queued" as const,
    dependencies: [],
    summary: "Waiting for an orchestration run."
  },
  {
    id: "risk",
    label: "Score transaction risk",
    agentName: "RiskAgent",
    status: "queued" as const,
    dependencies: ["intent"],
    summary: "Risk factors will be computed after parsing."
  },
  {
    id: "route",
    label: "Build route recommendation set",
    agentName: "RouteAgent",
    status: "queued" as const,
    dependencies: ["risk"],
    summary: "Routes will be compared before the firewall gate."
  },
  {
    id: "firewall",
    label: "Evaluate signing policy",
    agentName: "FirewallOrchestrator",
    status: "queued" as const,
    dependencies: ["route"],
    summary: "Policy gates decide allow, warn, or block."
  }
];

function statusTone(status?: OrchestrationRun["status"]) {
  if (status === "blocked" || status === "failed") return "bg-red-400/15 text-red-100";
  if (status === "needs-review") return "bg-amber-300/15 text-amber-100";
  if (status === "completed") return "bg-[#7eed61]/15 text-[#a8ff8d]";
  return "bg-white/10 text-white/60";
}

function stepTone(status: string) {
  if (status === "blocked" || status === "failed") return "border-red-300/35 text-red-200";
  if (status === "warning") return "border-amber-300/35 text-amber-200";
  if (status === "completed") return "border-[#7eed61]/45 text-[#a8ff8d]";
  return "border-white/15 text-white/40";
}

function gateTone(status: "pass" | "warn" | "block") {
  if (status === "block") return "border-red-300/70 text-red-100";
  if (status === "warn") return "border-amber-300/70 text-amber-100";
  return "border-[#7eed61]/70 text-[#a8ff8d]";
}
