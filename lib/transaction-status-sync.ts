import type { Transaction } from "../types/db"

type TransactionStatusRecord = Pick<Transaction, "id" | "status">

function isTransactionStatusRecord(
  value: unknown,
): value is TransactionStatusRecord {
  if (!value || typeof value !== "object") return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "string" && typeof candidate.status === "string"
  )
}

/**
 * Records the latest known status and reports only real status transitions.
 * Initial query hydration is deliberately not treated as a transition.
 */
export function recordTransactionStatuses(
  previousStatuses: Map<string, Transaction["status"]>,
  data: unknown,
): boolean {
  const records = Array.isArray(data) ? data : [data]
  let hasStatusChange = false

  records.forEach((record) => {
    if (!isTransactionStatusRecord(record)) return

    const previousStatus = previousStatuses.get(record.id)
    if (previousStatus !== undefined && previousStatus !== record.status) {
      hasStatusChange = true
    }
    previousStatuses.set(record.id, record.status)
  })

  return hasStatusChange
}
