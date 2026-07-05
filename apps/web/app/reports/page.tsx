import { ReportsList } from "@/components/reports-list";

export default function ReportsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="eyebrow">Evidence ledger</div>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Report history</h1>
        <p className="mt-2 text-sm text-muted">Saved assessments with route decisions, deterministic hashes, and registry verification state.</p>
      </div>
      <ReportsList />
    </main>
  );
}
