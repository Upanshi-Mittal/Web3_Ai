"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { AuthenticationStatus } from "@rainbow-me/rainbowkit";
import { AlertTriangle, CheckCircle2, ExternalLink, KeyRound, Network, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { Web3NetworkMetadata } from "@sentinelmesh/web3";
import { cn } from "@/lib/format";

export function WalletConnectionPanel({
  address,
  connected,
  authStatus,
  authenticatedWallet,
  activeNetwork,
  selectedNetwork,
  adapterReady
}: {
  address?: string;
  connected: boolean;
  authStatus: AuthenticationStatus;
  authenticatedWallet: boolean;
  activeNetwork?: Web3NetworkMetadata;
  selectedNetwork: Web3NetworkMetadata;
  adapterReady: boolean;
}) {
  const aligned = !activeNetwork || activeNetwork.id === selectedNetwork.id;
  const [metaMaskInstalled, setMetaMaskInstalled] = useState(false);

  useEffect(() => {
    const ethereum = (window as unknown as {
      ethereum?: { isMetaMask?: boolean; providers?: Array<{ isMetaMask?: boolean }> };
    }).ethereum;
    setMetaMaskInstalled(Boolean(ethereum?.isMetaMask || ethereum?.providers?.some((provider) => provider.isMetaMask)));
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 text-white shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="text-[#a8ff8d]" size={18} />
          <div>
            <div className="text-[11px] font-black uppercase text-[#a8ff8d]">Signer</div>
            <h2 className="mt-1 font-black text-white">Wallet</h2>
          </div>
        </div>
        <ConnectButton />
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div>
            <div className="text-xs font-semibold text-white/50">MetaMask</div>
            <div className="mt-1 text-sm text-white">
              {metaMaskInstalled ? "Extension detected and ready" : "Extension not detected in this browser"}
            </div>
          </div>
          {metaMaskInstalled ? (
            <span className="rounded bg-[#7eed61]/12 px-2 py-1 text-xs font-semibold text-[#a8ff8d]">Ready</span>
          ) : (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-2 text-xs font-semibold text-white hover:border-[#7eed61]/40"
            >
              Install
              <ExternalLink size={13} />
            </a>
          )}
        </div>
        <StatusRow
          good={connected}
          label={connected ? "Wallet connected" : "Wallet optional"}
          value={connected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Simulation and local reports work without a wallet"}
        />
        <StatusRow
          good={authenticatedWallet}
          label="Wallet authentication"
          value={
            authenticatedWallet
              ? "SIWE signature verified with an active secure session"
              : authStatus === "loading"
                ? "Checking the current session"
                : connected
                  ? "Sign the login message to authorize wallet-owned reports"
                  : "Connect a wallet, then sign a gasless login message"
          }
          icon="key"
        />
        <StatusRow
          good={adapterReady}
          label="Registry adapter"
          value={adapterReady ? "Configured for report anchoring" : "Placeholder only until registry metadata is supplied"}
        />
        <div className={cn("rounded-xl border p-3", aligned ? "border-white/10 bg-black/20" : "border-amber-300/25 bg-amber-400/10")}>
          <div className="flex items-center gap-2 text-xs font-semibold text-white/50">
            <Network size={14} />
            Network
          </div>
          <p className="mt-2 text-white/60">
            UI target: <span className="font-semibold text-white">{selectedNetwork.label}</span>
          </p>
          {activeNetwork && (
            <p className="mt-1 text-xs text-white/50">
              Wallet chain: <span className="text-white">{activeNetwork.label}</span>
            </p>
          )}
          {!aligned && <p className="mt-2 text-xs text-amber-200">Switch the wallet network before anchoring a report.</p>}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ good, label, value, icon }: { good: boolean; label: string; value: string; icon?: "key" }) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className={cn("mt-0.5", good ? "text-[#a8ff8d]" : "text-amber-200")}>
        {good ? <CheckCircle2 size={17} /> : icon === "key" ? <KeyRound size={17} /> : <AlertTriangle size={17} />}
      </div>
      <div>
        <div className="text-xs font-semibold text-white/50">{label}</div>
        <div className="mt-1 text-sm text-white/80">{value}</div>
      </div>
    </div>
  );
}
