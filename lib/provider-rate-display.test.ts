import { describe, expect, it } from "vitest";
import { getDisplayProviderRate } from "./provider-rate-display";

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
