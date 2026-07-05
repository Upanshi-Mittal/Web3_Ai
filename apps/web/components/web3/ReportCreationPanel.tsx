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
    <div className="surface rounded-lg p-5">
      <div className="flex items-center gap-2">
        <Database className="text-violet" size={18} />
        <div>
          <div className="eyebrow text-violet">Evidence</div>
          <h2 className="mt-1 font-semibold text-ink">Generate report</h2>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        Creates a deterministic report first, then optionally anchors only its hash in the testnet registry.
      </p>

      <div className="mt-4 grid grid-cols-2 rounded-md border border-border bg-panel2 p-1">
        {(["Simulation Only", "Report On-chain"] as ExecutionMode[]).map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => onModeChange(option)}
            className={cn(
              "rounded px-2 py-2 text-xs font-semibold transition",
              mode === option ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-border bg-panel2 p-3 text-xs leading-5 text-muted">
        Target adapter: <span className="font-semibold text-ink">{selectedNetwork.label}</span>
        {selectedNetwork.isPlaceholder && <span> placeholder metadata</span>}
      </div>

      {mode === "Report On-chain" && !onChainReady && (
        <div className="mt-3 rounded-md border border-warning/20 bg-amber-50 p-3 text-xs leading-5 text-warning">
          Connect and authenticate a wallet, switch to {selectedNetwork.label}, and configure the deployed registry before anchoring.
        </div>
      )}

      <button
        onClick={onCreate}
        disabled={!canCreate || creating}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save size={17} />
        {creating ? "Creating..." : "Generate Report"}
      </button>

      <div className="mt-4">
        <TransactionStatePanel snapshot={txState} explorerTemplate={selectedNetwork.explorer?.txUrlTemplate} />
      </div>

      {report && (
        <div className="mt-4 rounded-md border border-success/20 bg-emerald-50 p-3 text-sm text-success">
          <div className="flex items-center gap-2 font-semibold">
            <BadgeCheck size={18} />
            Report saved
          </div>
          <div className="mt-2 text-xs">{shortHash(report.reportHash)}</div>
          <Link className="mt-3 inline-flex text-sm font-semibold text-ink underline" href={`/reports/${report.id}`}>
            Open report detail
          </Link>
        </div>
      )}
    </div>
  );
}
