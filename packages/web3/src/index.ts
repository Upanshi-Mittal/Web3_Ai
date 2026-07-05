import { baseSepolia, sepolia } from "viem/chains";
import type { Chain } from "viem";

export const sentinelReportRegistryAbi = [
  {
    type: "function",
    name: "createReport",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reportHash", type: "bytes32" },
      { name: "riskScore", type: "uint256" },
      { name: "recommendation", type: "string" },
      { name: "reportURI", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "getUserReports",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "user", type: "address" },
          { name: "reportHash", type: "bytes32" },
          { name: "riskScore", type: "uint256" },
          { name: "recommendation", type: "string" },
          { name: "reportURI", type: "string" },
          { name: "timestamp", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "event",
    name: "ReportCreated",
    anonymous: false,
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "reportHash", type: "bytes32", indexed: true },
      { name: "riskScore", type: "uint256", indexed: false },
      { name: "recommendation", type: "string", indexed: false },
      { name: "reportURI", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false }
    ]
  }
] as const;

export const supportedChains = [baseSepolia, sepolia] as const;

export type Web3ExecutionMode = "simulation" | "report-on-chain";
export type TransactionState = "idle" | "preparing" | "awaiting-wallet" | "submitted" | "confirming" | "confirmed" | "failed" | "skipped";

export type ExplorerAdapter = {
  label: string;
  txUrlTemplate?: string;
};

export type Web3NetworkMetadata = {
  id: string;
  chain: Chain;
  label: string;
  registryAddress?: `0x${string}`;
  explorer?: ExplorerAdapter;
  isPlaceholder: boolean;
  notes: string[];
};

export type ReportRegistryWriteInput = {
  registryAddress: `0x${string}`;
  reportHash: `0x${string}`;
  riskScore: number;
  recommendation: string;
  reportURI: string;
};

export type ReportRegistryAdapter = {
  id: string;
  label: string;
  canWrite: (network: Web3NetworkMetadata) => boolean;
  buildCreateReportArgs: (input: ReportRegistryWriteInput) => readonly [`0x${string}`, bigint, string, string];
};

export type TransactionStateSnapshot = {
  state: TransactionState;
  label: string;
  description: string;
  txHash?: `0x${string}`;
  error?: string;
};

export const placeholderNetworks: Web3NetworkMetadata[] = [
  {
    id: "base-sepolia-placeholder",
    chain: baseSepolia,
    label: "Base Sepolia",
    isPlaceholder: true,
    notes: ["Placeholder testnet adapter. Teammate Web3 metadata can replace registry and explorer values later."]
  },
  {
    id: "ethereum-sepolia-placeholder",
    chain: sepolia,
    label: "Ethereum Sepolia",
    isPlaceholder: true,
    notes: ["Placeholder testnet adapter. This is not a final supported-network commitment."]
  }
];

export const placeholderReportRegistryAdapter: ReportRegistryAdapter = {
  id: "placeholder-report-registry",
  label: "Report Registry Adapter",
  canWrite: (network) => Boolean(network.registryAddress),
  buildCreateReportArgs: (input) => [input.reportHash, BigInt(input.riskScore), input.recommendation, input.reportURI] as const
};

export function hydrateNetworkMetadata(
  networks: Web3NetworkMetadata[],
  options: {
    registryAddress?: `0x${string}`;
    registryChainId?: number;
    explorerTxUrlTemplate?: string;
    explorerLabel?: string;
  }
): Web3NetworkMetadata[] {
  return networks.map((network) => {
    const isRegistryChain = options.registryChainId === undefined || network.chain.id === options.registryChainId;
    return {
      ...network,
      registryAddress: isRegistryChain ? options.registryAddress : undefined,
      explorer: isRegistryChain
        ? {
            label: options.explorerLabel ?? "Explorer",
            txUrlTemplate: options.explorerTxUrlTemplate
          }
        : undefined
    };
  });
}

export function getDefaultNetwork(networks: Web3NetworkMetadata[]): Web3NetworkMetadata {
  const [network] = networks;
  if (!network) throw new Error("At least one Web3 network adapter is required");
  return network;
}

export function findNetworkById(networks: Web3NetworkMetadata[], id: string): Web3NetworkMetadata {
  return networks.find((network) => network.id === id) ?? getDefaultNetwork(networks);
}

export function findNetworkByChainId(networks: Web3NetworkMetadata[], chainId?: number): Web3NetworkMetadata | undefined {
  if (!chainId) return undefined;
  return networks.find((network) => network.chain.id === chainId);
}

export function getExplorerTxUrl(txHash?: string, templateOrBaseUrl?: string): string | undefined {
  if (!txHash || !templateOrBaseUrl) return undefined;
  if (templateOrBaseUrl.includes("{txHash}")) return templateOrBaseUrl.replace("{txHash}", txHash);
  return `${templateOrBaseUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

export function transactionStateCopy(snapshot: TransactionStateSnapshot): TransactionStateSnapshot {
  const defaults: Record<TransactionState, Omit<TransactionStateSnapshot, "state" | "txHash" | "error">> = {
    idle: {
      label: "Ready",
      description: "No transaction has been requested."
    },
    preparing: {
      label: "Preparing report",
      description: "Creating the local report payload and deterministic hash."
    },
    "awaiting-wallet": {
      label: "Wallet confirmation",
      description: "Review the registry transaction in your wallet."
    },
    submitted: {
      label: "Transaction submitted",
      description: "The wallet returned a transaction hash."
    },
    confirming: {
      label: "Confirming",
      description: "Waiting for the selected network to confirm the transaction."
    },
    confirmed: {
      label: "Confirmed",
      description: "The report hash was anchored and the local report was updated."
    },
    failed: {
      label: "Failed",
      description: "The transaction or report creation flow failed."
    },
    skipped: {
      label: "Local report only",
      description: "On-chain anchoring was skipped for this report."
    }
  };

  return {
    ...defaults[snapshot.state],
    ...snapshot
  };
}
