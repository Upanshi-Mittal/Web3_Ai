import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Check,
  CircleGauge,
  Database,
  FileCheck2,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles
} from "lucide-react";

const loop = ["Ask", "Parse", "Analyze", "Recommend", "Verify", "Save", "Share"];

export default function LandingPage() {
  return (
    <main>
      <section className="border-b border-border/80">
        <div className="mx-auto grid min-h-[calc(100vh-66px)] max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:px-8">
          <div className="max-w-xl">
            <div className="eyebrow flex items-center gap-2">
              <Sparkles size={14} />
              Multi-agent DeFi risk intelligence
            </div>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] text-ink sm:text-7xl">
              SentinelMesh
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted">
              Turn a plain-English DeFi intent into an explainable risk score, safer route, and verifiable testnet report before signing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lift transition hover:-translate-y-0.5"
              >
                Analyze an intent
                <ArrowRight size={17} />
              </Link>
              <Link
                href="/reports"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-5 py-3 text-sm font-semibold text-ink hover:border-teal/40"
              >
                View report registry
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6 text-sm">
              <Metric value="5" label="Specialist agents" />
              <Metric value="7" label="Risk signals" />
              <Metric value="0" label="Custodied funds" />
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section className="bg-white/65 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="eyebrow">One review surface</div>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-ink">Evidence before execution.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted">
              Every recommendation stays inspectable: inputs, weighted factors, route tradeoffs, agent trace, report hash, and registry proof.
            </p>
          </div>
          <div className="mt-9 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
            {[
              ["Intent intelligence", "Editable structured parsing with deterministic fallback.", Bot],
              ["Explainable scoring", "Seven visible signals with weighted risk factors.", CircleGauge],
              ["Route comparison", "Pros, tradeoffs, impact, gas, and execution mode.", Route],
              ["On-chain evidence", "A registry hash proves the report existed unchanged.", Database]
            ].map(([title, body, Icon]) => (
              <div key={String(title)} className="bg-white p-6">
                <Icon className="text-teal" size={22} />
                <h3 className="mt-5 font-semibold text-ink">{String(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{String(body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <div className="eyebrow">Trust boundary</div>
            <h2 className="mt-3 text-3xl font-semibold text-ink">User-controlled by design.</h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              SentinelMesh provides risk analysis and testnet evidence. It never takes custody, never silently executes a swap, and never promises guaranteed MEV protection.
            </p>
            <ul className="mt-6 space-y-3">
              {["No custody or seed phrases", "No mainnet execution in v0", "Wallet confirms every registry write"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-medium text-ink">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-teal"><Check size={14} /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-ink p-2 shadow-glow">
            <Image
              src="/work-distribution.png"
              alt="SentinelMesh engineering ownership map"
              width={1400}
              height={850}
              className="h-auto w-full rounded-md"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-lg bg-ink px-6 py-7 text-white sm:px-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <LockKeyhole size={16} />
              Base Sepolia ready
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Review the route before the wallet prompt.</h2>
          </div>
          <Link href="/app" className="inline-flex items-center gap-2 rounded-md bg-emerald-200 px-5 py-3 text-sm font-semibold text-ink hover:bg-emerald-100">
            Open SentinelMesh
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function ProductPreview() {
  return (
    <div className="surface overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <ShieldCheck size={16} className="text-teal" />
          Live risk review
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-full bg-success" /> Simulation</span>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-[1.35fr_0.65fr]">
        <div className="bg-white p-5">
          <div className="rounded-md border border-border bg-panel2 p-4">
            <p className="text-xs text-muted">Intent</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-ink">Swap 0.2 ETH to USDC safely with low slippage.</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <PreviewField label="Action" value="Swap" />
            <PreviewField label="Pair" value="ETH / USDC" />
            <PreviewField label="Limit" value="0.5%" />
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink">Recommended route</p>
              <span className="rounded bg-violet/10 px-2 py-1 text-[10px] font-bold text-violet">PROTECTED</span>
            </div>
            <div className="mt-3 rounded-md border-2 border-teal/30 bg-emerald-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Protected route simulation</p>
                  <p className="mt-1 text-xs text-muted">Low impact · deep liquidity · report ready</p>
                </div>
                <BadgeCheck className="text-teal" size={22} />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-ink p-5 text-white">
          <p className="text-xs text-emerald-200">Risk score</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-6xl font-semibold">15</span>
            <span className="mb-2 text-sm text-emerald-200">Low</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[15%] rounded-full bg-emerald-300" />
          </div>
          <div className="mt-6 space-y-3">
            {["Intent parsed", "Risk analyzed", "Route compared", "Report ready"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-emerald-50">
                <FileCheck2 size={14} className="text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-border bg-panel2 px-4 py-3">
        {loop.map((item, index) => (
          <span key={item} className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
            {index > 0 && <span className="text-border">/</span>}
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-xl font-semibold text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-ink">{value}</p>
    </div>
  );
}
