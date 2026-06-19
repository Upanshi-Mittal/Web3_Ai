"use client";

import { AlertTriangle, BadgeCheck, CheckCircle2, ExternalLink, FileCheck2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import type { SentinelReport } from "@sentinelmesh/shared";
import { getDefaultNetwork, getExplorerTxUrl, hydrateNetworkMetadata, placeholderNetworks, sentinelReportRegistryAbi } from "@sentinelmesh/web3";
import { api } from "@/lib/api";
import { cn, riskColor, shortHash } from "@/lib/format";

export function ReportDetail({ id }: { id: string }) {
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const registryAddress = process.env.NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const [network] = hydrateNetworkMetadata(placeholderNetworks, {
    registryAddress,
    explorerTxUrlTemplate: process.env.NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE ?? process.env.NEXT_PUBLIC_EXPLORER_BASE_URL,
    explorerLabel: process.env.NEXT_PUBLIC_EXPLORER_LABEL
  });
  const reportNetwork = network ?? getDefaultNetwork(placeholderNetworks);

  useEffect(() => {
    api
      .getReport(id)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [id]);

  async function verify() {
    if (!report) return;
    setVerifying(true);
    setError(null);
    try {
      const onChainHash = await readOnChainReportHash({
        publicClient,
        registryAddress,
        report
      });
      const result = await api.verifyReport(report.id, { onChainHash });
      setReport(result.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify report");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return <Panel><Loader2 className="animate-spin text-teal" /> Loading report...</Panel>;
  }

  if (error && !report) {
    return <Panel><AlertTriangle className="text-danger" /> {error}</Panel>;
  }

  if (!report) {
    return <Panel><AlertTriangle className="text-warning" /> Report not found.</Panel>;
  }

  const explorerUrl = getExplorerTxUrl(report.chainTxHash, reportNetwork.explorer?.txUrlTemplate);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-rose-200">{error}</div>
      )}
      <div className="rounded-lg border border-white/10 bg-panel/92 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", riskColor(report.riskLevel))}>
                {report.riskLevel} {report.riskScore}/100
              </span>
              <span className="rounded-md border border-violet/30 bg-violet/10 px-2 py-1 text-xs text-violet">
                {report.recommendedRoute.recommendedRoute}
              </span>
              <span className={cn("rounded-md border px-2 py-1 text-xs", report.verificationStatus === "verified" ? "border-success/30 bg-success/10 text-success" : "border-white/10 text-slate-300")}>
                {report.verificationStatus}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-white">{report.originalPrompt}</h1>
            <p className="mt-2 text-sm text-slate-400">Created {new Date(report.createdAt).toLocaleString()}</p>
          </div>
          <button
            onClick={verify}
            disabled={verifying || !registryAddress || !report.userAddress}
            className="inline-flex items-center gap-2 rounded-md bg-teal px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {verifying ? <Loader2 className="animate-spin" size={16} /> : <BadgeCheck size={16} />}
            Verify Hash
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-white/10 bg-panel/92 p-5">
          <h2 className="font-semibold text-white">Parsed Intent</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {Object.entries({
              Action: report.parsedIntent.action,
              Amount: report.parsedIntent.amount ?? "-",
              "Token In": report.parsedIntent.tokenIn ?? "-",
              "Token Out": report.parsedIntent.tokenOut ?? "-",
              Chain: report.parsedIntent.chain ?? "-",
              Priority: report.parsedIntent.priority
            }).map(([key, value]) => (
              <div key={key} className="rounded-md border border-white/10 bg-slate-950/40 p-3">
                <dt className="text-xs text-slate-500">{key}</dt>
                <dd className="mt-1 font-medium text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-lg border border-white/10 bg-panel/92 p-5">
          <h2 className="font-semibold text-white">Verification</h2>
          {(!registryAddress || !report.userAddress) && (
            <p className="mt-3 rounded-md border border-white/10 bg-slate-950/40 p-3 text-xs leading-5 text-slate-400">
              Registry verification needs a deployed registry address and a wallet address saved on the report. Local-only reports still keep a deterministic hash.
            </p>
          )}
          <div className="mt-4 space-y-3 text-sm">
            <HashRow label="Report hash" value={shortHash(report.reportHash)} />
            <HashRow label="Report URI" value={report.reportURI} />
            <HashRow label="Tx hash" value={shortHash(report.chainTxHash)} />
            {explorerUrl && (
              <a className="inline-flex items-center gap-2 text-teal underline" href={explorerUrl} target="_blank" rel="noreferrer">
                Open explorer
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-white/10 bg-panel/92 p-5">
        <h2 className="font-semibold text-white">Risk Factors</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {report.riskFactorExplanations.map((factor) => (
            <div key={factor.key} className="rounded-md border border-white/10 bg-slate-950/40 p-4">
              <div className="flex justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">{factor.label}</h3>
                <span className="text-xs text-slate-300">{factor.score}/100</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">{factor.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-panel/92 p-5">
        <h2 className="font-semibold text-white">Agent Trace</h2>
        <div className="mt-4 grid gap-3">
          {report.agentTrace.map((agent, index) => (
            <div key={`${agent.agentName}-${index}`} className="rounded-md border border-white/10 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 className={agent.status === "warning" ? "text-warning" : "text-success"} size={17} />
                  {agent.agentName}
                </div>
                <span className="text-xs text-slate-400">{Math.round(agent.confidence * 100)}% confidence</span>
              </div>
              <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-400">
                {agent.reasoning.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-panel/92 p-6 text-slate-300">{children}</div>;
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-slate-950/40 p-3">
      <span className="text-slate-500">{label}</span>
      <span className="break-all text-right text-white">{value}</span>
    </div>
  );
}

async function readOnChainReportHash({
  publicClient,
  registryAddress,
  report
}: {
  publicClient: ReturnType<typeof usePublicClient>;
  registryAddress?: `0x${string}`;
  report: SentinelReport;
}) {
  if (!registryAddress) {
    throw new Error("NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS is not configured");
  }
  if (!report.userAddress) {
    throw new Error("Report does not include a wallet address to verify against");
  }
  if (!publicClient) {
    throw new Error("No public client is available for registry verification");
  }

  const reports = await publicClient.readContract({
    address: registryAddress,
    abi: sentinelReportRegistryAbi,
    functionName: "getUserReports",
    args: [report.userAddress as `0x${string}`]
  });
  const match = [...reports].reverse().find((item) => item.reportURI === report.reportURI || item.reportHash === report.reportHash);

  if (!match) {
    throw new Error("No matching on-chain registry report was found for this wallet");
  }

  return match.reportHash;
}
