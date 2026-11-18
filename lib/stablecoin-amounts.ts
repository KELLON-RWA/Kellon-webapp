/** Minimum US-dollar value accepted for USDC and USDT deposit and withdrawal flows. */
export const MIN_STABLECOIN_AMOUNT = 1;

/** Minimum fiat amount required for buy/on-ramp flows by currency. */
export const MIN_FIAT_BUY_AMOUNT: Record<string, number> = {
  NGN: 5000,
  default: 5,
};

export function getMinFiatBuyAmount(currency?: string | null): number {
  if (!currency) return MIN_FIAT_BUY_AMOUNT.default;
  const key = currency.trim().toUpperCase();
  return MIN_FIAT_BUY_AMOUNT[key] ?? MIN_FIAT_BUY_AMOUNT.default;
}

/** Suggested quick amount tiers by currency for the buy/on-ramp flow. */
export function getQuickBuyAmounts(currency?: string | null): number[] {
  if (currency?.trim().toUpperCase() === "NGN") {
    return [5000, 10000, 25000, 50000, 100000, 250000];
  }
  return [10, 25, 50, 100, 250, 500];
}

/** USDC and USDT use six decimal places on their supported networks. */
export const STABLECOIN_DECIMALS = 6;

const STABLECOIN_SCALE = 10 ** STABLECOIN_DECIMALS;

/**
 * Compares stablecoin amounts at their on-chain precision instead of using a
 * binary floating-point comparison. This keeps a displayed Max amount valid.
 */
export function isStablecoinAmountWithinBalance(
  amount: number,
  balance: number,
): boolean {
  if (!Number.isFinite(amount) || !Number.isFinite(balance)) return false;

  return (
    Math.round(amount * STABLECOIN_SCALE) <=
    Math.round(balance * STABLECOIN_SCALE)
  );
}
