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
      <div className="rounded-lg border border-dashed border-border bg-white/55 p-5">
        <h2 className="font-semibold text-ink">Parsed Intent</h2>
        <p className="mt-3 text-sm text-muted">Submit an intent to review the structured fields before analysis.</p>
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
    <div className="surface rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Step 02</div>
          <h2 className="mt-1 font-semibold text-ink">Review parsed intent</h2>
          <p className="mt-1 text-xs text-muted">Corrections reset downstream analysis so the report remains internally consistent.</p>
        </div>
        {intent.action === "unsupported" && (
          <span className="rounded-md border border-warning/30 bg-amber-50 px-2 py-1 text-xs text-warning">Unsupported</span>
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
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">Analysis uses the reviewed values above.</p>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal disabled:cursor-not-allowed disabled:opacity-50"
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
    <label className="text-xs font-medium text-muted">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-panel2 p-2.5 text-sm text-ink outline-none focus:border-teal/60"
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
    <label className="text-xs font-medium text-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-panel2 p-2.5 text-sm text-ink outline-none focus:border-teal/60"
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
