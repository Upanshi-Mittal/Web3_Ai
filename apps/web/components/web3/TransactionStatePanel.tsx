"use client";

import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Loader2 } from "lucide-react";
import { transactionStateCopy, type TransactionStateSnapshot, getExplorerTxUrl } from "@sentinelmesh/web3";
import { cn, shortHash } from "@/lib/format";

export function TransactionStatePanel({
  snapshot,
  explorerTemplate
}: {
  snapshot: TransactionStateSnapshot;
  explorerTemplate?: string;
}) {
  const state = transactionStateCopy(snapshot);
  const explorerUrl = getExplorerTxUrl(state.txHash, explorerTemplate);
  const busy = state.state === "preparing" || state.state === "awaiting-wallet" || state.state === "submitted" || state.state === "confirming";
  const success = state.state === "confirmed" || state.state === "skipped";
  const failed = state.state === "failed";

  return (
    <div className={cn("rounded-md border p-3 text-sm", failed ? "border-danger/20 bg-red-50" : success ? "border-success/20 bg-emerald-50" : "border-border bg-panel2")}>
      <div className="flex items-center gap-2 font-semibold text-ink">
        {busy ? <Loader2 className="animate-spin text-teal" size={17} /> : failed ? <AlertTriangle className="text-danger" size={17} /> : success ? <CheckCircle2 className="text-success" size={17} /> : <Clock3 className="text-slate-500" size={17} />}
        {state.label}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">{state.error ?? state.description}</p>
      {state.txHash && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-white p-2 text-xs">
          <span className="text-muted">Tx</span>
          {explorerUrl ? (
            <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal underline">
              {shortHash(state.txHash)}
              <ExternalLink size={13} />
            </a>
          ) : (
            <span className="text-ink">{shortHash(state.txHash)}</span>
          )}
        </div>
      )}
    </div>
  );
}
