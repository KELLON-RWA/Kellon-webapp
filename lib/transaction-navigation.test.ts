import { describe, expect, it, vi } from "vitest"
import {
  findMatchingTransaction,
  getTransactionDetailsPath,
  isValidTransactionId,
  resolveFlowTransactionId,
  shouldReturnHomeFromTransaction,
} from "./transaction-navigation"
import { transactionService } from "@/services/api/transactions"
import type { Transaction } from "@/types/db"

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

  it("validates UUID transaction IDs correctly", () => {
    expect(
      isValidTransactionId("3b619c95-fd09-43aa-9d8e-bcdf504f2914"),
    ).toBe(true)
    expect(isValidTransactionId("not-a-uuid")).toBe(false)
    expect(isValidTransactionId("0x123456789abcdef")).toBe(false)
    expect(isValidTransactionId(null)).toBe(false)
  })

  it("finds matching transaction by hash", () => {
    const mockTx = {
      id: "3b619c95-fd09-43aa-9d8e-bcdf504f2914",
      type: "TRANSFER_OUT",
      symbol: "USDC",
      amount: "2.734881",
      createdAt: new Date(),
      metadata: { txHash: "0xabcdef123456" },
    } as unknown as Transaction

    const match = findMatchingTransaction([mockTx], {
      txHash: "0xabcdef123456",
    })
    expect(match?.id).toBe("3b619c95-fd09-43aa-9d8e-bcdf504f2914")
  })

  it("finds matching bridge transaction by groupId", () => {
    const mockTx = {
      id: "7c829e12-aa11-44bb-99cc-eeff00112233",
      type: "BRIDGE",
      symbol: "USDC",
      amount: "5.0",
      createdAt: new Date(),
      metadata: { groupId: "bridge-grp-999" },
    } as unknown as Transaction

    const match = findMatchingTransaction([mockTx], {
      groupId: "bridge-grp-999",
      type: "BRIDGE",
    })
    expect(match?.id).toBe("7c829e12-aa11-44bb-99cc-eeff00112233")
  })

  it("finds recent matching transaction by type, symbol, and amount fallback", () => {
    const mockTx = {
      id: "11111111-2222-3333-4444-555555555555",
      type: "TRANSFER_OUT",
      symbol: "USDC",
      amount: -2.734881, // Negative amount as stored by debits / transfer-out
      createdAt: new Date(Date.now() - 5000), // 5 seconds ago
    } as unknown as Transaction

    const match = findMatchingTransaction([mockTx], {
      type: "TRANSFER_OUT",
      symbol: "USDC",
      amount: 2.734881,
    })
    expect(match?.id).toBe("11111111-2222-3333-4444-555555555555")
  })

  it("finds matching transaction even with minor clock skew ahead", () => {
    const mockTx = {
      id: "22222222-3333-4444-5555-666666666666",
      type: "TRANSFER",
      symbol: "USDC",
      amount: "-2.734881",
      createdAt: new Date(Date.now() + 2000), // Server timestamp 2 seconds ahead
    } as unknown as Transaction

    const match = findMatchingTransaction([mockTx], {
      type: "TRANSFER_OUT",
      symbol: "USDC",
      amount: 2.734881,
    })
    expect(match?.id).toBe("22222222-3333-4444-5555-666666666666")
  })

  it("finds matching transaction by userOpHash", () => {
    const mockTx = {
      id: "33333333-4444-5555-6666-777777777777",
      type: "TRANSFER_OUT",
      symbol: "USDC",
      amount: "2.734881",
      createdAt: new Date(),
      userOpHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    } as unknown as Transaction

    const match = findMatchingTransaction([mockTx], {
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    })
    expect(match?.id).toBe("33333333-4444-5555-6666-777777777777")
  })

  it("resolves direct valid transaction ID without querying API", async () => {
    const spy = vi.spyOn(transactionService, "getTransactions")
    const id = await resolveFlowTransactionId({
      transactionId: "3b619c95-fd09-43aa-9d8e-bcdf504f2914",
    })
    expect(id).toBe("3b619c95-fd09-43aa-9d8e-bcdf504f2914")
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
