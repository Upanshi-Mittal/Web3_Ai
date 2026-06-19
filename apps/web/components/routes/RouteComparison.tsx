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
    <section className="rounded-lg border border-white/10 bg-panel/92 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Route className="text-violet" size={20} />
          <h2 className="font-semibold text-white">Route Comparison</h2>
        </div>
        {routeAnalysis?.recommendedRouteId && <span className="text-xs text-slate-500">Selected route is stored for report generation</span>}
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
          <Loader2 className="animate-spin text-teal" size={18} />
          Comparing deterministic fixture routes...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-rose-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={17} />
            Route analysis failed
          </div>
          <p className="mt-2 text-xs text-rose-200/80">{error}</p>
        </div>
      )}

      {!loading && !error && !routeAnalysis && <p className="text-sm text-slate-400">Run risk analysis to compare route options.</p>}

      {!loading && !error && routeAnalysis && (
        <div className="space-y-4">
          <div className="rounded-md border border-white/10 bg-slate-950/40 p-4 text-sm leading-6 text-slate-300">
            {routeAnalysis.decisionSummary}
          </div>
          <RouteSelection routeAnalysis={routeAnalysis} selectedRouteId={selectedRouteId} onSelect={onSelect} />
        </div>
      )}
    </section>
  );
}
