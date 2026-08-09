import { BASE_URL, getAuthToken } from "@/services/api"
import { WS_CLOSE, isRealtimeEvent, type RealtimeEvent, type ServerFrame } from "./events"

const WS_PATH = "/ws/v1"
const HEARTBEAT_MS = 25_000
const PONG_GRACE_MS = 10_000
const BACKOFF_BASE_MS = 1_000
const BACKOFF_CAP_MS = 30_000

/**
 * The socket must dial the backend origin directly. Vercel's function duration caps make
 * a long-lived connection through the Next `/api/:path*` rewrite unworkable.
 */
function resolveWsUrl(): string {
  const base = new URL(BASE_URL, typeof window !== "undefined" ? window.location.origin : undefined)
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:"
  base.pathname = WS_PATH
  base.search = ""
  return base.toString()
}

export interface RealtimeHandlers {
  onEvent: (event: RealtimeEvent) => void
  onConnected: (resumed: boolean) => void
  onDisconnected: () => void
}

export class RealtimeClient {
  private socket: WebSocket | null = null
  private handlers: RealtimeHandlers
  private attempt = 0
  private stopped = false
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connectedSince = 0

  constructor(handlers: RealtimeHandlers) {
    this.handlers = handlers
  }

  start() {
    this.stopped = false
    this.connect()
  }

  stop() {
    this.stopped = true
    this.clearTimers()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.socket?.close(1000, "client_stop")
    this.socket = null
  }

  get isConnected() {
    return this.socket?.readyState === WebSocket.OPEN && this.connectedSince > 0
  }

  private clearTimers() {
    if (this.heartbeat) clearInterval(this.heartbeat)
    if (this.pongTimer) clearTimeout(this.pongTimer)
    this.heartbeat = null
    this.pongTimer = null
  }

  private connect() {
    if (this.stopped) return

    // Read at connect time, never from a closure — a stale token would pin a 4401 loop.
    const token = getAuthToken()
    if (!token) {
      this.scheduleReconnect()
      return
    }

    let socket: WebSocket
    try {
      socket = new WebSocket(resolveWsUrl())
    } catch {
      this.scheduleReconnect()
      return
    }
    this.socket = socket

    socket.onopen = () => socket.send(JSON.stringify({ type: "auth", token }))

    socket.onmessage = (raw) => {
      let frame: ServerFrame
      try {
        frame = JSON.parse(raw.data as string)
      } catch {
        return
      }
      this.onFrame(frame)
    }

    socket.onclose = (event) => {
      this.clearTimers()
      const wasConnected = this.connectedSince > 0
      this.connectedSince = 0
      this.socket = null
      if (wasConnected) this.handlers.onDisconnected()

      // A revoked or unusable token will not fix itself on a tight loop; back off fully.
      if (event.code === WS_CLOSE.UNAUTHORIZED) this.attempt = Math.max(this.attempt, 3)
      this.scheduleReconnect()
    }

    socket.onerror = () => { /* close always follows; handled there */ }
  }

  private onFrame(frame: ServerFrame) {
    if (frame.type === "hello") {
      this.connectedSince = Date.now()
      this.startHeartbeat()
      this.handlers.onConnected(Boolean((frame as { resumed?: boolean }).resumed))
      return
    }

    if (frame.type === "pong") {
      if (this.pongTimer) clearTimeout(this.pongTimer)
      this.pongTimer = null
      return
    }

    if (frame.type === "auth.expiring") {
      // Re-auth in band so the connection survives a token rotation.
      const token = getAuthToken()
      if (token && this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "auth", token }))
      }
      return
    }

    if (isRealtimeEvent(frame)) this.handlers.onEvent(frame)
  }

  private startHeartbeat() {
    this.clearTimers()
    this.heartbeat = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return
      this.socket.send(JSON.stringify({ type: "ping" }))
      if (this.pongTimer) return
      this.pongTimer = setTimeout(() => {
        // Half-open link: the browser has not noticed, so force it.
        this.socket?.close(4000, "pong_timeout")
      }, PONG_GRACE_MS)
    }, HEARTBEAT_MS)
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return

    // Full jitter: every server restart drops all sockets at once, and an unjittered
    // retry turns that into a self-inflicted thundering herd.
    const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** this.attempt)
    const delay = Math.random() * ceiling
    this.attempt += 1

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  /** Called by the provider once a connection has proven stable. */
  markStable() {
    this.attempt = 0
  }
}
