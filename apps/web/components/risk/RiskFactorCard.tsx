"use client";

import { cn } from "@/lib/format";

export function RiskFactorCard({ label, score, explanation }: { label: string; score: number; explanation: string }) {
  const severity = score >= 81 ? "Critical" : score >= 61 ? "High" : score >= 31 ? "Medium" : "Low";

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        <span className={cn("rounded-md border px-2 py-1 text-xs", severityColor(severity))}>{score}/100</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
        <div className={cn("h-full rounded-full", barColor(severity))} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">{explanation}</p>
      <div className="mt-3 text-xs font-medium text-muted/80">{severity} factor</div>
    </div>
  );
}

function severityColor(severity: string) {
  if (severity === "Low") return "border-success/20 bg-emerald-50 text-success";
  if (severity === "Medium") return "border-warning/20 bg-amber-50 text-warning";
  if (severity === "High") return "border-orange-300/30 bg-orange-50 text-orange-700";
  return "border-danger/20 bg-red-50 text-danger";
}

function barColor(severity: string) {
  if (severity === "Low") return "bg-success";
  if (severity === "Medium") return "bg-warning";
  if (severity === "High") return "bg-orange-300";
  return "bg-danger";
}
