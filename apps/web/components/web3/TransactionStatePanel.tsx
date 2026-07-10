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
    <div className={cn("rounded-xl border p-3 text-sm", failed ? "border-red-300/25 bg-red-500/12" : success ? "border-[#7eed61]/25 bg-[#7eed61]/10" : "border-white/10 bg-black/20")}>
      <div className="flex items-center gap-2 font-semibold text-white">
        {busy ? <Loader2 className="animate-spin text-[#a8ff8d]" size={17} /> : failed ? <AlertTriangle className="text-red-200" size={17} /> : success ? <CheckCircle2 className="text-[#a8ff8d]" size={17} /> : <Clock3 className="text-white/40" size={17} />}
        {state.label}
      </div>
      <p className="mt-2 text-xs leading-5 text-white/50">{state.error ?? state.description}</p>
      {state.txHash && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.06] p-2 text-xs">
          <span className="text-white/50">Tx</span>
          {explorerUrl ? (
            <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#a8ff8d] underline">
              {shortHash(state.txHash)}
              <ExternalLink size={13} />
            </a>
          ) : (
            <span className="text-white">{shortHash(state.txHash)}</span>
          )}
        </div>
      )}
    </div>
  );
}
