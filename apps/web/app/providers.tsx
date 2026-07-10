"use client";

import "@rainbow-me/rainbowkit/styles.css";
import {
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
  connectorsForWallets,
  createAuthenticationAdapter,
  darkTheme,
  type AuthenticationStatus
} from "@rainbow-me/rainbowkit";
import { metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { createSiweMessage } from "viem/siwe";
import { supportedChains } from "@sentinelmesh/web3";
import { api, type AuthUser } from "@/lib/api";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

const transports = {
  [supportedChains[0].id]: http(),
  [supportedChains[1].id]: http()
};
const connectors = walletConnectProjectId
  ? connectorsForWallets(
      [
        {
          groupName: "Recommended",
          wallets: [metaMaskWallet, walletConnectWallet]
        }
      ],
      {
        appName: "SentinelMesh",
        appDescription: "Multi-agent DeFi risk copilot with verifiable testnet reports",
        appUrl: "https://sentinelmesh.app",
        projectId: walletConnectProjectId
      }
    )
  : [injected()];

const config = createConfig({
  chains: supportedChains,
  connectors,
  transports,
  ssr: true
});

type SentinelAuthContextValue = {
  status: AuthenticationStatus;
  user?: AuthUser;
};

const SentinelAuthContext = createContext<SentinelAuthContextValue>({ status: "loading" });

export function useSentinelAuth() {
  return useContext(SentinelAuthContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [authStatus, setAuthStatus] = useState<AuthenticationStatus>("loading");
  const [authUser, setAuthUser] = useState<AuthUser>();

  const refreshSession = useCallback(async () => {
    try {
      const session = await api.getAuthSession();
      setAuthUser(session.user);
      setAuthStatus(session.authenticated ? "authenticated" : "unauthenticated");
    } catch {
      setAuthUser(undefined);
      setAuthStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const authAdapter = useMemo(
    () =>
      createAuthenticationAdapter<string>({
        getNonce: async () => (await api.getAuthNonce()).nonce,
        createMessage: ({ nonce, address, chainId }) =>
          createSiweMessage({
            address,
            chainId,
            domain: window.location.host,
            expirationTime: new Date(Date.now() + 5 * 60_000),
            issuedAt: new Date(),
            nonce,
            statement: "Sign in to SentinelMesh to create wallet-owned risk reports. This request does not trigger a transaction.",
            uri: window.location.origin,
            version: "1"
          }),
        verify: async ({ message, signature }) => {
          try {
            const result = await api.verifyAuth(normalizeSiweMessage(message), normalizeSignature(signature));
            setAuthUser(result.user);
            setAuthStatus("authenticated");
            return true;
          } catch {
            setAuthUser(undefined);
            setAuthStatus("unauthenticated");
            return false;
          }
        },
        signOut: async () => {
          await api.logout().catch(() => undefined);
          setAuthUser(undefined);
          setAuthStatus("unauthenticated");
        }
      }),
    []
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SentinelAuthContext.Provider value={{ status: authStatus, user: authUser }}>
          <RainbowKitAuthenticationProvider adapter={authAdapter} status={authStatus}>
            <RainbowKitProvider
              theme={darkTheme({
                accentColor: "#7eed61",
                accentColorForeground: "#07130f",
                borderRadius: "medium",
                overlayBlur: "small"
              })}
            >
              {children}
            </RainbowKitProvider>
          </RainbowKitAuthenticationProvider>
        </SentinelAuthContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function normalizeSiweMessage(message: unknown) {
  if (typeof message === "string") return message;
  if (message && typeof message === "object") {
    const maybeMessage = message as { message?: unknown; toMessage?: () => string; prepareMessage?: () => string };
    if (typeof maybeMessage.message === "string") return maybeMessage.message;
    if (typeof maybeMessage.prepareMessage === "function") return maybeMessage.prepareMessage();
    if (typeof maybeMessage.toMessage === "function") return maybeMessage.toMessage();
  }
  return String(message ?? "");
}

function normalizeSignature(signature: unknown) {
  return typeof signature === "string" ? signature : String(signature ?? "");
}
