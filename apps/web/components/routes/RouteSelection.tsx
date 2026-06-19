import type { RouteAnalysis } from "@sentinelmesh/shared";
import { RouteCard } from "./RouteCard";

export function RouteSelection({
  routeAnalysis,
  selectedRouteId,
  onSelect
}: {
  routeAnalysis: RouteAnalysis;
  selectedRouteId: string | null;
  onSelect: (routeId: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {routeAnalysis.routes.map((route) => (
        <RouteCard key={route.routeId} route={route} selected={selectedRouteId === route.routeId} onSelect={onSelect} />
      ))}
    </div>
  );
}
