import { ProductSettings } from "@/components/product-settings";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="eyebrow">Runtime policy</div>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Product settings</h1>
        <p className="mt-2 text-sm text-muted">Control local defaults without weakening the testnet-only safety boundary.</p>
      </div>
      <ProductSettings />
    </main>
  );
}
