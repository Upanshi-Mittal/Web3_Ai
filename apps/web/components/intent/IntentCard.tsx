"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import type { DeFiAction, DeFiIntent, DeFiPriority, RiskTolerance } from "@sentinelmesh/shared";

const actions: DeFiAction[] = ["swap", "bridge", "stake", "analyze", "unsupported"];
const priorities: DeFiPriority[] = ["safety", "speed", "cost", "yield"];
const riskTolerances: Array<RiskTolerance | ""> = ["", "low", "medium", "high"];

export function IntentCard({
  intent,
  analyzing,
  onChange,
  onAnalyze
}: {
  intent: DeFiIntent | null;
  analyzing: boolean;
  onChange: (updatedIntent: DeFiIntent) => void;
  onAnalyze: () => void;
}) {
  if (!intent) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.05] p-5 text-white backdrop-blur">
        <h2 className="font-black text-white">Parsed Intent</h2>
        <p className="mt-3 text-sm text-white/50">Submit an intent to review the structured fields before analysis.</p>
      </div>
    );
  }

  const currentIntent = intent;

  function update<K extends keyof DeFiIntent>(key: K, value: DeFiIntent[K]) {
    onChange({ ...currentIntent, [key]: value } as DeFiIntent);
  }

  function updateConstraint<K extends keyof DeFiIntent["constraints"]>(key: K, value: DeFiIntent["constraints"][K] | "") {
    onChange({
      ...currentIntent,
      constraints: {
        ...currentIntent.constraints,
        [key]: value || undefined
      }
    });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 text-white shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-[#a8ff8d]">Step 02</div>
          <h2 className="mt-1 font-black text-white">Review parsed intent</h2>
          <p className="mt-1 text-xs text-white/50">Corrections reset downstream analysis so the report remains internally consistent.</p>
        </div>
        {intent.action === "unsupported" && (
          <span className="rounded-md border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-100">Unsupported</span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectField label="Action" value={intent.action} options={actions} onChange={(value) => update("action", value as DeFiAction)} />
        <TextField label="Amount" value={intent.amount ?? ""} onChange={(value) => update("amount", value || undefined)} />
        <TextField label="Token In" value={intent.tokenIn ?? ""} onChange={(value) => update("tokenIn", value ? value.toUpperCase() : undefined)} />
        <TextField label="Token Out" value={intent.tokenOut ?? ""} onChange={(value) => update("tokenOut", value ? value.toUpperCase() : undefined)} />
        <TextField label="Chain" value={intent.chain ?? ""} onChange={(value) => update("chain", value || undefined)} />
        <SelectField label="Priority" value={intent.priority} options={priorities} onChange={(value) => update("priority", value as DeFiPriority)} />
        <TextField
          label="Max Slippage"
          value={intent.constraints.maxSlippage ?? ""}
          onChange={(value) => updateConstraint("maxSlippage", value)}
        />
        <SelectField
          label="Risk Tolerance"
          value={intent.constraints.riskTolerance ?? ""}
          options={riskTolerances}
          emptyLabel="Not specified"
          onChange={(value) => updateConstraint("riskTolerance", value as RiskTolerance | "")}
        />
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-xs text-white/50">Analysis uses the reviewed values above.</p>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#7eed61] px-4 py-2.5 text-sm font-black text-black hover:bg-[#a8ff8d] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
          {analyzing ? "Analyzing..." : "Analyze risk"}
        </button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-semibold text-white/50">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white outline-none focus:border-[#7eed61]/50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  emptyLabel,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  emptyLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-semibold text-white/50">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-2.5 text-sm text-white outline-none focus:border-[#7eed61]/50"
      >
        {options.map((option) => (
          <option key={option || "empty"} value={option}>
            {option || emptyLabel || "None"}
          </option>
        ))}
      </select>
    </label>
  );
}
