import { ReportDetail } from "@/components/report-detail";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="sentinel-dark-page px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <ReportDetail id={id} />
      </div>
    </main>
  );
}
