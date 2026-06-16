"use client";

import type { RiskAnalysis } from "@sentinelmesh/shared";
import { RiskFactorCard } from "./RiskFactorCard";

export function TopRiskFactors({ analysis }: { analysis: RiskAnalysis }) {
  return (
    <section className="rounded-lg border border-white/10 bg-panel/92 p-5">
      <h2 className="font-semibold text-white">Top Risk Factors</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {analysis.topFactors.map((factor) => (
          <RiskFactorCard key={factor.key} label={factor.label} score={factor.score} explanation={factor.explanation} />
        ))}
      </div>
    </section>
  );
}
