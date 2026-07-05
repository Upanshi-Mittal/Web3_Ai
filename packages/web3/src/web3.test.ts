import assert from "node:assert/strict";
import test from "node:test";
import { hydrateNetworkMetadata, placeholderNetworks } from "./index.js";

test("registry metadata is exposed only on the configured chain", () => {
  const registryAddress = "0x1111111111111111111111111111111111111111" as const;
  const networks = hydrateNetworkMetadata(placeholderNetworks, {
    registryAddress,
    registryChainId: 84532,
    explorerTxUrlTemplate: "https://sepolia.basescan.org/tx/{txHash}"
  });

  assert.equal(networks[0]?.registryAddress, registryAddress);
  assert.equal(networks[1]?.registryAddress, undefined);
  assert.equal(networks[1]?.explorer, undefined);
});
