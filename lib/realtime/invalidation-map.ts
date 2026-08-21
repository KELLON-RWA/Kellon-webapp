import type { RealtimeEvent, RealtimeEventType } from "./events"

export interface InvalidationPlan {
  /** React Query keys to invalidate. Prefix matching means ["notifications"] also hits unread-count. */
  queryKeys: unknown[][]
  /** Balances are server-rendered, so some events can only be applied by re-running RSC. */
  refreshRouter: boolean
}

const EMPTY: InvalidationPlan = { queryKeys: [], refreshRouter: false }

/**
 * Pure so it can be unit-tested without a socket, a QueryClient, or a router.
 */
export function planInvalidation(event: RealtimeEvent): InvalidationPlan {
  const type = event.type as RealtimeEventType

  switch (type) {
    case "transaction.created":
    case "transaction.updated":
      return {
        queryKeys: [
          ["transactions"],
          ["user-session"],
          ...(event.entityId ? [["transaction", event.entityId]] : []),
        ],
        // A transaction reaching a terminal state moves a balance, and balances come
        // from the server-rendered profile.
        refreshRouter: true,
      }

    case "balance.updated":
      return { queryKeys: [["user-session"]], refreshRouter: true }

    case "notification.created":
      // Prefix key: covers both ["notifications"] and ["notifications","unread-count"].
      return { queryKeys: [["notifications"]], refreshRouter: false }

    case "kyc.status_updated":
    case "user.wallets_updated":
      return { queryKeys: [], refreshRouter: true }

    default:
      return EMPTY
  }
}

/** Applied on every (re)connect, since events during the gap are not replayed. */
export const RECONNECT_INVALIDATION: InvalidationPlan = {
  queryKeys: [["transactions"], ["notifications"], ["user-session"]],
  refreshRouter: true,
}
