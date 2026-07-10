"use client";

import {
  Activity,
  Bot,
  CheckCircle2,
  FileCheck2,
  GitBranch,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import {
  DEFAULT_AGENT_WALLET_POLICY,
  type AgentResult,
  type AgentWalletPolicy,
  type DeFiIntent,
  type ExecutionMode,
  type FirewallEvaluation,
  type OrchestrationRun,
  type QuotePreview,
  type RawTransactionInput,
  type RiskAnalysis,
  type RouteAnalysis,
  type SentinelReport
} from "@sentinelmesh/shared";
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
import { FirewallPolicyPanel } from "@/components/firewall/FirewallPolicyPanel";
import { LazyAppControlPlane3D } from "@/components/hero/LazyAppControlPlane3D";
import { OrchestrationPanel } from "@/components/orchestration/OrchestrationPanel";
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
  const [firewallEvaluation, setFirewallEvaluation] = useState<FirewallEvaluation | null>(null);
  const [policy, setPolicy] = useState<AgentWalletPolicy>(DEFAULT_AGENT_WALLET_POLICY);
  const [rawTransaction, setRawTransaction] = useState<RawTransactionInput | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [trace, setTrace] = useState<AgentResult[]>([]);
  const [orchestrationRun, setOrchestrationRun] = useState<OrchestrationRun | null>(null);
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [mode, setMode] = useState<ExecutionMode>("Simulation Only");
  const [error, setError] = useState<string | null>(null);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [firewallError, setFirewallError] = useState<string | null>(null);
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null);
  const [txState, setTxState] = useState<TransactionStateSnapshot>({ state: "idle", label: "Ready", description: "No transaction has been requested." });
  const [loading, setLoading] = useState(false);
  const [analyzingRisk, setAnalyzingRisk] = useState(false);
  const [routing, setRouting] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [firewallLoading, setFirewallLoading] = useState(false);
  const [orchestrationLoading, setOrchestrationLoading] = useState(false);
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
    setFirewallError(null);
    setOrchestrationError(null);
    setOrchestrationRun(null);
    setReport(null);
    setTxState({ state: "idle", label: "Ready", description: "No transaction has been requested." });
    setRisk(null);
    setRouteAnalysis(null);
    setQuotePreview(null);
    setFirewallEvaluation(null);
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

  async function runOrchestration() {
    setOrchestrationLoading(true);
    setOrchestrationError(null);
    setError(null);
    setRiskError(null);
    setRouteError(null);
    setQuoteError(null);
    setFirewallError(null);
    setReport(null);
    setTxState({ state: "idle", label: "Ready", description: "No transaction has been requested." });
    try {
      const run = await api.runOrchestration(prompt, policy, rawTransaction?.data ? rawTransaction : undefined);
      setOrchestrationRun(run);
      setIntent(run.parsedIntent);
      setRisk(run.riskAnalysis);
      setRouteAnalysis(run.routeAnalysis);
      setSelectedRouteId(run.selectedRouteId ?? run.routeAnalysis.selectedRouteId ?? run.routeAnalysis.recommendedRouteId ?? run.routeAnalysis.routes[0]?.routeId ?? null);
      setQuotePreview(run.quotePreview);
      setFirewallEvaluation(run.firewallEvaluation);
      setTrace(run.agentTrace);
    } catch (err) {
      setOrchestrationError(err instanceof Error ? err.message : "Orchestration failed.");
    } finally {
      setOrchestrationLoading(false);
    }
  }

  async function analyzeRisk() {
    if (!intent) return;
    let phase: "risk" | "route" = "risk";
    setAnalyzingRisk(true);
    setRiskError(null);
    setRouteError(null);
    setQuoteError(null);
    setFirewallError(null);
    setOrchestrationError(null);
    setOrchestrationRun(null);
    setReport(null);
    setTxState({ state: "idle", label: "Ready", description: "No transaction has been requested." });
    setRouteAnalysis(null);
    setQuotePreview(null);
    setFirewallEvaluation(null);
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
      await evaluateFirewall(result.analysis);
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

  async function evaluateFirewall(currentRisk = risk) {
    if (!intent || !currentRisk) return;
    setFirewallLoading(true);
    setFirewallError(null);
    try {
      const result = await api.evaluateFirewall(intent, currentRisk, policy, rawTransaction?.data ? rawTransaction : undefined);
      setFirewallEvaluation(result.evaluation);
      setQuotePreview(result.quote);
      setRisk(result.analysis);
    } catch (err) {
      setFirewallError(err instanceof Error ? err.message : "Firewall evaluation failed.");
    } finally {
      setFirewallLoading(false);
    }
  }

  async function generateReport() {
    if (!intent || !risk || !routeAnalysis || !selectedRouteId || !firewallEvaluation) return;
    setCreatingReport(true);
    setError(null);
    setTxState({ state: "preparing", label: "Preparing report", description: "Creating the local report payload and deterministic hash." });
    try {
      let created = await createReportForCurrentMode({
        prompt,
        parsedIntent: intent,
        selectedRouteId,
        policy
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

  async function createReportForCurrentMode(input: {
    prompt: string;
    parsedIntent: DeFiIntent;
    selectedRouteId: string;
    policy: AgentWalletPolicy;
  }) {
    const userAddress = mode === "Report On-chain" && authenticatedWallet ? address : undefined;
    try {
      return await api.createReport({
        ...input,
        userAddress
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (mode === "Simulation Only" && message.toLowerCase().includes("wallet authentication")) {
        return api.createReport(input);
      }
      throw err;
    }
  }

  return (
    <main className="pb-8">
      <section className="relative isolate overflow-hidden bg-[#213c1c] px-3 py-5 sm:px-5 sm:py-7">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(126,237,97,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(126,237,97,0.06)_1px,transparent_1px)] bg-[length:44px_44px]" />
        <div className="relative mx-auto max-w-7xl rounded-[28px] border border-[#7eed61]/65 bg-black shadow-[0_0_22px_rgba(126,237,97,0.58),0_0_86px_rgba(126,237,97,0.28)]">
          <div className="relative min-h-[430px] overflow-hidden rounded-[27px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(126,237,97,0.20),transparent_29%),linear-gradient(90deg,rgba(0,0,0,0.98)_0%,rgba(0,0,0,0.94)_45%,rgba(7,31,17,0.74)_100%)]" />
            <div className="absolute inset-y-6 right-0 w-full max-w-4xl opacity-95">
              <LazyAppControlPlane3D />
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.88)_45%,rgba(0,0,0,0.34)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(126,237,97,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(126,237,97,0.04)_1px,transparent_1px)] bg-[length:38px_38px]" />

            <div className="relative z-10 grid min-h-[430px] items-center gap-8 px-6 py-8 sm:px-9 lg:grid-cols-[0.82fr_1fr] lg:px-12">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#7eed61]/40 bg-[#102a21] text-[#7eed61] shadow-[0_0_24px_rgba(126,237,97,0.22)]">
                    <ShieldCheck size={22} />
                  </span>
                  <span className="text-2xl font-black tracking-wide text-white">SentinelMesh</span>
                </div>

                <div className="mt-10 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#7eed61]/40 bg-[#7eed61]/10 px-3 py-1.5 text-xs font-bold text-[#a8ff8d]">
                    Live orchestration layer
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/75">
                    Testnet · non-custodial
                  </span>
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
                    Wallet pre-sign firewall
                  </span>
                </div>

                <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[1.02] text-white [text-shadow:0_0_28px_rgba(126,237,97,0.16)] sm:text-6xl lg:text-7xl">
                  AI transaction firewall for DeFi wallets and agents
                </h1>
                <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-white/80 sm:text-lg">
                  Decode intent, map protocol trust, score risk, enforce signing policy, and save verifiable evidence before a wallet or AI agent signs.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="#workflow"
                    className="inline-flex min-w-56 items-center justify-center gap-2 rounded-full bg-[#7eed61] px-7 py-4 text-sm font-black text-black shadow-[0_0_30px_rgba(126,237,97,0.38)] transition hover:-translate-y-0.5"
                  >
                    Start risk review
                    <Activity size={17} />
                  </a>
                  <a
                    href="/reports"
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-4 text-sm font-bold text-white hover:border-[#7eed61]/55 hover:text-[#a8ff8d]"
                  >
                    Reports
                    <FileCheck2 size={17} />
                  </a>
                </div>

                <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-white/10 pt-6">
                  <HeroMetric value={risk ? `${risk.riskScore}` : "7"} label={risk ? "Risk score" : "Risk signals"} />
                  <HeroMetric value={firewallEvaluation?.decision ?? "READY"} label="Firewall" />
                  <HeroMetric value={orchestrationRun?.status ?? "SIM"} label="Mode" />
                </div>
              </div>

              <div className="relative hidden min-h-[320px] lg:block" aria-hidden="true">
                <div className="absolute bottom-5 right-5 w-80 rounded-xl border border-[#7eed61]/25 bg-black/60 p-4 text-white shadow-[0_0_46px_rgba(126,237,97,0.16)] backdrop-blur">
                  <div className="flex items-center justify-between text-xs font-black text-[#a8ff8d]">
                    ORCHESTRATOR
                    <span>{firewallEvaluation?.decision ?? "WAITING"}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] font-semibold text-white/60">
                    {[
                      intent ? "IntentAgent parsed request" : "IntentAgent standing by",
                      risk ? `RiskAgent scored ${risk.riskScore}/100` : "RiskAgent awaiting intent",
                      firewallEvaluation ? `Firewall gate: ${firewallEvaluation.decision}` : "Policy gate armed"
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#7eed61]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="sentinel-dark-page relative scroll-mt-24 overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(126,237,97,0.16),transparent_28%),radial-gradient(circle_at_90%_18%,rgba(33,214,151,0.12),transparent_30%),linear-gradient(180deg,#07130f_0%,#0a1712_55%,#07110d_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(126,237,97,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(126,237,97,0.035)_1px,transparent_1px)] bg-[length:42px_42px]" />
        <div className="relative mx-auto max-w-7xl">
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <CryptoStat icon={<Sparkles size={16} />} label="Firewall decision" value={firewallEvaluation?.decision ?? "Waiting"} tone={firewallEvaluation?.decision === "BLOCK" ? "danger" : firewallEvaluation?.decision === "WARN" ? "warning" : "success"} />
        <CryptoStat icon={<Activity size={16} />} label="Risk score" value={risk ? `${risk.riskScore}/100` : "Not scored"} tone={risk?.riskLevel === "Critical" || risk?.riskLevel === "High" ? "danger" : risk?.riskLevel === "Medium" ? "warning" : "success"} />
        <CryptoStat icon={<GitBranch size={16} />} label="Orchestration" value={orchestrationRun?.status ?? "Ready"} tone={orchestrationRun?.status === "blocked" ? "danger" : orchestrationRun?.status === "needs-review" ? "warning" : "success"} />
      </div>

      <WorkflowProgress intent={intent} risk={risk} routeAnalysis={routeAnalysis} firewallEvaluation={firewallEvaluation} report={report} />

      <div className="mt-5">
        <OrchestrationPanel
          run={orchestrationRun}
          loading={orchestrationLoading}
          error={orchestrationError}
          onRun={runOrchestration}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        <div className="rounded-2xl border border-[#7eed61]/20 bg-white/[0.07] p-5 text-white shadow-[0_20px_80px_rgba(0,0,0,0.22)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase text-[#a8ff8d]">Step 01</div>
              <h2 className="mt-1 text-xl font-black text-white">What do you want to do?</h2>
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
              setFirewallEvaluation(null);
              setFirewallError(null);
              setQuoteError(null);
              setSelectedRouteId(null);
              setOrchestrationRun(null);
              setReport(null);
            }}
          />
          <AgentTimeline trace={trace} loading={loading} />
        </div>

        <RiskAnalysisPanel risk={risk} loading={analyzingRisk} error={riskError} />

        <RouteComparison routeAnalysis={routeAnalysis} selectedRouteId={selectedRouteId} loading={routing} error={routeError} onSelect={setSelectedRouteId} />
        <QuotePreviewPanel quote={quotePreview} loading={quoteLoading} error={quoteError} />
        <FirewallPolicyPanel
          policy={policy}
          evaluation={firewallEvaluation}
          loading={firewallLoading}
          error={firewallError}
          rawTransaction={rawTransaction}
          onPolicyChange={(nextPolicy) => {
            setPolicy(nextPolicy);
            setFirewallEvaluation(null);
            setOrchestrationRun(null);
          }}
          onRawTransactionChange={(nextTransaction) => {
            setRawTransaction(nextTransaction);
            setFirewallEvaluation(null);
            setOrchestrationRun(null);
          }}
          onEvaluate={() => evaluateFirewall()}
        />
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
          canCreate={Boolean(
            intent &&
              risk &&
              routeAnalysis &&
              selectedRouteId &&
              firewallEvaluation &&
              (mode === "Simulation Only" || canAnchor)
          )}
          onChainReady={canAnchor}
          creating={creatingReport}
          report={report}
          txState={txState}
          onModeChange={changeMode}
          onCreate={generateReport}
        />
      </aside>
      </div>
      </div>
      </section>
    </main>
  );
}

function CryptoStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "success" | "warning" | "danger" }) {
  return (
    <div className="relative px-1 py-2 text-white">
      <div
        className={cn(
          "absolute left-0 top-2 h-9 w-px",
          tone === "danger" ? "bg-red-300/70" : tone === "warning" ? "bg-amber-300/70" : "bg-[#7eed61]/75"
        )}
      />
      <div className={cn("ml-4 flex items-center gap-2 text-[11px] font-black uppercase", tone === "danger" ? "text-red-200" : tone === "warning" ? "text-amber-200" : "text-[#a8ff8d]")}>
        {icon}
        {label}
      </div>
      <div className="ml-4 mt-1 text-xl font-black capitalize text-white">{value}</div>
    </div>
  );
}

function HeroMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="truncate text-2xl font-black text-[#7eed61]">{value}</div>
      <div className="mt-1 text-xs font-bold text-white/50">{label}</div>
    </div>
  );
}

function WorkflowProgress({
  intent,
  risk,
  routeAnalysis,
  firewallEvaluation,
  report
}: {
  intent: DeFiIntent | null;
  risk: RiskAnalysis | null;
  routeAnalysis: RouteAnalysis | null;
  firewallEvaluation: FirewallEvaluation | null;
  report: SentinelReport | null;
}) {
  const steps = [
    { label: "Ask", compactLabel: "Ask", complete: true },
    { label: "Parse", compactLabel: "Parse", complete: Boolean(intent) },
    { label: "Analyze", compactLabel: "Risk", complete: Boolean(risk) },
    { label: "Recommend", compactLabel: "Route", complete: Boolean(routeAnalysis) },
    { label: "Firewall", compactLabel: "Guard", complete: Boolean(firewallEvaluation) },
    { label: "Save", compactLabel: "Save", complete: Boolean(report) }
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const progress = Math.max(0, Math.min(100, ((completedCount - 1) / (steps.length - 1)) * 100));

  return (
    <div className="relative py-4 text-white">
      <div className="absolute left-4 right-4 top-7 h-px bg-white/12" />
      <div className="absolute left-4 top-7 h-px bg-[#7eed61]/80 shadow-[0_0_18px_rgba(126,237,97,0.42)]" style={{ width: `calc((100% - 2rem) * ${progress / 100})` }} />
      <div className="relative grid grid-cols-6">
        {steps.map((step, index) => (
          <div key={step.label} className="flex flex-col items-center gap-2 px-1">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold backdrop-blur", step.complete ? "border-[#7eed61] bg-[#7eed61] text-black shadow-[0_0_18px_rgba(126,237,97,0.28)]" : "border-white/15 bg-[#07130f] text-white/35")}>
              {step.complete ? <CheckCircle2 size={13} /> : index + 1}
            </span>
            <span className={cn("text-center text-[10px] font-bold sm:text-xs", step.complete ? "text-white/85" : "text-white/35")}>
              <span className="sm:hidden">{step.compactLabel}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentTimeline({ trace, loading }: { trace: AgentResult[]; loading: boolean }) {
  const expected = ["IntentAgent", "RiskAgent", "RouteAgent", "ReportAgent", "VerificationAgent"];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 text-white shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur">
      <div className="text-[11px] font-black uppercase text-[#a8ff8d]">Agent mesh</div>
      <h2 className="mt-1 font-black text-white">Analysis trace</h2>
      <div className="mt-4 space-y-3">
        {expected.map((agent) => {
          const item = trace.find((entry) => entry.agentName === agent);
          const active = loading && !item && agent === "IntentAgent";
          return (
            <div key={agent} className="flex gap-3 border-b border-white/8 py-3 last:border-b-0">
              <div className={cn("mt-0.5 text-white/40", item?.status === "completed" && "text-[#a8ff8d]", item?.status === "warning" && "text-amber-200")}>
                {active ? <Loader2 className="animate-spin" size={18} /> : item ? <CheckCircle2 size={18} /> : <Bot size={18} />}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{agent}</div>
                <p className="mt-1 text-xs leading-5 text-white/50">
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
