"use client";

import { AlertTriangle, ArrowUpRight, BadgeCheck, Clock, FileText, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SentinelReport } from "@sentinelmesh/shared";
import { api } from "@/lib/api";
import { cn, riskColor, shortHash } from "@/lib/format";

export function ReportsList() {
  const [reports, setReports] = useState<SentinelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listReports()
      .then(setReports)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

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
    <div className="grid gap-4">
      {reports.map((report) => (
        <Link
          key={report.id}
          href={`/reports/${report.id}`}
          className="surface rounded-lg p-5 transition hover:-translate-y-0.5 hover:border-teal/35 hover:shadow-lift"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", riskColor(report.riskLevel))}>
                  {report.riskLevel} {report.riskScore}/100
                </span>
                <span className="rounded-md border border-violet/15 bg-violet/5 px-2 py-1 text-xs text-violet">
                  {report.recommendedRoute.recommendedRoute}
                </span>
                <Status status={report.verificationStatus} />
              </div>
              <h2 className="mt-3 text-lg font-semibold text-ink">{report.originalPrompt}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <Clock size={14} />
                  {new Date(report.createdAt).toLocaleString()}
                </span>
                <span>{shortHash(report.reportHash)}</span>
              </div>
            </div>
            <ArrowUpRight className="text-teal" size={20} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function Status({ status }: { status: SentinelReport["verificationStatus"] }) {
  const verified = status === "verified";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
        verified ? "border-success/20 bg-emerald-50 text-success" : "border-border bg-panel2 text-muted"
      )}
    >
      <BadgeCheck size={13} />
      {status}
    </span>
  );
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
    <div className={cn("surface rounded-lg p-8 text-center", tone === "danger" && "border-danger/30")}>
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md border border-border bg-emerald-50 text-teal">
        {icon}
      </div>
      <h2 className="mt-4 font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">{body}</p>
      {action}
    </div>
  );
}
