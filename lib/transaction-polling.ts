import { TransactionStatus, type Transaction } from "../types/db"

export const WITHDRAWAL_POLL_INTERVAL_MS = 2_000
export const ONRAMP_POLL_INTERVAL_MS = 5_000
export const ACTIVITY_POLL_INTERVAL_MS = 3_000
export const WALLET_BALANCE_REFRESH_INTERVAL_MS = 5_000

const TERMINAL_STATUSES: Transaction["status"][] = [
  TransactionStatus.COMPLETED,
  TransactionStatus.FAILED,
  TransactionStatus.CANCELLED,
  TransactionStatus.REFUNDED,
]

/** Polls only transactions whose status can still change in the current flow. */
export function getTransactionRefetchInterval(
  transaction?: Pick<Transaction, "type" | "status">,
): number | false {
  if (!transaction || TERMINAL_STATUSES.includes(transaction.status)) {
    return false
  }

  if (transaction.type === "WITHDRAW") {
    // PAID is already rendered as successful for withdrawals.
    return transaction.status === "PAID" ? false : WITHDRAWAL_POLL_INTERVAL_MS
  }

  return transaction.type === "BUY" ? ONRAMP_POLL_INTERVAL_MS : false
}

export function isTerminalTransactionStatus(
  status: Transaction["status"],
): boolean {
  return TERMINAL_STATUSES.includes(status)
}
