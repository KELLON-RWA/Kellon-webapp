import { getUnderlyingTicker } from "./stock-catalog";
import type { StockListing } from "@/services/api/stocks";

/**
 * Benchmark Annual Percentage Yield (APY) registry for Real World Assets (RWAs).
 * Reflects actual institutional underlying yields (Treasury bills, sovereign debt, bond ETFs).
 */
export const RWA_BENCHMARK_APYS: Record<string, number> = {
  // Direct Sovereign Treasury Bills
  GNT: 14.5,
  GNTB: 14.5,

  // US Treasury & Bond ETFs (Ondo / Backed / PancakeSwap tokenized)
  SGOV: 5.12, // iShares 0-3 Month Treasury Bond ETF (30-day SEC yield)
  TLT: 4.42, // iShares 20+ Year Treasury Bond ETF
  FXI: 2.85, // iShares China Large-Cap ETF (Distribution yield)
  SHY: 4.55, // iShares 1-3 Year Treasury Bond ETF
  IEF: 4.38, // iShares 7-10 Year Treasury Bond ETF
  BIL: 5.08, // SPDR Bloomberg 1-3 Month T-Bill ETF
  BND: 4.52, // Vanguard Total Bond Market ETF
  AGG: 4.5, // iShares Core U.S. Aggregate Bond ETF

  // Commodities (Capital appreciation)
  GLD: 0.0,
  SLV: 0.0,
  IAU: 0.0,
  USO: 0.0,
};

export function getRwaApy(listingOrTicker: StockListing | string): number {
  if (!listingOrTicker) return 4.5;

  if (typeof listingOrTicker !== "string") {
    // If backend already provided an APY on the listing object
    if (listingOrTicker.apy !== undefined) {
      const parsed = Number(listingOrTicker.apy);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  const raw =
    typeof listingOrTicker === "string"
      ? getUnderlyingTicker(listingOrTicker)
      : listingOrTicker.ticker ||
        getUnderlyingTicker(listingOrTicker.symbol, listingOrTicker.provider);

  const normalized = (raw || "").trim().toUpperCase();
  return RWA_BENCHMARK_APYS[normalized] ?? 4.5;
}

export interface RwaYieldProjection {
  amount: number;
  apy: number;
  monthlyReturn: number;
  annualReturn: number;
}

/**
 * Calculates accurate monthly and annual yield projections based on APY.
 * Returns exact currency returns formatted for institutional and retail vaults.
 */
export function calculateRwaYieldProjection({
  amount,
  apy,
}: {
  amount: number;
  apy: number;
}): RwaYieldProjection {
  const principal = Math.max(0, amount);
  const rate = Math.max(0, apy) / 100;

  if (principal === 0 || rate === 0) {
    return {
      amount: principal,
      apy,
      monthlyReturn: 0,
      annualReturn: 0,
    };
  }

  // Monthly yield: standard monthly accrual = principal * (rate / 12)
  const monthlyReturn = (principal * rate) / 12;

  // Annual yield compounded monthly = principal * ((1 + rate/12)^12 - 1)
  const annualReturn = principal * (Math.pow(1 + rate / 12, 12) - 1);

  return {
    amount: principal,
    apy,
    monthlyReturn,
    annualReturn,
  };
}
