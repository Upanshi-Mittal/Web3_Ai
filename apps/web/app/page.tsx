import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Bot, Database, FileCheck2, ShieldCheck, WalletCards } from "lucide-react";

const loop = ["Ask", "Parse", "Analyze", "Recommend", "Verify", "Save", "Share"];

export default function LandingPage() {
  return (
    <main>
            <section className="relative overflow-hidden border-b border-white/10">
  <div className="mx-auto flex min-h-[calc(100vh-66px)] max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">

    <div className="max-w-4xl text-center">

  {/* Badge */}
  <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-teal-400/25 bg-teal/10 px-5 py-2.5 backdrop-blur-md">
    <ShieldCheck size={17} className="text-teal-300" />
    <span className="text-sm font-medium tracking-wide border-teal text-teal">
      Multi-Agent DeFi Risk Copilot
    </span>
  </div>

  {/* Heading */}
  <h1 className="text-6xl font-black tracking-[-0.06em] text-white sm:text-7xl lg:text-8xl">
    Sentinel
    <span className="text-white/95">Mesh</span>
  </h1>

  {/* Description */}
  <p className="mx-auto mt-8 max-w-3xl text-xl leading-10 text-slate-400 sm:text-2xl">
    Transform natural-language DeFi intents into
    <span className="font-medium text-white">
      {" "}explainable risk analysis
    </span>,
    safer execution routes, and
    <span className="font-medium text-teal-300">
      {" "}cryptographically verifiable reports.
    </span>
  </p>

  {/* Buttons */}
  <div className="mt-12 flex flex-wrap justify-center gap-5">

    <Link
      href="/app"
      className="group inline-flex items-center gap-3 rounded-xl bg-teal px-7 py-4 text-base font-semibold text-slate-950 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_35px_rgba(45,212,191,0.35)]"
    >
      Open Copilot

      <ArrowRight
        size={20}
        className="transition-transform duration-300 group-hover:translate-x-1"
      />
    </Link>

    <Link
      href="/reports"
      className="inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.03] px-7 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:border-white/30 hover:bg-white/[0.05]"
    >
      View Reports
    </Link>

  </div>

  {/* Chips */}
  <div className="mt-14 flex flex-wrap justify-center gap-3">

    {loop.map((item) => (

      <span
        key={item}
        className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-teal-400/40 hover:bg-teal-400/10 hover:text-teal-300"
      >
        {item}
      </span>

    ))}

  </div>

</div>

  </div>
</section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Intent parser", "Converts plain English into editable DeFi intent fields.", Bot],
            ["Risk engine", "Scores slippage, liquidity, price impact, token, gas, route, and MEV signals.", ShieldCheck],
            ["Report registry", "Stores only report hashes on testnet; it never executes swaps.", Database],
            ["Verification", "Checks local report hash against the anchored hash.", FileCheck2]
          ].map(([title, body, Icon]) => (
            <div key={String(title)} className="rounded-lg border border-white/10 bg-panel/86 p-5">
              <Icon className="mb-4 text-teal" size={24} />
              <h2 className="font-semibold text-white">{String(title)}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{String(body)}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-violet/25 bg-violet/10 p-5 text-sm leading-6 text-slate-300">
          <div className="mb-2 flex items-center gap-2 font-semibold text-violet">
            <WalletCards size={18} />
            V0 safety boundary
          </div>
          SentinelMesh recommends routes and anchors risk reports. It does not claim guaranteed MEV protection, does not custody funds, and does not execute mainnet swaps.
        </div>
      </section>
    </main>
  );
}