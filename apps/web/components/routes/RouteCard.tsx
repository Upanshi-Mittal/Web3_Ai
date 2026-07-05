import { AlertTriangle, Check, Clock3, Fuel, Gauge, MousePointer2, ShieldCheck, Waypoints } from "lucide-react";
import type { ReactNode } from "react";
import type { RouteOption } from "@sentinelmesh/shared";
import { cn, riskColor } from "@/lib/format";
import { RecommendedRouteBadge } from "./RecommendedRouteBadge";

export function RouteCard({ route, selected, onSelect }: { route: RouteOption; selected: boolean; onSelect: (routeId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(route.routeId)}
      className={cn(
        "h-full rounded-lg border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-lift",
        selected ? "border-violet/60 ring-2 ring-violet/10" : "border-border",
        route.isRecommended && "bg-violet/[0.035]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-ink">
            {selected ? <Check size={17} className="text-violet" /> : <MousePointer2 size={17} className="text-slate-500" />}
            <h3 className="text-sm font-semibold">{route.routeName}</h3>
          </div>
          <p className="mt-2 text-xs font-medium text-muted">
            {route.inputToken}
            {route.outputToken ? ` -> ${route.outputToken}` : ""} on {route.sourceChain}
            {route.destinationChain ? ` -> ${route.destinationChain}` : ""}
          </p>
        </div>
        <RecommendedRouteBadge route={route} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Metric icon={<Gauge size={14} />} label="Risk" value={`${route.riskScore} / ${route.riskLevel}`} className={riskColor(route.riskLevel)} />
        <Metric icon={<ShieldCheck size={14} />} label="Liquidity" value={`${route.liquidityConfidence}%`} />
        <Metric icon={<Fuel size={14} />} label="Gas" value={route.estimatedGas} />
        <Metric icon={<Clock3 size={14} />} label="Time" value={route.estimatedTime} />
        <Metric icon={<Waypoints size={14} />} label="Slippage" value={route.estimatedSlippage} />
        <Metric icon={<AlertTriangle size={14} />} label="Impact" value={route.estimatedPriceImpact} />
      </div>

      <p className="mt-4 text-sm leading-6 text-muted">{route.recommendationReason}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <RouteList title="Pros" items={route.pros} />
        <RouteList title="Tradeoffs" items={route.cons} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {route.supportedExecutionModes.map((mode) => (
          <span key={mode} className="rounded-md border border-border bg-panel2 px-2 py-1 text-[11px] font-medium text-muted">
            {mode}
          </span>
        ))}
      </div>
    </button>
  );
}

function Metric({ icon, label, value, className }: { icon: ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-md border border-border bg-panel2 p-2 text-muted", className)}>
      <div className="flex items-center gap-1 text-[11px] text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate font-semibold text-ink">{value}</div>
    </div>
  );
}

function RouteList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted">{title}</div>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
