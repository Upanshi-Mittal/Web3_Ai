"use client";

import type { RiskLevel } from "@sentinelmesh/shared";
import { cn, riskColor } from "@/lib/format";

const riskLabels: Record<RiskLevel, string> = {
  Low: "Low execution risk",
  Medium: "Moderate execution risk",
  High: "High execution risk",
  Critical: "Critical risk - review before proceeding"
};

export function RiskMeter({ score, level }: { score: number; level: RiskLevel }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className={cn("rounded-lg border bg-panel/92 p-5", riskColor(level))}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-300">Risk score</div>
          <div className="mt-1 text-xs text-slate-400">{riskLabels[level]}</div>
        </div>
        <span className="rounded-md border border-current/30 px-2 py-1 text-xs font-semibold">{level}</span>
      </div>
      <div className="text-6xl font-semibold text-white">{clamped}</div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-current transition-all" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
