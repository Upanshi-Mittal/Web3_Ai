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
import { LazyAppControlPlane3D } from "@/components/hero/LazyAppControlPlane3D";

const loop = ["Ask", "Parse", "Analyze", "Recommend", "Verify", "Save", "Share"];

export default function LandingPage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-[#1e341a] px-3 py-5 sm:px-5 sm:py-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(126,239,97,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(126,239,97,0.05)_1px,transparent_1px)] bg-[length:46px_46px]" />
        <div className="relative mx-auto max-w-7xl rounded-[28px] border border-[#7eed61]/70 bg-black shadow-[0_0_24px_rgba(126,239,97,0.70),0_0_86px_rgba(126,239,97,0.38)]">
          <div className="relative min-h-[calc(100svh-7rem)] overflow-hidden rounded-[27px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_44%,rgba(126,239,97,0.18),transparent_28%),linear-gradient(90deg,rgba(0,0,0,0.98)_0%,rgba(0,0,0,0.94)_43%,rgba(7,27,16,0.74)_100%)]" />
            <div className="absolute inset-y-20 right-0 w-full max-w-4xl opacity-95">
              <LazyAppControlPlane3D />
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.90)_45%,rgba(0,0,0,0.38)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(126,239,97,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(126,239,97,0.035)_1px,transparent_1px)] bg-[length:38px_38px]" />

            <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
              <Link href="/" className="flex items-center gap-3 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#7eed61]/45 bg-[#102a21] text-[#7eed61] shadow-[0_0_22px_rgba(126,239,97,0.24)]">
                  <ShieldCheck size={21} />
                </span>
                <span className="text-xl font-black tracking-wide">SentinelMesh</span>
              </Link>
              <nav className="hidden items-center gap-7 text-sm font-semibold text-white/70 lg:flex">
                <a href="#features" className="hover:text-[#7eed61]">Features</a>
                <a href="#loop" className="hover:text-[#7eed61]">Workflow</a>
                <a href="#trust" className="hover:text-[#7eed61]">Trust</a>
              </nav>
              <div className="flex items-center gap-2">
                <Link href="/reports" className="hidden rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/80 hover:border-[#7eed61]/60 hover:text-[#7eed61] sm:inline-flex">
                  Reports
                </Link>
                <Link href="/app" className="inline-flex items-center gap-2 rounded-full bg-[#7eed61] px-5 py-2.5 text-xs font-black text-black shadow-[0_0_24px_rgba(126,239,97,0.35)] transition hover:-translate-y-0.5">
                  Launch app
                  <ArrowRight size={15} />
                </Link>
              </div>
            </header>

            <div className="relative z-10 grid min-h-[calc(100svh-13rem)] items-center gap-8 px-5 pb-12 pt-10 sm:px-8 lg:grid-cols-[0.78fr_1fr] lg:px-12">
              <div className="max-w-2xl">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#7eed61]/40 bg-[#7eed61]/10 px-3 py-1.5 text-xs font-bold text-[#a8ff8d]">
                    AI orchestration layer
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/75">
                    Testnet · non-custodial
                  </span>
                </div>
                <h1 className="mt-7 text-5xl font-black leading-[1.03] text-white [text-shadow:0_0_28px_rgba(126,239,97,0.16)] sm:text-7xl">
                  Pre-signing firewall for DeFi wallets and agents
                </h1>
                <p className="mt-6 max-w-xl text-base font-medium leading-8 text-white/80 sm:text-lg">
                  SentinelMesh turns a plain-English DeFi intent into a coordinated agent run: parse, score, route, simulate, enforce policy, and save verifiable evidence before signing.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/app"
                    className="inline-flex min-w-56 items-center justify-center gap-2 rounded-full bg-[#7eed61] px-7 py-4 text-sm font-black text-black shadow-[0_0_30px_rgba(126,239,97,0.36)] transition hover:-translate-y-0.5"
                  >
                    Enter control plane
                    <ArrowRight size={17} />
                  </Link>
                  <Link
                    href="/agent-wallet"
                    className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/5 px-6 py-4 text-sm font-bold text-white hover:border-[#7eed61]/55 hover:text-[#a8ff8d]"
                  >
                    Agent demo
                    <Bot size={17} />
                  </Link>
                </div>
                <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-white/10 pt-6">
                  <DarkMetric value="5" label="Agents" />
                  <DarkMetric value="7" label="Risk signals" />
                  <DarkMetric value="0" label="Custody" />
                </div>
              </div>

              <div className="relative hidden min-h-[420px] lg:block" aria-hidden="true">
                <div className="absolute bottom-8 right-8 w-72 rounded-lg border border-[#7eed61]/25 bg-black/55 p-4 text-white shadow-[0_0_40px_rgba(126,239,97,0.14)] backdrop-blur">
                  <div className="flex items-center justify-between text-xs font-bold text-[#a8ff8d]">
                    ORCHESTRATOR
                    <span>ALLOW</span>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] text-white/60">
                    {["IntentAgent parsed swap", "RiskAgent scored 15/100", "Firewall gate passed"].map((item) => (
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

      <section id="loop" className="bg-white/65 py-14">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <div>
            <div className="eyebrow">Product loop</div>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold text-ink">From natural-language intent to signed evidence.</h2>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted">
              Judges can see the 3D mesh first, then run the actual workflow: parse, score, recommend, firewall, save, and verify.
            </p>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section id="features" className="bg-emerald-50/45 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="eyebrow">One review surface</div>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-ink">Policy checks before signatures.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted">
              Every decision stays inspectable: decoded action, weighted factors, route tradeoffs, policy violations, evidence hash, and registry proof.
            </p>
          </div>
          <div className="mt-9 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 lg:grid-cols-6">
            {[
              ["Intent intelligence", "Editable structured parsing with deterministic fallback.", Bot],
              ["Explainable scoring", "Seven visible signals with weighted risk factors.", CircleGauge],
              ["Route comparison", "Pros, tradeoffs, impact, gas, and execution mode.", Route],
              ["Policy firewall", "Allow, warn, or block before a wallet or agent signs.", LockKeyhole],
              ["Agent guardrails", "Pause risky autonomous actions and require human approval.", Bot],
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

      <section id="trust" className="border-y border-border py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <div className="eyebrow">Trust boundary</div>
            <h2 className="mt-3 text-3xl font-semibold text-ink">User-controlled by design.</h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              SentinelMesh provides risk analysis, policy checks, and testnet evidence. It never takes custody, never silently executes a swap, and never promises guaranteed MEV protection.
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
            <h2 className="mt-2 text-2xl font-semibold">Check policy before the wallet prompt.</h2>
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

function DarkMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-black text-[#7eed61]">{value}</div>
      <div className="mt-1 text-xs font-semibold text-white/60">{label}</div>
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
