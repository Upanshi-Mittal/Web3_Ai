import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Fuel,
  Loader2,
  LockKeyhole,
  Route
} from "lucide-react";
import type { QuotePreview } from "@sentinelmesh/shared";

export function QuotePreviewPanel({
  quote,
  loading,
  error
}: {
  quote: QuotePreview | null;
  loading: boolean;
  error: string | null;
}) {
  if (!loading && !quote && !error) return null;

  return (
    <section className="surface rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <DatabaseZap className="text-teal" size={20} />
          <div>
            <div className="eyebrow">Route evidence</div>
            <h2 className="mt-1 font-semibold text-ink">Read-only quote preview</h2>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded border border-border bg-panel2 px-2 py-1 text-xs font-semibold text-muted">
          <LockKeyhole size={13} />
          No transaction broadcast
        </span>
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-panel2 p-4 text-sm text-muted">
          <Loader2 className="animate-spin text-teal" size={18} />
          Checking executable liquidity and simulation evidence...
        </div>
      )}

      {!loading && (error || quote?.status !== "live") && (
        <div className="mt-4 rounded-md border border-border bg-panel2 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Clock3 className="text-muted" size={17} />
            Live quote unavailable
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">{error ?? quote?.notes[0]}</p>
          <p className="mt-2 text-xs text-muted">Risk analysis and report generation still use deterministic fallback data.</p>
        </div>
      )}

      {!loading && quote?.status === "live" && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Pair" value={quote.pair} />
            <Metric label="Estimated output" value={quote.estimatedBuyAmount ?? "Unavailable"} />
            <Metric label="Minimum output" value={quote.minimumBuyAmount ?? "Unavailable"} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-panel2 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted">
                <Route size={15} />
                Liquidity sources
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">
                {quote.routeSources.length ? quote.routeSources.join(", ") : "Provider-selected route"}
              </p>
            </div>
            <div className="rounded-md border border-border bg-panel2 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted">
                <Fuel size={15} />
                Simulation
              </div>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink">
                {quote.simulation.status === "success" ? (
                  <CheckCircle2 className="text-success" size={16} />
                ) : (
                  <AlertTriangle className="text-warning" size={16} />
                )}
                {simulationLabel(quote)}
              </p>
            </div>
          </div>

          {(quote.allowanceRequired || quote.balanceIssue || quote.simulation.status === "reverted") && (
            <div className="rounded-md border border-warning/25 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              {quote.allowanceRequired && <p>Token approval would be required before execution.</p>}
              {quote.balanceIssue && <p>The connected wallet does not have enough balance for this quote.</p>}
              {quote.simulation.status === "reverted" && <p>Read-only simulation reverted: {quote.simulation.reason}</p>}
            </div>
          )}

          <p className="text-xs leading-5 text-muted">
            Live 0x evidence observed {new Date(quote.observedAt).toLocaleTimeString()}. It is informational and is not a guarantee of execution price or MEV protection.
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-panel2 p-4">
      <div className="text-xs font-semibold uppercase text-muted">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function simulationLabel(quote: QuotePreview) {
  if (quote.simulation.status === "success") {
    return quote.simulation.gasEstimate ? `Passed · ${quote.simulation.gasEstimate} gas` : "Passed";
  }
  if (quote.simulation.status === "reverted") return "Reverted";
  return quote.estimatedGas ? `Provider estimate · ${quote.estimatedGas} gas` : "RPC not configured";
}
