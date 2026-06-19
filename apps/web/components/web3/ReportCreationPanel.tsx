"use client";

import { BadgeCheck, Save } from "lucide-react";
import Link from "next/link";
import type { ExecutionMode, SentinelReport } from "@sentinelmesh/shared";
import type { TransactionStateSnapshot, Web3NetworkMetadata } from "@sentinelmesh/web3";
import { shortHash } from "@/lib/format";
import { TransactionStatePanel } from "./TransactionStatePanel";

export function ReportCreationPanel({
  mode,
  selectedNetwork,
  canCreate,
  creating,
  report,
  txState,
  onModeChange,
  onCreate
}: {
  mode: ExecutionMode;
  selectedNetwork: Web3NetworkMetadata;
  canCreate: boolean;
  creating: boolean;
  report: SentinelReport | null;
  txState: TransactionStateSnapshot;
  onModeChange: (mode: ExecutionMode) => void;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel/92 p-5">
      <h2 className="font-semibold text-white">Generate Report</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Creates a deterministic local report first. On-chain anchoring uses the placeholder report-registry adapter when wallet and registry metadata are available.
      </p>

      <label className="mt-4 block text-sm text-slate-400">Execution mode</label>
      <select
        value={mode}
        onChange={(event) => onModeChange(event.target.value as ExecutionMode)}
        className="mt-2 w-full rounded-md border border-white/10 bg-panel2 p-3 text-sm text-white"
      >
        <option>Simulation Only</option>
        <option>Report On-chain</option>
      </select>

      <div className="mt-4 rounded-md border border-white/10 bg-slate-950/40 p-3 text-xs leading-5 text-slate-400">
        Target adapter: <span className="font-semibold text-white">{selectedNetwork.label}</span>
        {selectedNetwork.isPlaceholder && <span> placeholder metadata</span>}
      </div>

      <button
        onClick={onCreate}
        disabled={!canCreate || creating}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-violet px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Save size={17} />
        {creating ? "Creating..." : "Generate Report"}
      </button>

      <div className="mt-4">
        <TransactionStatePanel snapshot={txState} explorerTemplate={selectedNetwork.explorer?.txUrlTemplate} />
      </div>

      {report && (
        <div className="mt-4 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-emerald-100">
          <div className="flex items-center gap-2 font-semibold">
            <BadgeCheck size={18} />
            Report saved
          </div>
          <div className="mt-2 text-xs text-emerald-200">{shortHash(report.reportHash)}</div>
          <Link className="mt-3 inline-flex text-sm font-semibold text-white underline" href={`/reports/${report.id}`}>
            Open verified detail page
          </Link>
        </div>
      )}
    </div>
  );
}
