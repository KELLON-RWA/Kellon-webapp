import { describe, expect, it } from "vitest"
import { TransactionStatus } from "../types/db"
import { recordTransactionStatuses } from "./transaction-status-sync"

describe("transaction balance synchronization", () => {
  it("does not treat initial query hydration as a status change", () => {
    const statuses = new Map()

    expect(
      recordTransactionStatuses(statuses, {
        id: "transaction-1",
        status: TransactionStatus.PENDING,
      }),
    ).toBe(false)
  })

  it("detects a transaction status transition", () => {
    const statuses = new Map()
    recordTransactionStatuses(statuses, {
      id: "transaction-1",
      status: TransactionStatus.PENDING,
    })

    expect(
      recordTransactionStatuses(statuses, {
        id: "transaction-1",
        status: TransactionStatus.COMPLETED,
      }),
    ).toBe(true)
  })

  it("does not refetch for repeated responses with the same status", () => {
    const statuses = new Map()
    recordTransactionStatuses(statuses, [
      { id: "transaction-1", status: TransactionStatus.PENDING },
    ])

    expect(
      recordTransactionStatuses(statuses, [
        { id: "transaction-1", status: TransactionStatus.PENDING },
      ]),
    ).toBe(false)
  })
})
