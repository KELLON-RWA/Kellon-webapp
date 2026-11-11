import { describe, expect, it } from "vitest";
import {
  getBestRateProviderId,
  getDisplayProviderRate,
  sortProvidersByRate,
} from "./provider-rate-display";

describe("getDisplayProviderRate", () => {
  it("shows Centiiv buy quotes as fiat per crypto", () => {
    expect(
      getDisplayProviderRate("Centiiv", 0.0007, 50_000, 36.177),
    ).toBeCloseTo(1382.0936, 3);
  });

  it("keeps providers with fiat-per-crypto rates unchanged", () => {
    expect(getDisplayProviderRate("Paycrest", 1390.06, 50_000, 35.96967)).toBe(
      1390.06,
    );
  });
});

describe("sortProvidersByRate and getBestRateProviderId", () => {
  const providers = [
    { id: "centiiv-id", name: "Centiiv", isRecommended: true },
    { id: "paycrest-id", name: "Paycrest", isRecommended: false },
  ];

  it("identifies best rate and sorts in buy mode (more crypto = better)", () => {
    const rates = {
      "centiiv-id": { cryptoAmount: 36.177, fiatAmount: 50_000, rawRate: 0.0007 },
      "paycrest-id": { cryptoAmount: 35.969, fiatAmount: 50_000, rawRate: 1390.06 },
    };

    const bestId = getBestRateProviderId(providers, rates, "buy");
    expect(bestId).toBe("centiiv-id");

    const sorted = sortProvidersByRate(providers, rates, "buy");
    expect(sorted[0].id).toBe("centiiv-id");
    expect(sorted[1].id).toBe("paycrest-id");
  });

  it("identifies best rate and sorts in withdraw mode (more fiat = better)", () => {
    const rates = {
      "centiiv-id": { cryptoAmount: 100, fiatAmount: 148_000, rawRate: 1480 },
      "paycrest-id": { cryptoAmount: 100, fiatAmount: 152_000, rawRate: 1520 },
    };

    const bestId = getBestRateProviderId(providers, rates, "withdraw");
    expect(bestId).toBe("paycrest-id");

    const sorted = sortProvidersByRate(providers, rates, "withdraw");
    expect(sorted[0].id).toBe("paycrest-id");
    expect(sorted[1].id).toBe("centiiv-id");
  });

  it("returns null bestRateId if only 1 provider exists", () => {
    const single = [{ id: "single-id", name: "Paycrest" }];
    const rates = {
      "single-id": { cryptoAmount: 100, fiatAmount: 150_000, rawRate: 1500 },
    };

    expect(getBestRateProviderId(single, rates, "withdraw")).toBeNull();
    expect(sortProvidersByRate(single, rates, "withdraw")).toEqual(single);
  });

  it("falls back to recommended when rates are not available yet", () => {
    const sorted = sortProvidersByRate(providers, {}, "buy");
    expect(sorted[0].id).toBe("centiiv-id"); // isRecommended: true
  });
});
