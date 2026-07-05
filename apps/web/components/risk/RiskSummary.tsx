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
      <div className="surface rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Assessment</div>
            <h2 className="mt-1 font-semibold text-ink">Risk summary</h2>
          </div>
          <span className="rounded-md border border-teal/20 bg-emerald-50 px-2 py-1 text-xs font-medium text-teal">{dataSourceCopy[analysis.dataSource]}</span>
        </div>
        <p className="mt-4 text-sm leading-7 text-muted">{analysis.summary}</p>
        <p className="mt-3 text-xs text-muted/80">Risk engine: {analysis.riskEngineVersion}</p>
      </div>
    </section>
  );
}
