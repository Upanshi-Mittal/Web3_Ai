import type { Metadata } from "next";
import Link from "next/link";
import { Activity, FileText, Settings2, ShieldCheck } from "lucide-react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelMesh",
  description: "Multi-agent DeFi risk copilot with verifiable report registry"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen mesh-grid">
            <header className="sticky top-0 z-30 border-b border-border/90 bg-white/85 backdrop-blur-xl">
              <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-2.5 text-sm font-bold text-ink">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-emerald-200 shadow-sm">
                    <ShieldCheck size={19} />
                  </span>
                  <span>SentinelMesh</span>
                  <span className="hidden rounded border border-teal/20 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal sm:inline">TESTNET</span>
                </Link>
                <nav className="flex items-center gap-1 text-sm text-muted">
                  <Link aria-label="Copilot" className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-emerald-50 hover:text-ink sm:px-3" href="/app">
                    <Activity size={16} />
                    <span className="hidden sm:inline">Copilot</span>
                  </Link>
                  <Link aria-label="Reports" className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-emerald-50 hover:text-ink sm:px-3" href="/reports">
                    <FileText size={16} />
                    <span className="hidden sm:inline">Reports</span>
                  </Link>
                  <Link aria-label="Settings" className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-emerald-50 hover:text-ink sm:px-3" href="/settings">
                    <Settings2 size={16} />
                    <span className="hidden sm:inline">Settings</span>
                  </Link>
                </nav>
              </div>
            </header>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
