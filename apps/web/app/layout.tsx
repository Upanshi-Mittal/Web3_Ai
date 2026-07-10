import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Bot, FileText, Settings2, ShieldCheck } from "lucide-react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelMesh",
  description: "AI transaction firewall for DeFi users and autonomous agents"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen mesh-grid">
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07130f]/90 text-white backdrop-blur-xl">
              <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-2.5 text-sm font-bold text-white">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#102a21] text-[#a8ff8d] shadow-[0_0_18px_rgba(126,237,97,0.18)]">
                    <ShieldCheck size={19} />
                  </span>
                  <span>SentinelMesh</span>
                  <span className="hidden rounded border border-[#7eed61]/25 bg-[#7eed61]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#a8ff8d] sm:inline">TESTNET</span>
                </Link>
                <nav className="flex items-center gap-1 text-sm text-white/60">
                  <Link aria-label="Firewall" className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-[#7eed61]/10 hover:text-[#a8ff8d] sm:px-3" href="/app">
                    <Activity size={16} />
                    <span className="hidden sm:inline">Firewall</span>
                  </Link>
                  <Link aria-label="Agent wallet" className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-[#7eed61]/10 hover:text-[#a8ff8d] sm:px-3" href="/agent-wallet">
                    <Bot size={16} />
                    <span className="hidden sm:inline">Agent</span>
                  </Link>
                  <Link aria-label="Reports" className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-[#7eed61]/10 hover:text-[#a8ff8d] sm:px-3" href="/reports">
                    <FileText size={16} />
                    <span className="hidden sm:inline">Reports</span>
                  </Link>
                  <Link aria-label="Settings" className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 hover:bg-[#7eed61]/10 hover:text-[#a8ff8d] sm:px-3" href="/settings">
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
