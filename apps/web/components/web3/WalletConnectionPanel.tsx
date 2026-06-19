"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertTriangle, CheckCircle2, Network, Wallet } from "lucide-react";
import type { Web3NetworkMetadata } from "@sentinelmesh/web3";
import { cn } from "@/lib/format";

export function WalletConnectionPanel({
  address,
  connected,
  activeNetwork,
  selectedNetwork,
  adapterReady
}: {
  address?: string;
  connected: boolean;
  activeNetwork?: Web3NetworkMetadata;
  selectedNetwork: Web3NetworkMetadata;
  adapterReady: boolean;
}) {
  const aligned = !activeNetwork || activeNetwork.id === selectedNetwork.id;

  return (
    <div className="rounded-lg border border-white/10 bg-panel/92 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="text-teal" size={18} />
          <h2 className="font-semibold text-white">Wallet</h2>
        </div>
        <ConnectButton />
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <StatusRow
          good={connected}
          label={connected ? "Wallet connected" : "Wallet optional"}
          value={connected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Simulation and local reports work without a wallet"}
        />
        <StatusRow
          good={adapterReady}
          label="Registry adapter"
          value={adapterReady ? "Configured for report anchoring" : "Placeholder only until registry metadata is supplied"}
        />
        <div className={cn("rounded-md border p-3", aligned ? "border-white/10 bg-slate-950/40" : "border-warning/30 bg-warning/10")}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Network size={14} />
            Network
          </div>
          <p className="mt-2 text-slate-300">
            UI target: <span className="font-semibold text-white">{selectedNetwork.label}</span>
          </p>
          {activeNetwork && (
            <p className="mt-1 text-xs text-slate-400">
              Wallet chain: <span className="text-white">{activeNetwork.label}</span>
            </p>
          )}
          {!aligned && <p className="mt-2 text-xs text-amber-200">Switch the wallet network before anchoring a report.</p>}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ good, label, value }: { good: boolean; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-white/10 bg-slate-950/40 p-3">
      <div className={cn("mt-0.5", good ? "text-success" : "text-warning")}>{good ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 text-slate-300">{value}</div>
      </div>
    </div>
  );
}
