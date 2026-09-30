/** Minimum US-dollar value accepted for USDC and USDT deposit and withdrawal flows. */
export const MIN_STABLECOIN_AMOUNT = 1;

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
