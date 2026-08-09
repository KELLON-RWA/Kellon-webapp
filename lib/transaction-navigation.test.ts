import { describe, expect, it } from "vitest"
import {
  getTransactionDetailsPath,
  shouldReturnHomeFromTransaction,
} from "./transaction-navigation"

describe("transaction detail navigation", () => {
  it("marks transaction details opened from a transaction flow", () => {
    expect(getTransactionDetailsPath("transaction/123", "flow")).toBe(
      "/transactions/transaction%2F123?origin=flow",
    )
  })

  it("keeps ordinary transaction links history-aware", () => {
    expect(getTransactionDetailsPath("transaction-123")).toBe(
      "/transactions/transaction-123",
    )
    expect(shouldReturnHomeFromTransaction(undefined)).toBe(false)
  })

  it("returns home only for transaction-flow navigation", () => {
    expect(shouldReturnHomeFromTransaction("flow")).toBe(true)
    expect(shouldReturnHomeFromTransaction("transactions")).toBe(false)
  })
})
