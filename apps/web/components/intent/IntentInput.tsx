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
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <textarea
        aria-label="DeFi intent"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSubmit();
        }}
        placeholder="Describe the DeFi action you want to assess..."
        rows={3}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.07] p-4 text-base leading-7 text-white outline-none placeholder:text-white/35 focus:border-[#7eed61]/40"
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
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/60 hover:border-[#7eed61]/45 hover:bg-[#7eed61]/10 hover:text-[#a8ff8d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onSubmit()}
          disabled={loading || !prompt.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-[#7eed61] px-5 py-2.5 text-sm font-black text-black shadow-[0_0_24px_rgba(126,237,97,0.24)] hover:bg-[#a8ff8d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <ArrowUp size={16} />}
          Review intent
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-white/40">
        <Sparkles size={13} className="text-[#a8ff8d]" />
        AI-assisted when configured, deterministic fallback when unavailable. Press Cmd/Ctrl + Enter to submit.
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300/25 bg-red-500/12 p-3 text-sm text-red-100">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
    </div>
  );
}
