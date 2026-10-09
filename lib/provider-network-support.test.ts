import { describe, expect, it } from "vitest";
import {
  supportsProviderAsset,
  supportsProviderNetwork,
} from "@/lib/provider-network-support";

describe("supportsProviderNetwork", () => {
  it("limits Paycrest to its supported networks for both on- and off-ramp", () => {
    for (const flow of ["buy", "sell"] as const) {
      for (const network of ["Base", "BNB", "Celo", "Polygon", "Solana"]) {
        expect(supportsProviderNetwork("Paycrest", network, flow)).toBe(true);
      }

      for (const network of ["Arc", "Stellar"]) {
        expect(supportsProviderNetwork("Paycrest", network, flow)).toBe(false);
      }
    }
  });

  it("limits Paycrest to USDC and USDT", () => {
    expect(supportsProviderAsset("Paycrest", "USDC")).toBe(true);
    expect(supportsProviderAsset("Paycrest", "USDT")).toBe(true);
    expect(supportsProviderAsset("Paycrest", "XLM")).toBe(false);
  });

  it("limits Centiiv on-ramp support to Arc, Solana, and Stellar", () => {
    for (const network of ["Arc", "Solana", "Stellar"]) {
      expect(supportsProviderNetwork("Centiiv", network, "buy")).toBe(true);
    }

    for (const network of ["Base", "BNB Smart Chain", "Celo", "Polygon"]) {
      expect(supportsProviderNetwork("Centiiv", network, "buy")).toBe(false);
    }
  });

  it("leaves Centiiv off-ramp availability to the provider service", () => {
    expect(supportsProviderNetwork("Centiiv", "Base", "sell")).toBe(true);
  });
});
