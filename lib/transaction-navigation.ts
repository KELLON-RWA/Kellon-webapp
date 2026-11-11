import type { Transaction } from "@/types/db"
import { transactionService } from "@/services/api/transactions"
import { getTransactionHash } from "@/lib/dashboard-utils"

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

export interface ResolveFlowTransactionParams {
  transactionId?: string | null
  txHash?: string | null
  groupId?: string | null
  type?: string | string[]
  symbol?: string | null
  amount?: number | string | null
  maxAttempts?: number
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidTransactionId(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id.trim())
}

export function findMatchingTransaction(
  transactions: Transaction[],
  params: ResolveFlowTransactionParams,
): Transaction | null {
  if (!transactions.length) return null

  // 1. Direct ID match if valid
  if (isValidTransactionId(params.transactionId)) {
    const directMatch = transactions.find((t) => t.id === params.transactionId)
    if (directMatch) return directMatch
  }

  // 2. Hash match
  const targetHash = params.txHash?.trim().toLowerCase()
  if (targetHash) {
    const hashMatch = transactions.find((t) => {
      const h = getTransactionHash(t)?.toLowerCase()
      return (
        h &&
        (h === targetHash ||
          h.includes(targetHash) ||
          targetHash.includes(h))
      )
    })
    if (hashMatch) return hashMatch
  }

  // 3. Group / Job ID match (for bridges)
  const targetGroupId = params.groupId?.trim().toLowerCase()
  if (targetGroupId) {
    const groupMatch = transactions.find((t) => {
      const meta = t.metadata as Record<string, unknown> | null
      const metaGroupId = (
        meta?.groupId ||
        meta?.jobId ||
        meta?.bridgeGroupId ||
        t.providerReference
      )
        ?.toString()
        .toLowerCase()
      return (
        metaGroupId &&
        (metaGroupId === targetGroupId ||
          metaGroupId.includes(targetGroupId) ||
          targetGroupId.includes(metaGroupId))
      )
    })
    if (groupMatch) return groupMatch
  }

  // 4. Recent transaction fallback (created within last 5 minutes)
  const now = Date.now()
  const recentCandidates = transactions.filter((t) => {
    const age = now - new Date(t.createdAt).getTime()
    return !Number.isNaN(age) && age >= 0 && age < 5 * 60 * 1000
  })

  const types = params.type
    ? (Array.isArray(params.type) ? params.type : [params.type]).map((t) =>
        t.toUpperCase(),
      )
    : null

  const targetSymbol = params.symbol?.trim().toUpperCase()
  const targetAmountNum =
    params.amount !== undefined && params.amount !== null
      ? Number(params.amount)
      : null

  const candidateMatches = recentCandidates.filter((t) => {
    if (types && !types.includes(t.type.toUpperCase())) return false
    if (targetSymbol && t.symbol.toUpperCase() !== targetSymbol) return false
    if (targetAmountNum !== null && Number.isFinite(targetAmountNum)) {
      const tAmountNum = Number(t.amount)
      if (
        Number.isFinite(tAmountNum) &&
        Math.abs(tAmountNum - targetAmountNum) > 0.0001
      ) {
        return false
      }
    }
    return true
  })

  if (candidateMatches.length > 0) {
    candidateMatches.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    return candidateMatches[0]
  }

  return null
}

export async function resolveFlowTransactionId(
  params: ResolveFlowTransactionParams,
): Promise<string | null> {
  if (isValidTransactionId(params.transactionId)) {
    return params.transactionId
  }

  const maxAttempts = params.maxAttempts ?? 3

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await transactionService.getTransactions()
      const transactions = response.data || []
      const match = findMatchingTransaction(transactions, params)
      if (match?.id) {
        return match.id
      }
    } catch {
      // Retry on network glitch
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    }
  }

  return null
}

