"use client";

import { Check, CircleGauge, Database, Network, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExecutionMode } from "@sentinelmesh/shared";
import { cn } from "@/lib/format";

const modes: Array<{ value: ExecutionMode; title: string; body: string }> = [
  {
    value: "Simulation Only",
    title: "Simulation only",
    body: "Generate a deterministic local report. No wallet transaction is requested."
  },
  {
    value: "Report On-chain",
    title: "Report on-chain",
    body: "Ask the connected wallet to anchor only the report hash in the testnet registry."
  }
];

export function ProductSettings() {
  const [mode, setMode] = useState<ExecutionMode>("Simulation Only");
  const [networkId, setNetworkId] = useState("base-sepolia-placeholder");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("sentinelmesh.executionMode");
    if (stored === "Simulation Only" || stored === "Report On-chain") setMode(stored);
    const storedNetwork = window.localStorage.getItem("sentinelmesh.networkId");
    if (storedNetwork) setNetworkId(storedNetwork);
  }, []);

  function selectMode(nextMode: ExecutionMode) {
    setMode(nextMode);
    setSaved(false);
  }

  function save() {
    window.localStorage.setItem("sentinelmesh.executionMode", mode);
    window.localStorage.setItem("sentinelmesh.networkId", networkId);
    setSaved(true);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="surface rounded-lg p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-teal"><Settings2 size={20} /></span>
          <div>
            <h2 className="font-semibold text-ink">Default execution mode</h2>
            <p className="mt-1 text-xs text-muted">Applied when the copilot workspace opens.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {modes.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => selectMode(option.value)}
              className={cn(
                "min-h-36 rounded-lg border p-4 text-left transition",
                mode === option.value ? "border-teal bg-emerald-50 ring-2 ring-teal/10" : "border-border bg-white hover:border-teal/35"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">{option.title}</span>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", mode === option.value ? "border-teal bg-teal text-white" : "border-border")}>
                  {mode === option.value && <Check size={13} />}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">{option.body}</p>
            </button>
          ))}
        </div>
        <label className="mt-5 block text-xs font-semibold text-muted">
          Preferred testnet
          <select
            value={networkId}
            onChange={(event) => {
              setNetworkId(event.target.value);
              setSaved(false);
            }}
            className="mt-2 w-full rounded-md border border-border bg-panel2 p-3 text-sm text-ink outline-none focus:border-teal sm:max-w-sm"
          >
            <option value="base-sepolia-placeholder">Base Sepolia</option>
            <option value="ethereum-sepolia-placeholder">Ethereum Sepolia</option>
          </select>
        </label>
        <button type="button" onClick={save} className="mt-5 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal">
          <Check size={16} />
          {saved ? "Saved" : "Save preference"}
        </button>
      </section>

      <aside className="space-y-3">
        <ConfigStatus icon={<Network size={17} />} title="Network" value="Base Sepolia" state="Testnet" />
        <ConfigStatus icon={<Database size={17} />} title="Registry" value={process.env.NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS ? "Configured" : "Environment required"} state={process.env.NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS ? "Ready" : "Local only"} />
        <ConfigStatus icon={<CircleGauge size={17} />} title="Risk engine" value="Explainable weighted model" state="v0.1" />
        <div className="rounded-lg border border-warning/20 bg-amber-50 p-4 text-xs leading-5 text-warning">
          SentinelMesh never stores wallet keys and never executes mainnet swaps. Report mode writes evidence, not trading instructions.
        </div>
      </aside>
    </div>
  );
}

function ConfigStatus({ icon, title, value, state }: { icon: React.ReactNode; title: string; value: string; state: string }) {
  return (
    <div className="surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-muted">{icon}{title}</span>
        <span className="rounded bg-panel2 px-2 py-1 text-[10px] font-semibold text-teal">{state}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
