import { describe, expect, it } from "vitest";
import { calculateRwaYieldProjection, getRwaApy, RWA_BENCHMARK_APYS } from "./rwa-yield";

describe("rwa-yield", () => {
  it("resolves benchmark APYs for tokenized bond ETFs and treasury bills", () => {
    expect(getRwaApy("SGOV")).toBe(5.12);
    expect(getRwaApy("SGOVon")).toBe(5.12);
    expect(getRwaApy("TLT")).toBe(4.42);
    expect(getRwaApy("TLTon")).toBe(4.42);
    expect(getRwaApy("FXI")).toBe(2.85);
    expect(getRwaApy("FXIon")).toBe(2.85);
    expect(getRwaApy("gNTB")).toBe(14.5);
    expect(getRwaApy("GNT")).toBe(14.5);
  });

  it("calculates accurate monthly and annual compound yield projections", () => {
    // $5,000 at 5.12% APY (SGOV)
    const sgovProjection = calculateRwaYieldProjection({ amount: 5000, apy: 5.12 });
    expect(sgovProjection.amount).toBe(5000);
    expect(sgovProjection.apy).toBe(5.12);
    // Monthly return: (5000 * 0.0512) / 12 = 21.333...
    expect(sgovProjection.monthlyReturn).toBeCloseTo(21.33, 2);
    // Annual return: 5000 * ((1 + 0.0512/12)^12 - 1) = 262.093...
    expect(sgovProjection.annualReturn).toBeCloseTo(262.09, 1);

    // $5,000 at 14.50% APY (gNTB)
    const gntbProjection = calculateRwaYieldProjection({ amount: 5000, apy: 14.5 });
    expect(gntbProjection.monthlyReturn).toBeCloseTo(60.42, 2);
    expect(gntbProjection.annualReturn).toBeCloseTo(775.18, 1);
  });

  it("handles zero or negative inputs cleanly without NaN", () => {
    const zeroProj = calculateRwaYieldProjection({ amount: 0, apy: 5.12 });
    expect(zeroProj.monthlyReturn).toBe(0);
    expect(zeroProj.annualReturn).toBe(0);

    const zeroApyProj = calculateRwaYieldProjection({ amount: 1000, apy: 0 });
    expect(zeroApyProj.monthlyReturn).toBe(0);
    expect(zeroApyProj.annualReturn).toBe(0);
  });
});
