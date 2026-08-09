"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactNode, useEffect, useRef } from "react"
import type { Transaction } from "@/types/db"
import { recordTransactionStatuses } from "@/lib/transaction-status-sync"

function TransactionBalanceSync({ queryClient }: { queryClient: QueryClient }) {
  const previousStatuses = useRef(new Map<string, Transaction["status"]>())

  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "success") return

        const queryType = event.query.queryKey[0]
        if (queryType !== "transaction" && queryType !== "transactions") {
          return
        }

        const statusChanged = recordTransactionStatuses(
          previousStatuses.current,
          event.query.state.data,
        )
        if (!statusChanged) return

        // A confirmed transaction can alter every chain balance. Refresh the
        // authenticated profile immediately, regardless of the current page.
        void queryClient.invalidateQueries({ queryKey: ["user-session"] })

        if (queryType === "transaction") {
          void queryClient.invalidateQueries({ queryKey: ["transactions"] })
        }
      }),
    [queryClient],
  )

  return null
}

/**
 * Module-level so non-React code (the realtime handler) can invalidate. Previously this
 * was constructed in the component body, which also meant any re-render minted a new cache.
 * Safe in a "use client" module — it never executes server-side for another user.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
})

export default function ReactQueryProvider({
  children,
}: {
  children: ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <TransactionBalanceSync queryClient={queryClient} />
      {children}
    </QueryClientProvider>
  )
}
