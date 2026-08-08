import { describe, expect, it } from "vitest"
import { TransactionStatus, TransactionType } from "../types/db"
import {
  getTransactionRefetchInterval,
  ONRAMP_POLL_INTERVAL_MS,
  WITHDRAWAL_POLL_INTERVAL_MS,
} from "./transaction-polling"

describe("transaction detail polling", () => {
  it("polls pending withdrawals every two seconds", () => {
    expect(
      getTransactionRefetchInterval({
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.PENDING,
      }),
    ).toBe(WITHDRAWAL_POLL_INTERVAL_MS)
  })

  it("keeps the slower on-ramp polling interval", () => {
    expect(
      getTransactionRefetchInterval({
        type: TransactionType.BUY,
        status: TransactionStatus.PENDING,
      }),
    ).toBe(ONRAMP_POLL_INTERVAL_MS)
  })

  it.each([
    TransactionStatus.COMPLETED,
    TransactionStatus.FAILED,
    TransactionStatus.CANCELLED,
    TransactionStatus.REFUNDED,
  ])("stops polling terminal status %s", (status) => {
    expect(
      getTransactionRefetchInterval({ type: TransactionType.WITHDRAW, status }),
    ).toBe(false)
  })
})
