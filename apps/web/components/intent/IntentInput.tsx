"use client";

import { AlertTriangle, ArrowUp, Loader2, Sparkles } from "lucide-react";

export const intentExamples = [
  { label: "Safe swap", prompt: "Swap 0.2 ETH to USDC safely with low slippage" },
  { label: "Risky token", prompt: "Swap 10 ETH to PEPE as fast as possible with high slippage" },
  { label: "Bridge review", prompt: "Bridge 1 ETH from Ethereum to Base" },
  { label: "Risk check", prompt: "Analyze risk of swapping 2 ETH to DAI" },
  { label: "Yield review", prompt: "Stake 100 USDC for yield" }
];

export function IntentInput({
  prompt,
  loading,
  error,
  onPromptChange,
  onSubmit
}: {
  prompt: string;
  loading: boolean;
  error: string | null;
  onPromptChange: (prompt: string) => void;
  onSubmit: (prompt?: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
      <textarea
        aria-label="DeFi intent"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSubmit();
        }}
        placeholder="Describe the DeFi action you want to assess..."
        rows={3}
        className="w-full resize-none rounded-md border-0 bg-panel2 p-3 text-base leading-7 text-ink outline-none placeholder:text-muted/70"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {intentExamples.slice(0, 4).map((item) => (
            <button
              type="button"
              key={item.label}
              onClick={() => onSubmit(item.prompt)}
              disabled={loading}
              title={item.prompt}
              className="rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-muted hover:border-teal/40 hover:bg-emerald-50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onSubmit()}
          disabled={loading || !prompt.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <ArrowUp size={16} />}
          Review intent
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
        <Sparkles size={13} className="text-violet" />
        AI-assisted when configured, deterministic fallback when unavailable. Press Cmd/Ctrl + Enter to submit.
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-danger/20 bg-red-50 p-3 text-sm text-danger">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
    </div>
  );
}
