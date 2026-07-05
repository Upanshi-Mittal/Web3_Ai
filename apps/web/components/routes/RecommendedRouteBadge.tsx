import { BadgeCheck, FileSearch, ShieldAlert } from "lucide-react";
import type { RouteOption } from "@sentinelmesh/shared";
import { cn } from "@/lib/format";

export function RecommendedRouteBadge({ route }: { route: RouteOption }) {
  const icon = route.decision === "recommended" ? <BadgeCheck size={14} /> : route.decision === "fallback" ? <ShieldAlert size={14} /> : <FileSearch size={14} />;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold",
        route.decision === "recommended" && "border-success/20 bg-emerald-50 text-success",
        route.decision === "report-only" && "border-warning/20 bg-amber-50 text-warning",
        route.decision === "fallback" && "border-danger/20 bg-red-50 text-danger",
        route.decision === "available" && "border-border bg-panel2 text-muted",
        route.decision === "not-recommended" && "border-border bg-gray-50 text-gray-500"
      )}
    >
      {icon}
      {route.decision === "recommended" ? "Recommended" : route.decision.replace("-", " ")}
    </span>
  );
}
