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
    <div className="surface rounded-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="text-teal" size={18} />
          <div>
            <div className="eyebrow">Signer</div>
            <h2 className="mt-1 font-semibold text-ink">Wallet</h2>
          </div>
        </div>
        <ConnectButton />
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-panel2 p-3">
          <div>
            <div className="text-xs font-semibold text-muted">MetaMask</div>
            <div className="mt-1 text-sm text-ink">
              {metaMaskInstalled ? "Extension detected and ready" : "Extension not detected in this browser"}
            </div>
          </div>
          {metaMaskInstalled ? (
            <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-success">Ready</span>
          ) : (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-white px-2.5 py-2 text-xs font-semibold text-ink hover:border-teal/40"
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
        <div className={cn("rounded-md border p-3", aligned ? "border-border bg-panel2" : "border-warning/25 bg-amber-50")}>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted">
            <Network size={14} />
            Network
          </div>
          <p className="mt-2 text-muted">
            UI target: <span className="font-semibold text-ink">{selectedNetwork.label}</span>
          </p>
          {activeNetwork && (
            <p className="mt-1 text-xs text-muted">
              Wallet chain: <span className="text-ink">{activeNetwork.label}</span>
            </p>
          )}
          {!aligned && <p className="mt-2 text-xs text-warning">Switch the wallet network before anchoring a report.</p>}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ good, label, value, icon }: { good: boolean; label: string; value: string; icon?: "key" }) {
  return (
    <div className="flex gap-3 rounded-md border border-border bg-panel2 p-3">
      <div className={cn("mt-0.5", good ? "text-success" : "text-warning")}>
        {good ? <CheckCircle2 size={17} /> : icon === "key" ? <KeyRound size={17} /> : <AlertTriangle size={17} />}
      </div>
      <div>
        <div className="text-xs font-semibold text-muted">{label}</div>
        <div className="mt-1 text-sm text-ink">{value}</div>
      </div>
    </div>
  );
}
