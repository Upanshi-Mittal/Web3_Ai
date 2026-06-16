"use client";

import type { RiskAnalysis } from "@sentinelmesh/shared";
import { RiskMeter } from "./RiskMeter";

const dataSourceCopy: Record<RiskAnalysis["dataSource"], string> = {
  fixture: "Using fixture risk data for demo reliability",
  live: "Using live data",
  mixed: "Using mixed live and fallback data"
};

export function RiskSummary({ analysis }: { analysis: RiskAnalysis }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <RiskMeter score={analysis.riskScore} level={analysis.riskLevel} />
      <div className="rounded-lg border border-white/10 bg-panel/92 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-white">Risk Summary</h2>
          <span className="rounded-md border border-teal/30 bg-teal/10 px-2 py-1 text-xs text-teal">{dataSourceCopy[analysis.dataSource]}</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-300">{analysis.summary}</p>
        <p className="mt-3 text-xs text-slate-500">Risk engine: {analysis.riskEngineVersion}</p>
      </div>
    </section>
  );
}
