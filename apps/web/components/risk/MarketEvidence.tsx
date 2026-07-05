import { Activity, Clock3, Droplets, ExternalLink, Radio } from "lucide-react";
import type { MarketEvidence as MarketEvidenceType } from "@sentinelmesh/shared";

export function MarketEvidence({ evidence }: { evidence?: MarketEvidenceType }) {
  if (!evidence) return null;
  const live = evidence.status === "live";

  return (
    <section className="surface rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow flex items-center gap-2"><Radio size={13} /> Market evidence</div>
          <h2 className="mt-1 font-semibold text-ink">{evidence.pair} on {evidence.chain}</h2>
        </div>
        <span className={live ? "rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-success" : "rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-warning"}>
          {live ? "Live read-only data" : "Fixture fallback"}
        </span>
      </div>

      {live ? (
        <div className="mt-4 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
          <Metric icon={<Droplets size={15} />} label="Liquidity" value={formatUsd(evidence.liquidityUsd)} />
          <Metric icon={<Activity size={15} />} label="24h volume" value={formatUsd(evidence.volume24hUsd)} />
          <Metric icon={<Activity size={15} />} label="24h change" value={formatPercent(evidence.priceChange24h)} />
          <Metric icon={<Clock3 size={15} />} label="Pool age" value={formatAge(evidence.pairAgeDays)} />
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-border bg-panel2 p-3 text-xs leading-5 text-muted">{evidence.notes[0]}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Observed {new Date(evidence.observedAt).toLocaleString()}</span>
        {evidence.url && (
          <a href={evidence.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal">
            Inspect pool
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">{icon}{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function formatUsd(value?: number) {
  if (value === undefined) return "Unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value?: number) {
  if (value === undefined) return "Unavailable";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatAge(value?: number) {
  if (value === undefined) return "Unavailable";
  return value < 1 ? "< 1 day" : `${Math.floor(value)} days`;
}
