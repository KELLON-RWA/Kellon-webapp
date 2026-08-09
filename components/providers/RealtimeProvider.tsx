"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { RealtimeClient } from "@/lib/realtime/client"
import { planInvalidation, RECONNECT_INVALIDATION, type InvalidationPlan } from "@/lib/realtime/invalidation-map"
import { getAuthToken } from "@/services/api"

interface RealtimeContextValue {
  /** Screens gate their fallback polling on this. */
  isConnected: boolean
}

const RealtimeContext = createContext<RealtimeContextValue>({ isConnected: false })

export const useRealtime = () => useContext(RealtimeContext)

const ROUTER_REFRESH_DEBOUNCE_MS = 1_000
const STABLE_AFTER_MS = 30_000

export default function RealtimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stableTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!getAuthToken()) return

    // Trailing debounce: a burst of events must cause one RSC re-render, not one each.
    const applyPlan = (plan: InvalidationPlan) => {
      for (const key of plan.queryKeys) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      if (plan.refreshRouter && !refreshTimer.current) {
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null
          router.refresh()
        }, ROUTER_REFRESH_DEBOUNCE_MS)
      }
    }

    const client = new RealtimeClient({
      onEvent: (event) => applyPlan(planInvalidation(event)),
      onConnected: () => {
        setIsConnected(true)
        // Nothing is replayed for the disconnected window, so resync coarsely.
        applyPlan(RECONNECT_INVALIDATION)
        if (stableTimer.current) clearTimeout(stableTimer.current)
        stableTimer.current = setTimeout(() => client.markStable(), STABLE_AFTER_MS)
      },
      onDisconnected: () => setIsConnected(false),
    })

    client.start()

    // A push that arrives while a tab is open goes through the same invalidation path,
    // so the socket and push transports converge on one handler.
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.source !== "kellon-push") return
      const raw = event.data?.data?.kellonEvent
      if (typeof raw !== "string") return
      try {
        applyPlan(planInvalidation(JSON.parse(raw)))
      } catch {
        /* malformed envelope — ignore */
      }
    }
    navigator.serviceWorker?.addEventListener("message", onSwMessage)

    return () => {
      client.stop()
      navigator.serviceWorker?.removeEventListener("message", onSwMessage)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      if (stableTimer.current) clearTimeout(stableTimer.current)
    }
  }, [queryClient, router])

  const value = useMemo(() => ({ isConnected }), [isConnected])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}
