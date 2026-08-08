/**
 * Returns an existing provider order during verification retries.
 *
 * Re-running the provider initializer can create another payout order and send
 * another OTP. Only the on-chain funding operation should be retried once an
 * order has already been created.
 */
export async function getOrCreateOfframpOrder<T>(
  existingOrder: T | null | undefined,
  createOrder: () => Promise<T>,
): Promise<T> {
  return existingOrder ?? createOrder()
}
