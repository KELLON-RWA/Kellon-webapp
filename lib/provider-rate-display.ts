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
  const isCentiiv = normalizeProviderName(providerName) === "centiiv";
  if (isCentiiv && fiatAmount && fiatAmount > 0 && cryptoAmount && cryptoAmount > 0) {
    const effectiveRate = fiatAmount / cryptoAmount;
    return Number.isFinite(effectiveRate) ? effectiveRate : null;
  }

  if (rawRate && rawRate > 0) {
    return rawRate;
  }

  if (fiatAmount && fiatAmount > 0 && cryptoAmount && cryptoAmount > 0) {
    const effectiveRate = fiatAmount / cryptoAmount;
    return Number.isFinite(effectiveRate) ? effectiveRate : null;
  }

  return null;
}

export interface ProviderRateLike {
  cryptoAmount?: number | null;
  fiatAmount?: number | null;
  rawRate?: number | null;
}

/**
 * Returns a normalized score for a provider's quote where a HIGHER score
 * always means a BETTER rate for the user regardless of whether buying or selling.
 *
 * - Buy: The user wants either the highest cryptoAmount or the lowest fiat-per-crypto rate.
 * - Withdraw/Sell: The user wants either the highest fiatAmount or highest fiat-per-crypto rate.
 */
export function getProviderRateScore(
  providerName: string,
  rateDetails: ProviderRateLike | null | undefined,
  mode: "buy" | "withdraw" | "sell" = "buy",
): number | null {
  if (!rateDetails) return null;

  const isBuy = mode === "buy";

  // If specific receive amounts are available from quote
  if (isBuy && rateDetails.cryptoAmount && rateDetails.cryptoAmount > 0) {
    return rateDetails.cryptoAmount;
  }
  if (!isBuy && rateDetails.fiatAmount && rateDetails.fiatAmount > 0) {
    return rateDetails.fiatAmount;
  }

  // Fallback to display rate
  const displayRate = getDisplayProviderRate(
    providerName,
    rateDetails.rawRate,
    rateDetails.fiatAmount,
    rateDetails.cryptoAmount,
  );

  if (!displayRate || displayRate <= 0) return null;

  // In buy mode, lower displayRate (fiat per crypto) is better -> 1 / displayRate (crypto per fiat) is higher
  // In withdraw/sell mode, higher displayRate (fiat per crypto) is better
  return isBuy ? 1 / displayRate : displayRate;
}

/**
 * Returns the provider ID with the strictly best rate among providers,
 * but ONLY if there is more than one provider and at least one valid rate.
 */
export function getBestRateProviderId<T extends { id: string; name: string }>(
  providers: T[],
  providerRates: Record<string, ProviderRateLike | null | undefined>,
  mode: "buy" | "withdraw" | "sell" = "buy",
): string | null {
  if (!providers || providers.length <= 1) return null;

  let bestId: string | null = null;
  let bestScore = -Infinity;

  for (const provider of providers) {
    const rate = providerRates[provider.id];
    const score = getProviderRateScore(provider.name, rate, mode);
    if (score !== null && score > bestScore) {
      bestScore = score;
      bestId = provider.id;
    }
  }

  return bestScore > -Infinity && bestScore > 0 ? bestId : null;
}

/**
 * Sorts providers so the one with the best rate comes first.
 * If there are more than 1 provider:
 * 1. Providers with higher rate scores come before lower rate scores.
 * 2. Providers with rates come before providers without rates.
 * 3. Fallback to isRecommended or original order.
 */
export function sortProvidersByRate<
  T extends { id: string; name: string; isRecommended?: boolean },
>(
  providers: T[],
  providerRates: Record<string, ProviderRateLike | null | undefined>,
  mode: "buy" | "withdraw" | "sell" = "buy",
): T[] {
  if (!providers || providers.length <= 1) return providers;

  return [...providers].sort((a, b) => {
    const scoreA = getProviderRateScore(a.name, providerRates[a.id], mode);
    const scoreB = getProviderRateScore(b.name, providerRates[b.id], mode);

    const hasScoreA = scoreA !== null && scoreA > 0;
    const hasScoreB = scoreB !== null && scoreB > 0;

    if (hasScoreA && hasScoreB) {
      if (scoreA !== scoreB) {
        return (scoreB as number) - (scoreA as number); // Descending (highest score first)
      }
    } else if (hasScoreA) {
      return -1;
    } else if (hasScoreB) {
      return 1;
    }

    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;

    return 0;
  });
}
