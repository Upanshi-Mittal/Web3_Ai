"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  AlertTriangle,
  BadgeCheck,
  Bot,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Route,
  Save,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import type { AgentResult, DeFiIntent, ExecutionMode, RiskAnalysis, RouteRecommendation, SentinelReport } from "@sentinelmesh/shared";
import { sentinelReportRegistryAbi } from "@sentinelmesh/web3";
import { IntentCard } from "@/components/intent/IntentCard";
import { IntentInput, intentExamples } from "@/components/intent/IntentInput";
import { RiskFactorCard } from "@/components/risk/RiskFactorCard";
import { RiskSummary } from "@/components/risk/RiskSummary";
import { TopRiskFactors } from "@/components/risk/TopRiskFactors";
import { api, type AgentRunResponse } from "@/lib/api";
import { cn, shortHash } from "@/lib/format";

export function AppDashboard() {
  const [prompt, setPrompt] = useState(intentExamples[0]);
  const [intent, setIntent] = useState<DeFiIntent | null>(null);
  const [risk, setRisk] = useState<RiskAnalysis | null>(null);
  const [route, setRoute] = useState<RouteRecommendation | null>(null);
  const [trace, setTrace] = useState<AgentResult[]>([]);
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [mode, setMode] = useState<ExecutionMode>("Simulation Only");
  const [network, setNetwork] = useState("Base Sepolia");
  const [error, setError] = useState<string | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzingRisk, setAnalyzingRisk] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const registryAddress = process.env.NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const canAnchor = Boolean(registryAddress && isConnected && mode !== "Simulation Only");

  async function parseIntent(selectedPrompt = prompt) {
    setLoading(true);
    setError(null);
    setRiskError(null);
    setReport(null);
    setRisk(null);
    setRoute(null);
    try {
      const result = await api.parseIntent(selectedPrompt);
      setPrompt(selectedPrompt);
      setIntent(result.parsedIntent);
      setTrace([
        {
          agentName: "IntentAgent",
          status: result.parsedIntent.action === "unsupported" ? "warning" : "completed",
          confidence: result.confidence,
          reasoning: result.reasoning,
          output: result.parsedIntent,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse intent");
    } finally {
      setLoading(false);
    }
  }

  async function analyzeRisk() {
    if (!intent) return;
    setAnalyzingRisk(true);
    setRiskError(null);
    setReport(null);
    try {
      const result = await api.analyzeRisk(intent);
      setRisk(result.analysis);
      setRoute(null);
      setTrace((currentTrace) => [...currentTrace.filter((entry) => entry.agentName !== "RiskAgent"), result.agent]);
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : "Risk analysis failed. Please check the parsed intent and try again.");
    } finally {
      setAnalyzingRisk(false);
    }
  }

  async function generateReport() {
    if (!intent || !risk || !route) return;
    setCreatingReport(true);
    setError(null);
    try {
      let created = await api.createReport({
        prompt,
        parsedIntent: intent,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        riskFactors: risk.factors,
        riskFactorExplanations: risk.factorExplanations,
        recommendedRoute: route,
        agentTrace: trace,
        userAddress: address
      });

      if (canAnchor && registryAddress) {
        const txHash = await writeContractAsync({
          address: registryAddress,
          abi: sentinelReportRegistryAbi,
          functionName: "createReport",
          args: [created.reportHash, BigInt(created.riskScore), created.recommendedRoute.recommendedRoute, created.reportURI]
        });

        const verified = await api.verifyReport(created.id, {
          onChainHash: created.reportHash,
          chainTxHash: txHash
        });
        created = verified.report;
      }

      setReport(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setCreatingReport(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
      <section className="space-y-5">
        <div className="rounded-lg border border-white/10 bg-panel/92 p-5 shadow-glow">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-white">Risk Copilot</h1>
              <p className="mt-1 text-sm text-slate-400">{"Ask -> Parse -> Analyze -> Recommend -> Verify -> Save -> Share"}</p>
            </div>
            <ConnectButton />
          </div>

          <IntentInput prompt={prompt} loading={loading} error={error} onPromptChange={setPrompt} onSubmit={parseIntent} />
          <button
            onClick={analyzeRisk}
            disabled={loading || analyzingRisk || !intent}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-violet/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {analyzingRisk ? <Loader2 className="animate-spin" size={15} /> : <FileCheck2 size={15} />}
            Analyze Risk
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <IntentCard intent={intent} onChange={setIntent} />
          <AgentTimeline trace={trace} loading={loading} />
        </div>

        <RiskAnalysisPanel risk={risk} loading={analyzingRisk} error={riskError} />

        <RoutePanel route={route} />
      </section>

      <aside className="space-y-5">
        <div className="rounded-lg border border-white/10 bg-panel/92 p-5">
          <h2 className="font-semibold text-white">Product Settings</h2>
          <label className="mt-4 block text-sm text-slate-400">Execution mode</label>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as ExecutionMode)}
            className="mt-2 w-full rounded-md border border-white/10 bg-panel2 p-3 text-sm text-white"
          >
            <option>Simulation Only</option>
            <option>Report On-chain</option>
          </select>
          <label className="mt-4 block text-sm text-slate-400">Network</label>
          <select
            value={network}
            onChange={(event) => setNetwork(event.target.value)}
            className="mt-2 w-full rounded-md border border-white/10 bg-panel2 p-3 text-sm text-white"
          >
            <option>Base Sepolia</option>
            <option>Ethereum Sepolia</option>
          </select>
          <div className="mt-4 rounded-md border border-white/10 bg-slate-950/50 p-3 text-xs leading-5 text-slate-400">
            {canAnchor
              ? "Registry anchoring is ready for the connected wallet."
              : "Simulation works without a wallet. Configure NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS to anchor reports on testnet."}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-panel/92 p-5">
          <h2 className="font-semibold text-white">Generate Report</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Creates a deterministic report hash and stores the report in local API storage. On-chain anchoring is optional and testnet-only.
          </p>
          <button
            onClick={generateReport}
            disabled={!intent || !risk || !route || creatingReport}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-violet px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingReport ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
            Generate Report
          </button>
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
      </aside>
    </main>
  );
}

function AgentTimeline({ trace, loading }: { trace: AgentResult[]; loading: boolean }) {
  const expected = ["IntentAgent", "RiskAgent", "RouteAgent", "ReportAgent", "VerificationAgent"];
  return (
    <div className="rounded-lg border border-white/10 bg-panel/92 p-5">
      <h2 className="font-semibold text-white">Agent Timeline</h2>
      <div className="mt-4 space-y-3">
        {expected.map((agent) => {
          const item = trace.find((entry) => entry.agentName === agent);
          const active = loading && !item && agent === "IntentAgent";
          return (
            <div key={agent} className="flex gap-3 rounded-md border border-white/10 bg-slate-950/40 p-3">
              <div className={cn("mt-0.5 text-slate-500", item?.status === "completed" && "text-success", item?.status === "warning" && "text-warning")}>
                {active ? <Loader2 className="animate-spin" size={18} /> : item ? <CheckCircle2 size={18} /> : <Bot size={18} />}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{agent}</div>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {item?.reasoning[0] ?? (active ? "Running..." : "Waiting for prior step")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskFactorGrid({ risk }: { risk: RiskAnalysis | null }) {
  const factors = risk?.factorExplanations ?? [];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {factors.length === 0
        ? Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-white/10 bg-panel/92 p-4 text-sm text-slate-500">
              Risk factor placeholder
            </div>
          ))
        : factors.map((factor) => <RiskFactorCard key={factor.key} label={factor.label} score={factor.score} explanation={factor.explanation} />)}
    </div>
  );
}

function RiskAnalysisPanel({ risk, loading, error }: { risk: RiskAnalysis | null; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-panel/92 p-6 text-sm text-slate-300">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin text-teal" size={18} />
          Analyzing slippage, liquidity, token, gas, price impact, route complexity, and MEV exposure...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 p-5 text-sm text-rose-200">
        Risk analysis failed. Please check the parsed intent and try again.
        <div className="mt-2 text-xs text-rose-200/80">{error}</div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="rounded-lg border border-white/10 bg-panel/92 p-6 text-sm text-slate-400">
        Parse an intent to analyze DeFi execution risk.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RiskSummary analysis={risk} />
      <TopRiskFactors analysis={risk} />
      <section>
        <h2 className="mb-3 font-semibold text-white">Full Risk Breakdown</h2>
        <RiskFactorGrid risk={risk} />
      </section>
    </div>
  );
}

function RoutePanel({ route }: { route: RouteRecommendation | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel/92 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Route className="text-violet" size={20} />
        <h2 className="font-semibold text-white">Route Recommendation</h2>
      </div>
      {!route ? (
        <p className="text-sm text-slate-400">Run an analysis to receive a route recommendation.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-violet/30 bg-violet/10 p-4">
            <div className="text-sm text-violet">Recommended route</div>
            <div className="mt-2 text-xl font-semibold text-white">{route.recommendedRoute}</div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{route.explanation}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <RouteList title="Pros" items={route.pros} icon={<ShieldCheck size={16} />} />
            <RouteList title="Tradeoffs" items={route.cons} icon={<AlertTriangle size={16} />} />
          </div>
        </div>
      )}
    </div>
  );
}

function RouteList({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        {title}
      </div>
      <ul className="space-y-2 text-sm text-slate-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
