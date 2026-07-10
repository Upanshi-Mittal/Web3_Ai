"use client";

import { BadgeCheck, Database, Save } from "lucide-react";
import Link from "next/link";
import type { ExecutionMode, SentinelReport } from "@sentinelmesh/shared";
import type { TransactionStateSnapshot, Web3NetworkMetadata } from "@sentinelmesh/web3";
import { cn, shortHash } from "@/lib/format";
import { TransactionStatePanel } from "./TransactionStatePanel";

export function ReportCreationPanel({
  mode,
  selectedNetwork,
  canCreate,
  onChainReady,
  creating,
  report,
  txState,
  onModeChange,
  onCreate
}: {
  mode: ExecutionMode;
  selectedNetwork: Web3NetworkMetadata;
  canCreate: boolean;
  onChainReady: boolean;
  creating: boolean;
  report: SentinelReport | null;
  txState: TransactionStateSnapshot;
  onModeChange: (mode: ExecutionMode) => void;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 text-white shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur">
      <div className="flex items-center gap-2">
        <Database className="text-[#a8ff8d]" size={18} />
        <div>
          <div className="text-[11px] font-black uppercase text-[#a8ff8d]">Evidence</div>
          <h2 className="mt-1 font-black text-white">Generate report</h2>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/60">
        Creates a deterministic report first, then optionally anchors only its hash in the testnet registry.
      </p>

      <div className="mt-4 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
        {(["Simulation Only", "Report On-chain"] as ExecutionMode[]).map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => onModeChange(option)}
            className={cn(
              "rounded-lg px-2 py-2 text-xs font-bold transition",
              mode === option ? "bg-[#7eed61] text-black shadow-[0_0_18px_rgba(126,237,97,0.22)]" : "text-white/50 hover:text-white"
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/50">
        Target adapter: <span className="font-semibold text-white">{selectedNetwork.label}</span>
        {selectedNetwork.isPlaceholder && <span> placeholder metadata</span>}
      </div>

      {mode === "Report On-chain" && !onChainReady && (
        <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
          Connect and authenticate a wallet, switch to {selectedNetwork.label}, and configure the deployed registry before anchoring.
        </div>
      )}

      <button
        onClick={onCreate}
        disabled={!canCreate || creating}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7eed61] px-4 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(126,237,97,0.25)] hover:bg-[#a8ff8d] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save size={17} />
        {creating ? "Creating..." : "Generate Report"}
      </button>

      <div className="mt-4">
        <TransactionStatePanel snapshot={txState} explorerTemplate={selectedNetwork.explorer?.txUrlTemplate} />
      </div>

      {report && (
        <div className="mt-4 rounded-xl border border-[#7eed61]/25 bg-[#7eed61]/10 p-3 text-sm text-[#a8ff8d]">
          <div className="flex items-center gap-2 font-semibold">
            <BadgeCheck size={18} />
            Report saved
          </div>
          <div className="mt-2 text-xs">{shortHash(report.reportHash)}</div>
          <Link className="mt-3 inline-flex text-sm font-semibold text-white underline" href={`/reports/${report.id}`}>
            Open report detail
          </Link>
        </div>
      )}
    </div>
  );
}
