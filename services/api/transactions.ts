import { ApiResponse, handleResponse } from "."
import { Transaction } from "@/types/db"

// A completely safe, strict type definition for arbitrary JSON structures
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonArray
export type JsonObject = { [key: string]: JsonValue }
export type JsonArray = JsonValue[]

export interface AnnotateTransactionPayload {
  txHash: string
  chain: string
  recipientEmail?: string
  recipientTag?: string
  metadata?: JsonObject // Safe replacement for Record<string, any>
  amount?: string | number
  symbol?: string
}

/**
 * Transaction Management Service
 * Handles fetching and annotating user transactions.
 * Note: These endpoints require 'include' credentials for session-based auth.
 */
export const transactionService = {
  /**
   * GET /api/transactions
   * Retrieves all transactions linked to the current user.
   */
  getTransactions: async (): Promise<ApiResponse<Transaction[]>> => {
    const res = await fetch("/api/transactions", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
    })
    return handleResponse(res)
  },

  /**
   * GET /api/transactions/:id
   * Retrieves details for a specific transaction entry.
   */
  getTransaction: async (id: string): Promise<ApiResponse<Transaction>> => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
    })
    return handleResponse(res)
  },

  /**
   * POST /api/transactions/annotate
   * Annotates a transaction with off-chain details (recipient, metadata, etc.).
   */
  annotateTransaction: async (
    data: AnnotateTransactionPayload,
  ): Promise<ApiResponse<Transaction>> => {
    const res = await fetch("/api/transactions/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },
}
