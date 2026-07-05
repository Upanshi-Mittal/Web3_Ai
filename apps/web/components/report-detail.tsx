"use client";

import { AlertTriangle, BadgeCheck, CheckCircle2, Check, Copy, Download, ExternalLink, FileCheck2, Loader2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import type { SentinelReport } from "@sentinelmesh/shared";
import { findNetworkByChainId, getDefaultNetwork, getExplorerTxUrl, hydrateNetworkMetadata, placeholderNetworks, sentinelReportRegistryAbi } from "@sentinelmesh/web3";
import { api } from "@/lib/api";
import { cn, riskColor, shortHash } from "@/lib/format";
import { MarketEvidence } from "@/components/risk/MarketEvidence";

export function ReportDetail({ id }: { id: string }) {
  const [report, setReport] = useState<SentinelReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [shared, setShared] = useState(false);
  const [hashCopied, setHashCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const registryAddress = process.env.NEXT_PUBLIC_REPORT_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const registryChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
  const networks = hydrateNetworkMetadata(placeholderNetworks, {
    registryAddress,
    registryChainId,
    explorerTxUrlTemplate: process.env.NEXT_PUBLIC_EXPLORER_TX_URL_TEMPLATE ?? process.env.NEXT_PUBLIC_EXPLORER_BASE_URL,
    explorerLabel: process.env.NEXT_PUBLIC_EXPLORER_LABEL
  });
  const reportNetwork = findNetworkByChainId(networks, registryChainId) ?? getDefaultNetwork(networks);

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

  async function shareReport() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "SentinelMesh risk report",
          text: `${report?.riskLevel ?? "DeFi"} risk assessment from SentinelMesh`,
          url
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      setShared(false);
    }
  }

  async function copyReportHash() {
    if (!report) return;
    await navigator.clipboard.writeText(report.reportHash);
    setHashCopied(true);
    window.setTimeout(() => setHashCopied(false), 1600);
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
  const verification = verificationCopy(report);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-danger/20 bg-red-50 p-3 text-sm text-danger">{error}</div>
      )}
      <div className="surface rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", riskColor(report.riskLevel))}>
                {report.riskLevel} {report.riskScore}/100
              </span>
              <span className="rounded-md border border-violet/20 bg-violet/5 px-2 py-1 text-xs text-violet">
                {report.recommendedRoute.recommendedRoute}
              </span>
              <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs", verification.className)}>
                <verification.icon size={13} />
                {verification.label}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-ink">{report.originalPrompt}</h1>
            <p className="mt-2 text-sm text-muted">Created {new Date(report.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={shareReport}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-teal/40"
            >
              {shared ? <Check className="text-success" size={16} /> : <Share2 size={16} />}
              {shared ? "Link copied" : "Share report"}
            </button>
            <button
              type="button"
              onClick={() => downloadReport(report)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-teal/40"
            >
              <Download size={16} />
              Download JSON
            </button>
            <button
              type="button"
              onClick={verify}
              disabled={verifying || !registryAddress || !report.userAddress}
              className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal disabled:opacity-50"
            >
              {verifying ? <Loader2 className="animate-spin" size={16} /> : <BadgeCheck size={16} />}
              Verify hash
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="surface rounded-lg p-5">
          <div className="eyebrow">Input</div>
          <h2 className="mt-1 font-semibold text-ink">Parsed intent</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {Object.entries({
              Action: report.parsedIntent.action,
              Amount: report.parsedIntent.amount ?? "-",
              "Token In": report.parsedIntent.tokenIn ?? "-",
              "Token Out": report.parsedIntent.tokenOut ?? "-",
              Chain: report.parsedIntent.chain ?? "-",
              Priority: report.parsedIntent.priority
            }).map(([key, value]) => (
              <div key={key} className="rounded-md border border-border bg-panel2 p-3">
                <dt className="text-xs text-muted">{key}</dt>
                <dd className="mt-1 font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="surface rounded-lg p-5">
          <div className="eyebrow text-violet">Evidence</div>
          <h2 className="mt-1 font-semibold text-ink">Verification</h2>
          <div className={cn("mt-3 rounded-md border p-3 text-sm", verification.className)}>
            <div className="flex items-center gap-2 font-semibold">
              <verification.icon size={17} />
              {verification.label}
            </div>
            <p className="mt-2 text-xs leading-5">{verification.description}</p>
          </div>
          {(!registryAddress || !report.userAddress) && (
            <p className="mt-3 rounded-md border border-border bg-panel2 p-3 text-xs leading-5 text-muted">
              Registry verification needs a deployed registry address and a wallet address saved on the report. Local-only reports still keep a deterministic hash.
            </p>
          )}
          <div className="mt-4 space-y-3 text-sm">
            <HashRow
              label="Report hash"
              value={shortHash(report.reportHash)}
              action={
                <button type="button" onClick={copyReportHash} className="inline-flex items-center gap-1 text-teal underline">
                  <Copy size={13} />
                  {hashCopied ? "Copied" : "Copy"}
                </button>
              }
            />
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

      <MarketEvidence evidence={report.marketEvidence} />

      <section className="surface rounded-lg p-5">
        <div className="eyebrow">Assessment</div>
        <h2 className="mt-1 font-semibold text-ink">Risk factors</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {report.riskFactorExplanations.map((factor) => (
            <div key={factor.key} className="rounded-md border border-border bg-panel2 p-4">
              <div className="flex justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">{factor.label}</h3>
                <span className="text-xs text-muted">{factor.score}/100</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">{factor.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface rounded-lg p-5">
        <div className="eyebrow text-violet">Audit trail</div>
        <h2 className="mt-1 font-semibold text-ink">Agent trace</h2>
        <div className="mt-4 grid gap-3">
          {report.agentTrace.map((agent, index) => (
            <div key={`${agent.agentName}-${index}`} className="rounded-md border border-border bg-panel2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <CheckCircle2 className={agent.status === "warning" ? "text-warning" : "text-success"} size={17} />
                  {agent.agentName}
                </div>
                <span className="text-xs text-muted">{Math.round(agent.confidence * 100)}% confidence</span>
              </div>
              <ul className="mt-3 space-y-1 text-xs leading-5 text-muted">
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
  return <div className="surface flex items-center gap-3 rounded-lg p-6 text-muted">{children}</div>;
}

function HashRow({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-panel2 p-3">
      <span className="text-muted">{label}</span>
      <span className="flex flex-wrap items-center justify-end gap-2 break-all text-right text-ink">
        {value}
        {action}
      </span>
    </div>
  );
}

function verificationCopy(report: SentinelReport) {
  if (report.verificationStatus === "verified") {
    return {
      label: "Verified on-chain",
      description: "The local report hash matches the hash read from the registry.",
      className: "border-success/20 bg-emerald-50 text-success",
      icon: BadgeCheck
    };
  }
  if (report.verificationStatus === "mismatch") {
    return {
      label: "Hash mismatch",
      description: "The local report hash did not match the registry hash. Do not treat this report as verified.",
      className: "border-danger/20 bg-red-50 text-danger",
      icon: AlertTriangle
    };
  }
  if (report.verificationStatus === "pending") {
    return {
      label: "Verification pending",
      description: "The report has transaction metadata but still needs registry verification.",
      className: "border-warning/20 bg-amber-50 text-amber-900",
      icon: FileCheck2
    };
  }
  return {
    label: "Local-only report",
    description: "This deterministic report has not been anchored to the registry.",
    className: "border-border bg-panel2 text-muted",
    icon: FileCheck2
  };
}

function downloadReport(report: SentinelReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sentinelmesh-report-${report.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
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
