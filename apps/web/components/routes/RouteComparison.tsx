import { AlertTriangle, Loader2, Route } from "lucide-react";
import type { RouteAnalysis } from "@sentinelmesh/shared";
import { RouteSelection } from "./RouteSelection";

export function RouteComparison({
  routeAnalysis,
  selectedRouteId,
  loading,
  error,
  onSelect
}: {
  routeAnalysis: RouteAnalysis | null;
  selectedRouteId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (routeId: string) => void;
}) {
  return (
    <section className="surface rounded-lg p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Route className="text-violet" size={20} />
          <div>
            <div className="eyebrow text-violet">Step 04</div>
            <h2 className="mt-1 font-semibold text-ink">Route comparison</h2>
          </div>
        </div>
        {routeAnalysis?.recommendedRouteId && <span className="text-xs text-muted">Selection is committed into the report</span>}
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-panel2 p-4 text-sm text-muted">
          <Loader2 className="animate-spin text-teal" size={18} />
          Comparing deterministic fixture routes...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-danger/20 bg-red-50 p-4 text-sm text-danger">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={17} />
            Route analysis failed
          </div>
          <p className="mt-2 text-xs text-danger/80">{error}</p>
        </div>
      )}

      {!loading && !error && !routeAnalysis && <p className="text-sm text-muted">Run risk analysis to compare route options.</p>}

      {!loading && !error && routeAnalysis && (
        <div className="space-y-4">
          <div className="rounded-md border border-violet/15 bg-violet/5 p-4 text-sm leading-6 text-muted">
            {routeAnalysis.decisionSummary}
          </div>
          <RouteSelection routeAnalysis={routeAnalysis} selectedRouteId={selectedRouteId} onSelect={onSelect} />
        </div>
      )}
    </section>
  );
}
