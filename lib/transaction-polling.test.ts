import { describe, expect, it } from "vitest"
import { TransactionStatus, TransactionType } from "../types/db"
import {
  ACTIVE_ACTIVITY_POLL_INTERVAL_MS,
  ACTIVE_ACTIVITY_WINDOW_MS,
  AGING_ACTIVITY_POLL_INTERVAL_MS,
  AGING_ACTIVITY_WINDOW_MS,
  DEFAULT_PENDING_TRANSACTION_POLL_INTERVAL_MS,
  getActivityRefetchInterval,
  getTransactionRefetchInterval,
  IDLE_ACTIVITY_POLL_INTERVAL_MS,
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

  it("polls other pending transaction types", () => {
    expect(
      getTransactionRefetchInterval({
        type: TransactionType.TRANSFER_OUT,
        status: TransactionStatus.PENDING,
      }),
    ).toBe(DEFAULT_PENDING_TRANSACTION_POLL_INTERVAL_MS)
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

  it("uses fast activity polling only while a transaction is pending", () => {
    const now = new Date("2026-08-08T12:00:00.000Z").getTime()
    expect(
      getActivityRefetchInterval(
        [
          {
            status: TransactionStatus.PENDING,
            createdAt: new Date(now - ACTIVE_ACTIVITY_WINDOW_MS + 1),
          },
        ],
        now,
      ),
    ).toBe(ACTIVE_ACTIVITY_POLL_INTERVAL_MS)
  })

  it("backs off while a pending transaction is aging", () => {
    const now = new Date("2026-08-08T12:00:00.000Z").getTime()
    expect(
      getActivityRefetchInterval(
        [
          {
            status: TransactionStatus.PENDING,
            createdAt: new Date(now - ACTIVE_ACTIVITY_WINDOW_MS - 1),
          },
        ],
        now,
      ),
    ).toBe(AGING_ACTIVITY_POLL_INTERVAL_MS)
  })

  it("does not fast-poll stale pending records forever", () => {
    const now = new Date("2026-08-08T12:00:00.000Z").getTime()
    expect(
      getActivityRefetchInterval(
        [
          {
            status: TransactionStatus.PENDING,
            createdAt: new Date(now - AGING_ACTIVITY_WINDOW_MS - 1),
          },
        ],
        now,
      ),
    ).toBe(IDLE_ACTIVITY_POLL_INTERVAL_MS)
  })

  it("backs off activity polling when every transaction is terminal", () => {
    expect(
      getActivityRefetchInterval([
        { status: TransactionStatus.COMPLETED },
        { status: TransactionStatus.FAILED },
      ]),
    ).toBe(IDLE_ACTIVITY_POLL_INTERVAL_MS)
  })
})
