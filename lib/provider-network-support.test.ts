import { describe, expect, it } from "vitest";
import { supportsProviderNetwork } from "@/lib/provider-network-support";

describe("supportsProviderNetwork", () => {
  it("allows Paycrest on every active Kellon network", () => {
    for (const network of [
      "Stellar",
      "Base",
      "Solana",
      "Polygon",
      "Celo",
      "Arc",
      "BNB",
    ]) {
      expect(supportsProviderNetwork("Paycrest", network)).toBe(true);
    }
  });

  it("allows Centiiv on every active network except Celo", () => {
    expect(supportsProviderNetwork("Centiiv", "Celo")).toBe(false);
    expect(supportsProviderNetwork("Centiiv", "Base")).toBe(true);
    expect(supportsProviderNetwork("Centiiv", "BNB Smart Chain")).toBe(true);
  });
});
