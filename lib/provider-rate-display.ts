function normalizeProviderName(providerName: string): string {
  return providerName
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Formats provider quote data for display without changing the raw rate used
 * when an order is submitted. Centiiv buy quotes return a crypto-per-fiat
 * value, so the user-facing fiat-per-crypto rate is derived from the quote.
 */
export function getDisplayProviderRate(
  providerName: string,
  rawRate: number | null | undefined,
  fiatAmount: number | null | undefined,
  cryptoAmount: number | null | undefined,
): number | null {
  if (normalizeProviderName(providerName) !== "centiiv") {
    return rawRate && rawRate > 0 ? rawRate : null;
  }

  if (fiatAmount && fiatAmount > 0 && cryptoAmount && cryptoAmount > 0) {
    const effectiveRate = fiatAmount / cryptoAmount;
    return Number.isFinite(effectiveRate) ? effectiveRate : null;
  }

  return rawRate && rawRate > 0 ? rawRate : null;
}
