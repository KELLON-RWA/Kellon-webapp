export type TransactionNavigationOrigin = "flow"

export function getTransactionDetailsPath(
  transactionId: string,
  origin?: TransactionNavigationOrigin,
): string {
  const path = `/transactions/${encodeURIComponent(transactionId)}`
  return origin ? `${path}?origin=${origin}` : path
}

export function shouldReturnHomeFromTransaction(origin?: string): boolean {
  return origin === "flow"
}
