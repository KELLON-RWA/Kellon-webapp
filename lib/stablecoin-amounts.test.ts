import { describe, expect, it } from "vitest";
import { isStablecoinAmountWithinBalance } from "./stablecoin-amounts";

describe("isStablecoinAmountWithinBalance", () => {
  it("accepts a Max amount represented with floating-point residue", () => {
    expect(
      isStablecoinAmountWithinBalance(2.430275, 2.4302749999999995),
    ).toBe(true);
  });

  it("rejects an amount that exceeds the six-decimal balance", () => {
    expect(isStablecoinAmountWithinBalance(2.430276, 2.430275)).toBe(false);
  });
});
