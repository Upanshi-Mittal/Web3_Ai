"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { placeholderNetworks } from "@sentinelmesh/web3";

const config = getDefaultConfig({
  appName: "SentinelMesh",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "sentinelmesh-local-dev",
  chains: placeholderNetworks.map((network) => network.chain) as [typeof placeholderNetworks[number]["chain"], ...Array<typeof placeholderNetworks[number]["chain"]>],
  ssr: true
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#2dd4bf", borderRadius: "small" })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
