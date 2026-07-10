import { decodeFunctionData, isAddress, parseAbi, type Hex } from "viem";
import type { DecodedTransaction, RawTransactionInput } from "@sentinelmesh/shared";

const erc20Abi = parseAbi([
  "function approve(address spender,uint256 amount)",
  "function transfer(address to,uint256 amount)",
  "function transferFrom(address from,address to,uint256 amount)"
]);

const UINT256_MAX = (1n << 256n) - 1n;

export function decodeRawTransaction(transaction: RawTransactionInput): DecodedTransaction {
  const contractAddress = transaction.to && isAddress(transaction.to) ? transaction.to : undefined;
  const base = {
    contractAddress,
    isUnlimitedApproval: false,
    riskNotes: [] as string[]
  };

  if (!transaction.data || transaction.data === "0x") {
    return {
      ...base,
      kind: "unknown",
      functionName: "native-transfer-or-empty-call",
      riskNotes: ["No calldata was supplied, so SentinelMesh cannot decode contract intent."]
    };
  }

  try {
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: transaction.data as Hex
    });

    if (decoded.functionName === "approve") {
      const [spender, amount] = decoded.args;
      const isUnlimitedApproval = amount === UINT256_MAX;
      return {
        ...base,
        kind: "erc20-approve",
        functionName: "approve",
        spender,
        amountRaw: amount.toString(),
        isUnlimitedApproval,
        riskNotes: [
          `ERC-20 approval grants ${spender} permission to spend ${transaction.tokenSymbol ?? "this token"}.`,
          isUnlimitedApproval
            ? "Allowance equals uint256.max, which is treated as unlimited approval risk."
            : "Allowance is finite, but spender trust should still be reviewed."
        ]
      };
    }

    if (decoded.functionName === "transfer") {
      const [recipient, amount] = decoded.args;
      return {
        ...base,
        kind: "erc20-transfer",
        functionName: "transfer",
        recipient,
        amountRaw: amount.toString(),
        isUnlimitedApproval: false,
        riskNotes: [`ERC-20 transfer sends tokens directly to ${recipient}.`]
      };
    }

    const [owner, recipient, amount] = decoded.args;
    return {
      ...base,
      kind: "erc20-transfer-from",
      functionName: "transferFrom",
      owner,
      recipient,
      amountRaw: amount.toString(),
      isUnlimitedApproval: false,
      riskNotes: ["transferFrom spends from another owner allowance; verify caller authorization and allowance scope."]
    };
  } catch {
    return {
      ...base,
      kind: "unknown",
      functionName: "unknown",
      riskNotes: ["Calldata did not match the v0 ERC-20 decoder allowlist."]
    };
  }
}

export function decodedAction(decoded: DecodedTransaction, tokenSymbol?: string) {
  if (decoded.kind === "erc20-approve") {
    return `Approve ${decoded.spender ?? "spender"} to spend ${tokenSymbol ?? "token"}${decoded.isUnlimitedApproval ? " with unlimited allowance" : ""}`;
  }
  if (decoded.kind === "erc20-transfer") {
    return `Transfer ${tokenSymbol ?? "token"} to ${decoded.recipient ?? "recipient"}`;
  }
  if (decoded.kind === "erc20-transfer-from") {
    return `Transfer ${tokenSymbol ?? "token"} from ${decoded.owner ?? "owner"} to ${decoded.recipient ?? "recipient"}`;
  }
  return "Unknown contract call";
}
