"use client"

import { useEffect, useSyncExternalStore } from "react"
import { apiFetch, handleResponse } from "@/services/api"

export type ChainStatus = "ACTIVE" | "WITHDRAW_ONLY" | "PAUSED" | "STOPPED"
export type ChainDirection = "in" | "out"

export interface ChainStatusInfo {
  chain: string
  status: ChainStatus
  reason?: string
  message?: string
}

const REFRESH_MS = 60_000
const ALIASES: Record<string, string> = {
  bsc: "bnb",
  matic: "polygon",
  xlm: "stellar",
  sol: "solana",
}
const normalize = (chain?: string | null) => {
  const key = String(chain || "")
    .toLowerCase()
    .replace(/[-_](mainnet|testnet|sepolia|amoy)$/, "")
  return ALIASES[key] || key
}

let statuses: Record<string, ChainStatusInfo> = {}
let version = 0
let lastFetched = 0
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

export async function refreshChainStatuses(force = false): Promise<void> {
  if (!force && Date.now() - lastFetched < REFRESH_MS) return
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await handleResponse<{ chains?: ChainStatusInfo[] }>(
        await apiFetch("/api/chains/status", { method: "GET" }),
      )
      const list = res.data?.chains || []
      statuses = Object.fromEntries(list.map((c) => [normalize(c.chain), c]))
      lastFetched = Date.now()
      version++
      listeners.forEach((l) => l())
    } catch {
      // Fail open: the backend enforces the status regardless of what the UI shows.
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export const chainStatus = {
  get: (chain?: string | null) => statuses[normalize(chain)],
  status: (chain?: string | null): ChainStatus =>
    statuses[normalize(chain)]?.status || "ACTIVE",
  /** STOPPED chains are hidden entirely. */
  isVisible: (chain?: string | null) => chainStatus.status(chain) !== "STOPPED",
  /** in: receive, buy, bridge in, deposit, buy stock. out: send, sell, bridge out, withdraw. */
  allows: (chain: string | null | undefined, direction: ChainDirection) => {
    const status = chainStatus.status(chain)
    return status === "ACTIVE" || (status === "WITHDRAW_ONLY" && direction === "out")
  },
  blockedMessage: (chain: string | null | undefined, direction: ChainDirection) =>
    chainStatus.allows(chain, direction)
      ? undefined
      : chainStatus.get(chain)?.message ||
        "This network is not available for this action right now.",
  all: () => Object.values(statuses),
}

/** Re-renders on status changes and keeps them fresh while mounted. */
export function useChainStatus() {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
    () => version,
  )
  useEffect(() => {
    refreshChainStatuses()
    const timer = setInterval(() => refreshChainStatuses(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [])
  return { ...chainStatus, version }
}
