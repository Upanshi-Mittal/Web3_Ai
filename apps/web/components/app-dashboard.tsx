"use client";

import {
  Activity,
  Bot,
  CheckCircle2,
  FileCheck2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import type { AgentResult, DeFiIntent, ExecutionMode, QuotePreview, RiskAnalysis, RouteAnalysis, SentinelReport } from "@sentinelmesh/shared";
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
import { MarketEvidence } from "@/components/risk/MarketEvidence";
import { RiskSummary } from "@/components/risk/RiskSummary";
import { TopRiskFactors } from "@/components/risk/TopRiskFactors";
import { RouteComparison } from "@/components/routes/RouteComparison";
import { QuotePreviewPanel } from "@/components/routes/QuotePreviewPanel";
import { ReportCreationPanel } from "@/components/web3/ReportCreationPanel";
import { WalletConnectionPanel } from "@/components/web3/WalletConnectionPanel";
import { useSentinelAuth } from "@/app/providers";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";

export function AppDashboard() {
  const [prompt, setPrompt] = useState(intentExamples[0].prompt);
  const [intent, setIntent] = useState<DeFiIntent | null>(null);
  const [risk, setRisk] = useState<RiskAnalysis | null>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis | null>(null);
  const [quotePreview, setQuotePreview] = useState<QuotePreview | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [trace, setTrace] = useState<AgentResult[]>([]);
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [mode, setMode] = useState<ExecutionMode>("Simulation Only");
  const [error, setError] = useState<string | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [txState, setTxState] = useState<TransactionStateSnapshot>({ state: "idle", label: "Ready", description: "No transaction has been requested." });
  const [loading, setLoading] = useState(false);
  const [analyzingRisk, setAnalyzingRisk] = useState(false);
  const [routing, setRouting] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const [preferredNetworkId, setPreferredNetworkId] = useState("base-sepolia-placeholder");
  const { address, isConnected } = useAccount();
  const { status: authStatus, user: authUser } = useSentinelAuth();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  useEffect(() => {
    const savedMode = window.localStorage.getItem("sentinelmesh.executionMode");
    if (savedMode === "Simulation Only" || savedMode === "Report On-chain") setMode(savedMode);
    const savedNetwork = window.localStorage.getItem("sentinelmesh.networkId");
    if (savedNetwork) setPreferredNetworkId(savedNetwork);
  }, []);

  const networks = hydrateNetworkMetadata(placeholderNetworks, {
    registryAddress: process.env.NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS as `0x${string}` | undefined,
    registryChainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532),
    explorerTxUrlTemplate: process.env.NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE ?? process.env.NEXT_PUBLIC_EXPLORER_BASE_URL,
    explorerLabel: process.env.NEXT_PUBLIC_EXPLORER_LABEL
  });
  const activeNetwork = findNetworkByChainId(networks, chainId);
  const selectedNetwork = activeNetwork ?? findNetworkById(networks, preferredNetworkId) ?? getDefaultNetwork(networks);
  const selectedNetworkFromId = findNetworkById(networks, selectedNetwork.id);
  const authenticatedWallet = Boolean(
    authStatus === "authenticated" &&
      address &&
      authUser?.address.toLowerCase() === address.toLowerCase()
  );
  const canAnchor = Boolean(
    isConnected &&
      authenticatedWallet &&
      activeNetwork?.id === selectedNetworkFromId.id &&
      placeholderReportRegistryAdapter.canWrite(selectedNetworkFromId) &&
      mode !== "Simulation Only"
  );

  function changeMode(nextMode: ExecutionMode) {
    setMode(nextMode);
    window.localStorage.setItem("sentinelmesh.executionMode", nextMode);
  }

  async function parseIntent(selectedPrompt = prompt) {
    setLoading(true);
    setError(null);
    setRiskError(null);
    setRouteError(null);
    setQuoteError(null);
    setReport(null);
    setTxState({ state: "idle", label: "Ready", description: "No transaction has been requested." });
    setRisk(null);
    setRouteAnalysis(null);
    setQuotePreview(null);
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
    setQuoteError(null);
    setReport(null);
    setTxState({ state: "idle", label: "Ready", description: "No transaction has been requested." });
    setRouteAnalysis(null);
    setQuotePreview(null);
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
      setRouting(false);
      setQuoteLoading(true);
      try {
        setQuotePreview(
          await api.getQuotePreview(
            intent,
            authenticatedWallet ? address : undefined
          )
        );
      } catch (quoteRequestError) {
        setQuoteError(quoteRequestError instanceof Error ? quoteRequestError.message : "Quote evidence is unavailable.");
      } finally {
        setQuoteLoading(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Risk analysis failed. Please check the parsed intent and try again.";
      if (phase === "route") setRouteError(message);
      else setRiskError(message);
    } finally {
      setAnalyzingRisk(false);
      setRouting(false);
      setQuoteLoading(false);
    }
  }

  async function generateReport() {
    if (!intent || !risk || !routeAnalysis || !selectedRouteId) return;
    setCreatingReport(true);
    setError(null);
    setTxState({ state: "preparing", label: "Preparing report", description: "Creating the local report payload and deterministic hash." });
    try {
      let created = await api.createReport({
        prompt,
        parsedIntent: intent,
        selectedRouteId,
        userAddress: authenticatedWallet ? address : undefined
      });

      if (canAnchor && selectedNetworkFromId.registryAddress) {
        setTxState({ state: "awaiting-wallet", label: "Wallet confirmation", description: "Review the report-registry transaction in your wallet." });
        const args = placeholderReportRegistryAdapter.buildCreateReportArgs({
          registryAddress: selectedNetworkFromId.registryAddress,
          reportHash: created.reportHash,
          riskScore: created.riskScore,
          recommendation: created.recommendedRoute.recommendedRoute,
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
        if (!verified.output.verified || !verified.transactionVerified) {
          throw new Error(verified.registryReadError ?? "The registry transaction could not be verified");
        }
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

      setReport(created);
      setTrace(created.agentTrace);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate report";
      setError(message);
      setTxState({ state: "failed", label: "Failed", description: "The report creation flow failed.", error: message });
    } finally {
      setCreatingReport(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow flex items-center gap-2"><Activity size={14} /> Live workspace</div>
          <h1 className="mt-2 text-3xl font-semibold text-ink">DeFi risk copilot</h1>
          <p className="mt-2 text-sm text-muted">Review the analysis and route before connecting a wallet or writing a report hash.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-success/20 bg-emerald-50 px-3 py-2 text-xs font-semibold text-success">
          <ShieldCheck size={15} />
          Testnet only · non-custodial
        </div>
      </div>

      <WorkflowProgress intent={intent} risk={risk} routeAnalysis={routeAnalysis} report={report} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        <div className="surface rounded-lg p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Step 01</div>
              <h2 className="mt-1 text-xl font-semibold text-ink">What do you want to do?</h2>
            </div>
          </div>

          <IntentInput prompt={prompt} loading={loading} error={error} onPromptChange={setPrompt} onSubmit={parseIntent} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <IntentCard
            intent={intent}
            analyzing={analyzingRisk || routing}
            onAnalyze={analyzeRisk}
            onChange={(updatedIntent) => {
              setIntent(updatedIntent);
              setRisk(null);
              setRouteAnalysis(null);
              setQuotePreview(null);
              setQuoteError(null);
              setSelectedRouteId(null);
              setReport(null);
            }}
          />
          <AgentTimeline trace={trace} loading={loading} />
        </div>

        <RiskAnalysisPanel risk={risk} loading={analyzingRisk} error={riskError} />

        <RouteComparison routeAnalysis={routeAnalysis} selectedRouteId={selectedRouteId} loading={routing} error={routeError} onSelect={setSelectedRouteId} />
        <QuotePreviewPanel quote={quotePreview} loading={quoteLoading} error={quoteError} />
      </section>

      <aside className="space-y-5">
        <WalletConnectionPanel
          address={address}
          connected={isConnected}
          authStatus={authStatus}
          authenticatedWallet={authenticatedWallet}
          activeNetwork={isConnected ? activeNetwork : undefined}
          selectedNetwork={selectedNetworkFromId}
          adapterReady={placeholderReportRegistryAdapter.canWrite(selectedNetworkFromId)}
        />

        <ReportCreationPanel
          mode={mode}
          selectedNetwork={selectedNetworkFromId}
          canCreate={Boolean(intent && risk && routeAnalysis && selectedRouteId && (mode === "Simulation Only" || canAnchor))}
          onChainReady={canAnchor}
          creating={creatingReport}
          report={report}
          txState={txState}
          onModeChange={changeMode}
          onCreate={generateReport}
        />
      </aside>
      </div>
    </main>
  );
}

function WorkflowProgress({
  intent,
  risk,
  routeAnalysis,
  report
}: {
  intent: DeFiIntent | null;
  risk: RiskAnalysis | null;
  routeAnalysis: RouteAnalysis | null;
  report: SentinelReport | null;
}) {
  const steps = [
    { label: "Ask", compactLabel: "Ask", complete: true },
    { label: "Parse", compactLabel: "Parse", complete: Boolean(intent) },
    { label: "Analyze", compactLabel: "Risk", complete: Boolean(risk) },
    { label: "Recommend", compactLabel: "Route", complete: Boolean(routeAnalysis) },
    { label: "Save", compactLabel: "Save", complete: Boolean(report) }
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="grid grid-cols-5">
        {steps.map((step, index) => (
          <div key={step.label} className={cn("relative border-r border-border px-2 py-3 last:border-r-0 sm:px-4", step.complete && "bg-emerald-50/70")}>
            <div className="flex items-center gap-2">
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold", step.complete ? "border-teal bg-teal text-white" : "border-border bg-white text-muted")}>
                {step.complete ? <CheckCircle2 size={13} /> : index + 1}
              </span>
              <span className={cn("text-[10px] font-semibold sm:text-xs", step.complete ? "text-ink" : "text-muted")}>
                <span className="sm:hidden">{step.compactLabel}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentTimeline({ trace, loading }: { trace: AgentResult[]; loading: boolean }) {
  const expected = ["IntentAgent", "RiskAgent", "RouteAgent", "ReportAgent", "VerificationAgent"];
  return (
    <div className="surface rounded-lg p-5">
      <div className="eyebrow">Agent mesh</div>
      <h2 className="mt-1 font-semibold text-ink">Analysis trace</h2>
      <div className="mt-4 space-y-3">
        {expected.map((agent) => {
          const item = trace.find((entry) => entry.agentName === agent);
          const active = loading && !item && agent === "IntentAgent";
          return (
            <div key={agent} className="flex gap-3 rounded-md border border-border bg-panel2 p-3">
              <div className={cn("mt-0.5 text-muted/60", item?.status === "completed" && "text-success", item?.status === "warning" && "text-warning")}>
                {active ? <Loader2 className="animate-spin" size={18} /> : item ? <CheckCircle2 size={18} /> : <Bot size={18} />}
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">{agent}</div>
                <p className="mt-1 text-xs leading-5 text-muted">
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
            <div key={index} className="rounded-lg border border-dashed border-border bg-white/60 p-4 text-sm text-muted">
              Awaiting risk signal
            </div>
          ))
        : factors.map((factor) => <RiskFactorCard key={factor.key} label={factor.label} score={factor.score} explanation={factor.explanation} />)}
    </div>
  );
}

function RiskAnalysisPanel({ risk, loading, error }: { risk: RiskAnalysis | null; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="surface rounded-lg p-6 text-sm text-muted">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin text-teal" size={18} />
          Analyzing slippage, liquidity, token, gas, price impact, route complexity, and MEV exposure...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/20 bg-red-50 p-5 text-sm text-danger">
        Risk analysis failed. Please check the parsed intent and try again.
        <div className="mt-2 text-xs text-danger/80">{error}</div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white/60 p-6 text-sm text-muted">
        Parse an intent to analyze DeFi execution risk.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RiskSummary analysis={risk} />
      <MarketEvidence evidence={risk.marketEvidence} />
      <TopRiskFactors analysis={risk} />
      <section>
        <h2 className="mb-3 font-semibold text-ink">Full risk breakdown</h2>
        <RiskFactorGrid risk={risk} />
      </section>
    </div>
  );
}
