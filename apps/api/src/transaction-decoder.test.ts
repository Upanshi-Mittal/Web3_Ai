import assert from "node:assert/strict";
import test from "node:test";
import { decodeRawTransaction } from "./transaction-decoder.js";

const unlimitedApproval =
  "0x095ea7b3000000000000000000000000000000000000000000000000000000000000deadffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

test("decodes ERC-20 unlimited approval calldata", () => {
  const decoded = decodeRawTransaction({
    to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    data: unlimitedApproval,
    tokenSymbol: "USDC"
  });

  assert.equal(decoded.kind, "erc20-approve");
  assert.equal(decoded.functionName, "approve");
  assert.equal(decoded.spender?.toLowerCase(), "0x000000000000000000000000000000000000dead");
  assert.equal(decoded.isUnlimitedApproval, true);
});

test("returns unknown for unsupported calldata", () => {
  const decoded = decodeRawTransaction({ data: "0x12345678" });
  assert.equal(decoded.kind, "unknown");
  assert.equal(decoded.isUnlimitedApproval, false);
});
