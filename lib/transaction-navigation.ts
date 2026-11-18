import type { Transaction } from "@/types/db"
import { transactionService } from "@/services/api/transactions"
import { getTransactionDisplayAmount, getTransactionHash } from "@/lib/dashboard-utils"

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
      if (
        h &&
        (h === targetHash ||
          h.includes(targetHash) ||
          targetHash.includes(h))
      ) {
        return true
      }
      const uoh = t.userOpHash?.toLowerCase()
      if (
        uoh &&
        (uoh === targetHash ||
          uoh.includes(targetHash) ||
          targetHash.includes(uoh))
      ) {
        return true
      }
      const ref = t.providerReference?.toLowerCase()
      if (
        ref &&
        (ref === targetHash ||
          ref.includes(targetHash) ||
          targetHash.includes(ref))
      ) {
        return true
      }
      const meta = t.metadata as Record<string, unknown> | null
      const metaHash = (
        meta?.txHash ||
        meta?.hash ||
        meta?.transactionHash ||
        meta?.userOpHash
      )?.toString().toLowerCase()
      if (
        metaHash &&
        (metaHash === targetHash ||
          metaHash.includes(targetHash) ||
          targetHash.includes(metaHash))
      ) {
        return true
      }
      return false
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

  // 4. Candidate matching
  // Sort transactions descending by createdAt so the newest is first
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const types = params.type
    ? (Array.isArray(params.type) ? params.type : [params.type]).map((t) =>
        t.toUpperCase(),
      )
    : null

  const targetSymbol = params.symbol?.trim().toUpperCase()
  const targetAmountNum =
    params.amount !== undefined && params.amount !== null
      ? Math.abs(Number(params.amount))
      : null

  const now = Date.now()

  // Find candidate matches within recent window (15 mins, allowing 5 mins clock skew into future)
  const candidateMatches = sorted.filter((t) => {
    const txTime = new Date(t.createdAt).getTime()
    if (!Number.isNaN(txTime)) {
      const diff = now - txTime
      if (diff > 15 * 60 * 1000 || diff < -5 * 60 * 1000) {
        return false
      }
    }

    if (types) {
      const matchesType = types.some((expectedType) => {
        const tType = t.type?.toUpperCase()
        if (tType === expectedType) return true
        if (
          expectedType === "TRANSFER_OUT" &&
          ["TRANSFER", "SEND", "TRANSFER_OUT", "TRANSFER_PAYMENT"].includes(
            tType,
          )
        ) {
          return true
        }
        if (
          expectedType === "BRIDGE" &&
          ["BRIDGE", "SWAP", "CROSS_CHAIN"].includes(tType)
        ) {
          return true
        }
        if (
          expectedType === "SWAP" &&
          ["SWAP", "TRANSFER_OUT"].includes(tType)
        ) {
          return true
        }
        return false
      })
      if (!matchesType) return false
    }

    if (targetSymbol && t.symbol) {
      const tSym = t.symbol.toUpperCase()
      if (!tSym.includes(targetSymbol) && !targetSymbol.includes(tSym)) {
        return false
      }
    }

    if (targetAmountNum !== null && Number.isFinite(targetAmountNum)) {
      const rawNum = Number(t.amount)
      const displayNum = getTransactionDisplayAmount(t)
      const absAmount = Math.abs(
        Number.isFinite(displayNum) && displayNum !== null
          ? displayNum
          : rawNum,
      )

      if (Number.isFinite(absAmount)) {
        const diff = Math.abs(absAmount - targetAmountNum)
        const threshold = Math.max(0.001, targetAmountNum * 0.02)
        if (diff > threshold) {
          return false
        }
      }
    }

    return true
  })

  if (candidateMatches.length > 0) {
    return candidateMatches[0]
  }

  // 5. Ultimate fallback for immediate flow matching (created within last 3 minutes)
  if (types) {
    const looseMatch = sorted.find((t) => {
      const txTime = new Date(t.createdAt).getTime()
      if (!Number.isNaN(txTime)) {
        const diff = now - txTime
        if (diff > 3 * 60 * 1000 || diff < -5 * 60 * 1000) {
          return false
        }
      }
      const tType = t.type?.toUpperCase()
      const matchesType = types.some((expectedType) => {
        if (tType === expectedType) return true
        if (
          expectedType === "TRANSFER_OUT" &&
          ["TRANSFER", "SEND", "TRANSFER_OUT"].includes(tType)
        ) {
          return true
        }
        if (
          expectedType === "BRIDGE" &&
          ["BRIDGE", "SWAP"].includes(tType)
        ) {
          return true
        }
        return false
      })
      if (!matchesType) return false
      if (targetSymbol && t.symbol) {
        const tSym = t.symbol.toUpperCase()
        if (!tSym.includes(targetSymbol) && !targetSymbol.includes(tSym)) {
          return false
        }
      }
      return true
    })
    if (looseMatch) return looseMatch
  }

  return null
}

export async function resolveFlowTransactionId(
  params: ResolveFlowTransactionParams,
): Promise<string | null> {
  if (isValidTransactionId(params.transactionId)) {
    return params.transactionId
  }

  const maxAttempts = params.maxAttempts ?? 6

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

