"use client";

import { AlertTriangle, BadgeCheck, Clock, Download, FileText, Link2, Loader2, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SentinelReport } from "@sentinelmesh/shared";
import { api } from "@/lib/api";
import { cn, riskColor, shortHash } from "@/lib/format";

export function ReportsList() {
  const [reports, setReports] = useState<SentinelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SentinelReport["verificationStatus"] | "all">("all");
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null);

  useEffect(() => {
    api
      .listReports()
      .then(setReports)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) => {
      const statusMatches = statusFilter === "all" || report.verificationStatus === statusFilter;
      const textMatches =
        normalized.length === 0 ||
        report.originalPrompt.toLowerCase().includes(normalized) ||
        report.parsedIntent.tokenIn?.toLowerCase().includes(normalized) ||
        report.parsedIntent.tokenOut?.toLowerCase().includes(normalized) ||
        report.reportHash.toLowerCase().includes(normalized);
      return statusMatches && textMatches;
    });
  }, [query, reports, statusFilter]);

  const counts = useMemo(
    () => ({
      total: reports.length,
      verified: reports.filter((report) => report.verificationStatus === "verified").length,
      local: reports.filter((report) => report.verificationStatus === "local-only").length,
      pending: reports.filter((report) => report.verificationStatus === "pending").length
    }),
    [reports]
  );

  if (loading) {
    return <State icon={<Loader2 className="animate-spin" />} title="Loading reports" body="Reading local API storage." />;
  }

  if (error) {
    return <State icon={<AlertTriangle />} title="Could not load reports" body={error} tone="danger" />;
  }

  if (reports.length === 0) {
    return (
      <State
        icon={<FileText />}
        title="No reports yet"
        body="Run the copilot flow and generate a report to populate history."
        action={<Link className="mt-4 inline-flex rounded-md bg-teal px-4 py-2 text-sm font-semibold text-slate-950" href="/app">Open Copilot</Link>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Summary label="Total" value={counts.total} />
        <Summary label="Verified" value={counts.verified} tone="success" />
        <Summary label="Local-only" value={counts.local} />
        <Summary label="Pending" value={counts.pending} tone="warning" />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-panel/92 p-4 md:flex-row md:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
          <Search size={16} className="text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prompt, token, or hash"
            className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="rounded-md border border-white/10 bg-panel2 px-3 py-2 text-sm text-white"
        >
          <option value="all">All statuses</option>
          <option value="verified">Verified</option>
          <option value="local-only">Local-only</option>
          <option value="pending">Pending</option>
          <option value="mismatch">Mismatch</option>
        </select>
      </div>

      {filteredReports.length === 0 ? (
        <State icon={<Search />} title="No matching reports" body="Try a different prompt, token, hash, or status filter." />
      ) : (
        <div className="grid gap-4">
          {filteredReports.map((report) => (
            <div key={report.id} className="rounded-lg border border-white/10 bg-panel/92 p-5 transition hover:border-teal/35 hover:bg-panel">
              <Link href={`/reports/${report.id}`} className="block">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", riskColor(report.riskLevel))}>
                        {report.riskLevel} {report.riskScore}/100
                      </span>
                      <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">
                        {report.recommendedRoute.recommendedRoute}
                      </span>
                      <Status status={report.verificationStatus} />
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-white">{report.originalPrompt}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(report.createdAt).toLocaleString()}
                      </span>
                      <span>{shortHash(report.reportHash)}</span>
                    </div>
                  </div>
                  <ShieldCheck className="text-teal" size={22} />
                </div>
              </Link>
              <button
                onClick={() => {
                  copyReportLink(report.id);
                  setCopiedReportId(report.id);
                  window.setTimeout(() => setCopiedReportId(null), 1600);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-teal/40 hover:text-white"
              >
                <Link2 size={14} />
                {copiedReportId === report.id ? "Copied" : "Copy link"}
              </button>
              <button
                onClick={() => downloadReport(report)}
                className="ml-2 mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-teal/40 hover:text-white"
              >
                <Download size={14} />
                Download JSON
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Status({ status }: { status: SentinelReport["verificationStatus"] }) {
  const verified = status === "verified";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
        verified ? "border-success/30 bg-success/10 text-success" : "border-white/10 bg-white/[0.04] text-slate-300"
      )}
    >
      <BadgeCheck size={13} />
      {status}
    </span>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel/92 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold text-white", tone === "success" && "text-success", tone === "warning" && "text-warning")}>
        {value}
      </div>
    </div>
  );
}

function copyReportLink(reportId: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  void navigator.clipboard.writeText(`${origin}/reports/${reportId}`);
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

function State({
  icon,
  title,
  body,
  action,
  tone
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <div className={cn("rounded-lg border bg-panel/92 p-8 text-center", tone === "danger" ? "border-danger/30" : "border-white/10")}>
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-teal">
        {icon}
      </div>
      <h2 className="mt-4 font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{body}</p>
      {action}
    </div>
  );
}
