"use client";

import { cn } from "@/lib/format";

export function RiskFactorCard({ label, score, explanation }: { label: string; score: number; explanation: string }) {
  const severity = score >= 81 ? "Critical" : score >= 61 ? "High" : score >= 31 ? "Medium" : "Low";

  return (
    <div className="rounded-lg border border-white/10 bg-panel/92 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{label}</h3>
        <span className={cn("rounded-md border px-2 py-1 text-xs", severityColor(severity))}>{score}/100</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full", barColor(severity))} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">{explanation}</p>
      <div className="mt-3 text-xs font-medium text-slate-500">{severity} factor</div>
    </div>
  );
}

function severityColor(severity: string) {
  if (severity === "Low") return "border-success/30 bg-success/10 text-success";
  if (severity === "Medium") return "border-warning/30 bg-warning/10 text-warning";
  if (severity === "High") return "border-orange-300/30 bg-orange-400/10 text-orange-300";
  return "border-danger/30 bg-danger/10 text-danger";
}

function barColor(severity: string) {
  if (severity === "Low") return "bg-success";
  if (severity === "Medium") return "bg-warning";
  if (severity === "High") return "bg-orange-300";
  return "bg-danger";
}
