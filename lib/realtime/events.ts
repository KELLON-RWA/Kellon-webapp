/** Mirrors kellon-backend/src/lib/realtime-events.ts. Keep the two in sync. */
export type RealtimeEventType =
  | "transaction.created"
  | "transaction.updated"
  | "balance.updated"
  | "notification.created"
  | "kyc.status_updated"
  | "user.wallets_updated"

export interface RealtimeEvent {
  v: number
  type: RealtimeEventType
  entityId?: string
  ts: number
  meta?: Record<string, string | number | boolean | null>
}

export const WS_CLOSE = {
  PROTOCOL_ERROR: 4400,
  UNAUTHORIZED: 4401,
  TOKEN_EXPIRED: 4403,
  TOO_MANY_CONNECTIONS: 4429,
  DISABLED: 4503,
} as const

export type ServerFrame =
  | { type: "hello"; v: number; serverTime: number; resumed: boolean }
  | { type: "pong"; ts: number }
  | { type: "auth.expiring" }
  | RealtimeEvent

const CONTROL_FRAME_TYPES = new Set(["hello", "pong", "auth.expiring"])

/** Control frames share the `type` field, so discriminate by exclusion. */
export const isRealtimeEvent = (frame: ServerFrame): frame is RealtimeEvent => {
  const type = (frame as { type?: unknown }).type
  return typeof type === "string" && !CONTROL_FRAME_TYPES.has(type)
}
