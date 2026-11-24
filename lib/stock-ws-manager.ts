import { getUnderlyingTicker } from "./stock-catalog";

export type StockTick = {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
};

type TickListener = (tick: StockTick) => void;

class StockWebSocketManager {
  private ws: WebSocket | null = null;
  private subscribers = new Map<string, Set<TickListener>>();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private lastPrices = new Map<string, number>();

  private get apiKey(): string {
    return process.env.FINNHUB_API_KEY || "";
  }

  private connect() {
    if (this.ws || this.isConnecting || !this.apiKey) return;
    this.isConnecting = true;

    try {
      const url = `wss://ws.finnhub.io?token=${this.apiKey}`;
      const ws = new WebSocket(url);

      ws.onopen = () => {
        this.isConnecting = false;
        this.ws = ws;

        // Resubscribe to all active symbols
        for (const [symbol, listeners] of this.subscribers.entries()) {
          if (listeners.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "subscribe", symbol }));
          }
        }

        // Start ping heartbeat
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: "ping" }));
            } catch {
              // ignore
            }
          }
        }, 20_000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string);
          if (message.type === "trade" && Array.isArray(message.data)) {
            for (const item of message.data) {
              const symbol = item.s;
              const price = Number(item.p);
              const volume = Number(item.v || 0);
              const timestamp = Number(item.t || Date.now());

              if (symbol && price > 0) {
                this.lastPrices.set(symbol, price);
                const listeners = this.subscribers.get(symbol);
                if (listeners && listeners.size > 0) {
                  const tick: StockTick = { symbol, price, volume, timestamp };
                  for (const listener of listeners) {
                    try {
                      listener(tick);
                    } catch (err) {
                      console.error(`[StockWS] Listener error for ${symbol}:`, err);
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("[StockWS] Failed to parse message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[StockWS] WebSocket error:", err);
      };

      ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        // Auto reconnect if there are still active subscribers
        let hasActiveSubscribers = false;
        for (const listeners of this.subscribers.values()) {
          if (listeners.size > 0) {
            hasActiveSubscribers = true;
            break;
          }
        }

        if (hasActiveSubscribers) {
          if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, 3_000);
        }
      };
    } catch (err) {
      this.isConnecting = false;
      console.error("[StockWS] Connect threw:", err);
    }
  }

  public subscribe(rawSymbol: string, listener: TickListener): () => void {
    const symbol = getUnderlyingTicker(rawSymbol).toUpperCase();

    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    const listeners = this.subscribers.get(symbol)!;
    listeners.add(listener);

    // If WebSocket is open, send subscribe message
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (listeners.size === 1) {
        this.ws.send(JSON.stringify({ type: "subscribe", symbol }));
      }
    } else {
      this.connect();
    }

    // Return unbind function
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.subscribers.delete(symbol);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify({ type: "unsubscribe", symbol }));
          } catch {
            // ignore
          }
        }

        // If no subscribers left across all symbols, close connection after a short debounce
        let total = 0;
        for (const set of this.subscribers.values()) {
          total += set.size;
        }
        if (total === 0 && this.ws) {
          setTimeout(() => {
            let active = 0;
            for (const s of this.subscribers.values()) active += s.size;
            if (active === 0 && this.ws) {
              this.ws.close();
              this.ws = null;
            }
          }, 15_000);
        }
      }
    };
  }

  public getLastPrice(rawSymbol: string): number | undefined {
    const symbol = getUnderlyingTicker(rawSymbol).toUpperCase();
    return this.lastPrices.get(symbol);
  }
}

// Global singleton across hot-reloads in Next.js development
const globalForStockWS = globalThis as unknown as {
  stockWSManager?: StockWebSocketManager;
};

export const stockWSManager =
  globalForStockWS.stockWSManager || new StockWebSocketManager();

if (process.env.NODE_ENV !== "production") {
  globalForStockWS.stockWSManager = stockWSManager;
}
