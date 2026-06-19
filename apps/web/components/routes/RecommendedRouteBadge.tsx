import { BadgeCheck, FileSearch, ShieldAlert } from "lucide-react";
import type { RouteOption } from "@sentinelmesh/shared";
import { cn } from "@/lib/format";

export function RecommendedRouteBadge({ route }: { route: RouteOption }) {
  const icon = route.decision === "recommended" ? <BadgeCheck size={14} /> : route.decision === "fallback" ? <ShieldAlert size={14} /> : <FileSearch size={14} />;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
        route.decision === "recommended" && "border-success/30 bg-success/10 text-emerald-200",
        route.decision === "report-only" && "border-warning/30 bg-warning/10 text-amber-200",
        route.decision === "fallback" && "border-danger/30 bg-danger/10 text-rose-200",
        route.decision === "available" && "border-white/10 bg-white/5 text-slate-300",
        route.decision === "not-recommended" && "border-slate-600/40 bg-slate-900 text-slate-400"
      )}
    >
      {icon}
      {route.decision === "recommended" ? "Recommended" : route.decision.replace("-", " ")}
    </span>
  );
}
