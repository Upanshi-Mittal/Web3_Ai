"use client";

import {
  Bot,
  CheckCircle2,
  FileCheck2,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import type { AgentResult, DeFiIntent, ExecutionMode, RiskAnalysis, RouteAnalysis, RouteRecommendation, RouteType, SentinelReport } from "@sentinelmesh/shared";
import {
  findNetworkByChainId,
  findNetworkById,
  getDefaultNetwork,
  hydrateNetworkMetadata,
  placeholderNetworks,
  placeholderReportRegistryAdapter,
  sentinelReportRegistryAbi,
  type TransactionStateSnapshot
} from "@sentinelmesh/web3";
import { IntentCard } from "@/components/intent/IntentCard";
import { IntentInput, intentExamples } from "@/components/intent/IntentInput";
import { RiskFactorCard } from "@/components/risk/RiskFactorCard";
import { RiskSummary } from "@/components/risk/RiskSummary";
import { TopRiskFactors } from "@/components/risk/TopRiskFactors";
import { RouteComparison } from "@/components/routes/RouteComparison";
import { ReportCreationPanel } from "@/components/web3/ReportCreationPanel";
import { WalletConnectionPanel } from "@/components/web3/WalletConnectionPanel";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";

export function AppDashboard() {
  const [prompt, setPrompt] = useState(intentExamples[0]);
  const [intent, setIntent] = useState<DeFiIntent | null>(null);
  const [risk, setRisk] = useState<RiskAnalysis | null>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [trace, setTrace] = useState<AgentResult[]>([]);
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [mode, setMode] = useState<ExecutionMode>("Simulation Only");
  const [error, setError] = useState<string | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [txState, setTxState] = useState<TransactionStateSnapshot>({ state: "idle", label: "Ready", description: "No transaction has been requested." });
  const [loading, setLoading] = useState(false);
  const [analyzingRisk, setAnalyzingRisk] = useState(false);
  const [routing, setRouting] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const networks = hydrateNetworkMetadata(placeholderNetworks, {
    registryAddress: process.env.NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS as `0x${string}` | undefined,
    explorerTxUrlTemplate: process.env.NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE ?? process.env.NEXT_PUBLIC_EXPLORER_BASE_URL,
    explorerLabel: process.env.NEXT_PUBLIC_EXPLORER_LABEL
  });
  const activeNetwork = findNetworkByChainId(networks, chainId);
  const selectedNetwork = activeNetwork ?? getDefaultNetwork(networks);
  const selectedNetworkFromId = findNetworkById(networks, selectedNetwork.id);
  const canAnchor = Boolean(isConnected && placeholderReportRegistryAdapter.canWrite(selectedNetworkFromId) && mode !== "Simulation Only");

  async function parseIntent(selectedPrompt = prompt) {
    setLoading(true);
    setError(null);
    setRiskError(null);
    setRouteError(null);
    setReport(null);
    setTxState({ state: "idle", label: "Ready", description: "No transaction has been requested." });
    setRisk(null);
    setRouteAnalysis(null);
    setSelectedRouteId(null);
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
    let phase: "risk" | "route" = "risk";
    setAnalyzingRisk(true);
    setRiskError(null);
    setRouteError(null);
    setReport(null);
    setTxState({ state: "idle", label: "Ready", description: "No transaction has been requested." });
    setRouteAnalysis(null);
    setSelectedRouteId(null);
    try {
      const result = await api.analyzeRisk(intent);
      setRisk(result.analysis);
      setTrace((currentTrace) => [...currentTrace.filter((entry) => entry.agentName !== "RiskAgent"), result.agent]);
      setAnalyzingRisk(false);
      phase = "route";
      setRouting(true);
      const routeResult = await api.analyzeRoutes(intent, result.analysis);
      setRouteAnalysis(routeResult.recommendation);
      setSelectedRouteId(routeResult.recommendation.selectedRouteId ?? routeResult.recommendation.recommendedRouteId ?? routeResult.routes[0]?.routeId ?? null);
      setTrace((currentTrace) => [...currentTrace.filter((entry) => entry.agentName !== "RouteAgent"), routeResult.agent]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Risk analysis failed. Please check the parsed intent and try again.";
      if (phase === "route") setRouteError(message);
      else setRiskError(message);
    } finally {
      setAnalyzingRisk(false);
      setRouting(false);
    }
  }

  async function generateReport() {
    if (!intent || !risk || !routeAnalysis || !selectedRouteId) return;
    setCreatingReport(true);
    setError(null);
    setTxState({ state: "preparing", label: "Preparing report", description: "Creating the local report payload and deterministic hash." });
    try {
      const selectedLegacyRoute = routeAnalysisToLegacyRecommendation(routeAnalysis, selectedRouteId);
      let created = await api.createReport({
        prompt,
        parsedIntent: intent,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        riskFactors: risk.factors,
        riskFactorExplanations: risk.factorExplanations,
        recommendedRoute: selectedLegacyRoute,
        agentTrace: trace,
        userAddress: address
      });

      if (canAnchor && selectedNetworkFromId.registryAddress) {
        setTxState({ state: "awaiting-wallet", label: "Wallet confirmation", description: "Review the report-registry transaction in your wallet." });
        const args = placeholderReportRegistryAdapter.buildCreateReportArgs({
          registryAddress: selectedNetworkFromId.registryAddress,
          reportHash: created.reportHash,
          riskScore: created.riskScore,
          recommendation: selectedLegacyRoute.recommendedRoute,
          reportURI: created.reportURI
        });
        const txHash = await writeContractAsync({
          address: selectedNetworkFromId.registryAddress,
          abi: sentinelReportRegistryAbi,
          functionName: "createReport",
          args
        });
        setTxState({ state: "submitted", label: "Transaction submitted", description: "The wallet returned a transaction hash.", txHash });

        if (publicClient) {
          setTxState({ state: "confirming", label: "Confirming", description: "Waiting for the selected network to confirm the report transaction.", txHash });
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }

        const verified = await api.verifyReport(created.id, {
          onChainHash: created.reportHash,
          chainTxHash: txHash
        });
        created = verified.report;
        setTxState({ state: "confirmed", label: "Confirmed", description: "The report hash was anchored and the local report is marked for verification.", txHash });
      } else {
        const verified = await api.verifyReport(created.id);
        created = verified.report;
        setTxState({
          state: "skipped",
          label: "Local report only",
          description:
            mode === "Simulation Only"
              ? "Simulation mode created a local report without requesting a wallet transaction."
              : "On-chain anchoring was skipped because the wallet or registry adapter metadata is not ready."
        });
      }

      setTrace(created.agentTrace);
      setReport(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate report";
      setError(message);
      setTxState({ state: "failed", label: "Failed", description: "The report creation flow failed.", error: message });
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
          <IntentCard
            intent={intent}
            onChange={(updatedIntent) => {
              setIntent(updatedIntent);
              setRisk(null);
              setRouteAnalysis(null);
              setSelectedRouteId(null);
              setReport(null);
            }}
          />
          <AgentTimeline trace={trace} loading={loading} />
        </div>

        <RiskAnalysisPanel risk={risk} loading={analyzingRisk} error={riskError} />

        <RouteComparison routeAnalysis={routeAnalysis} selectedRouteId={selectedRouteId} loading={routing} error={routeError} onSelect={setSelectedRouteId} />
      </section>

      <aside className="space-y-5">
        <WalletConnectionPanel
          address={address}
          connected={isConnected}
          activeNetwork={isConnected ? activeNetwork : undefined}
          selectedNetwork={selectedNetworkFromId}
          adapterReady={placeholderReportRegistryAdapter.canWrite(selectedNetworkFromId)}
        />

        <ReportCreationPanel
          mode={mode}
          selectedNetwork={selectedNetworkFromId}
          canCreate={Boolean(intent && risk && routeAnalysis && selectedRouteId)}
          creating={creatingReport}
          report={report}
          txState={txState}
          onModeChange={setMode}
          onCreate={generateReport}
        />
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

function routeAnalysisToLegacyRecommendation(routeAnalysis: RouteAnalysis, selectedRouteId: string): RouteRecommendation {
  const selected = routeAnalysis.routes.find((route) => route.routeId === selectedRouteId) ?? routeAnalysis.routes[0];
  const recommendedRoute = legacyRouteType(selected?.routeId ?? "", selected?.decision ?? "fallback", selected?.riskScore ?? 100);

  return {
    recommendedRoute,
    alternatives: routeAnalysis.routes
      .filter((route) => route.routeId !== selected?.routeId)
      .map((route) => legacyRouteType(route.routeId, route.decision, route.riskScore))
      .filter((route, index, routes) => routes.indexOf(route) === index),
    pros: selected?.pros ?? [],
    cons: selected?.cons ?? [],
    explanation: selected?.recommendationReason ?? routeAnalysis.decisionSummary
  };
}

function legacyRouteType(routeId: string, decision: string, riskScore: number): RouteType {
  if (decision === "fallback" || riskScore > 85) return "BLOCKED_UNSAFE";
  if (routeId.includes("split")) return "SPLIT_ORDER";
  if (routeId.includes("protected")) return "PROTECTED_ROUTE";
  if (decision === "report-only" || routeId.includes("report")) return "DELAYED_EXECUTION";
  return "STANDARD_ROUTE";
}
