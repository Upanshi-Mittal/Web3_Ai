"use client";

import dynamic from "next/dynamic";

const AppControlPlane3D = dynamic(
  () => import("@/components/hero/AppControlPlane3D").then((module) => module.AppControlPlane3D),
  {
    ssr: false,
    loading: () => <ControlPlaneFallback />
  }
);

export function LazyAppControlPlane3D() {
  return <AppControlPlane3D />;
}

function ControlPlaneFallback() {
  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="app-control-plane-3d-loading" aria-hidden="true">
      <div className="absolute left-[55%] top-1/2 h-32 w-32 -translate-y-1/2 rotate-45 rounded-xl border border-[#7eed61]/25 bg-[#7eed61]/10 shadow-[0_0_80px_rgba(126,237,97,0.22)]" />
      <div className="absolute left-[42%] top-[30%] h-px w-80 rotate-12 bg-[#7eed61]/25" />
      <div className="absolute left-[38%] top-[58%] h-px w-96 -rotate-6 bg-violet/20" />
      <div className="absolute left-[69%] top-[35%] h-3 w-3 rounded-full bg-[#7eed61]/45" />
      <div className="absolute left-[77%] top-[54%] h-2.5 w-2.5 rounded-full bg-violet/45" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_42%,rgba(126,237,97,0.18),transparent_28%),radial-gradient(circle_at_78%_48%,rgba(115,87,217,0.14),transparent_26%)]" />
    </div>
  );
}
