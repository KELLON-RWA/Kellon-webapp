import { describe, expect, it } from "vitest";
import {
  getMinFiatBuyAmount,
  getQuickBuyAmounts,
  isStablecoinAmountWithinBalance,
} from "./stablecoin-amounts";

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

describe("getMinFiatBuyAmount", () => {
  it("enforces 5000 as minimum for NGN", () => {
    expect(getMinFiatBuyAmount("NGN")).toBe(5000);
    expect(getMinFiatBuyAmount("ngn")).toBe(5000);
  });

  it("defaults to 5 for non-NGN or empty currencies", () => {
    expect(getMinFiatBuyAmount("USD")).toBe(5);
    expect(getMinFiatBuyAmount(null)).toBe(5);
  });
});

describe("getQuickBuyAmounts", () => {
  it("returns tiers starting at 5000 for NGN", () => {
    const tiers = getQuickBuyAmounts("NGN");
    expect(tiers[0]).toBe(5000);
    expect(tiers.every((val) => val >= 5000)).toBe(true);
    expect(tiers).toEqual([5000, 10000, 25000, 50000, 100000, 250000]);
  });

  it("returns USD tiers for other currencies", () => {
    expect(getQuickBuyAmounts("USD")).toEqual([10, 25, 50, 100, 250, 500]);
  });
});
