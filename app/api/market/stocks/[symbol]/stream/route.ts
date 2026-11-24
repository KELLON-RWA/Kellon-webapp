import { stockWSManager, type StockTick } from "@/lib/stock-ws-manager";
import { getUnderlyingTicker } from "@/lib/stock-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYMBOL_REGEX = /^[A-Z0-9.-]{1,16}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol?.trim().toUpperCase();

  if (!symbol || !SYMBOL_REGEX.test(symbol)) {
    return new Response(JSON.stringify({ message: "Invalid stock symbol" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const underlying = getUnderlyingTicker(symbol).toUpperCase();

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      // Listen for client disconnect
      if (request.signal) {
        request.signal.addEventListener("abort", () => {
          cleanup();
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      }

      // 1. Initial connected event
      const initialPayload = JSON.stringify({
        type: "connected",
        symbol: underlying,
        price: stockWSManager.getLastPrice(underlying),
        timestamp: Date.now(),
      });
      controller.enqueue(encoder.encode(`event: message\ndata: ${initialPayload}\n\n`));

      // 2. Subscribe to real-time Finnhub ticks
      unsubscribe = stockWSManager.subscribe(underlying, (tick: StockTick) => {
        try {
          const payload = JSON.stringify({
            type: "trade",
            symbol: tick.symbol,
            price: tick.price,
            volume: tick.volume,
            timestamp: tick.timestamp,
          });
          controller.enqueue(encoder.encode(`event: message\ndata: ${payload}\n\n`));
        } catch {
          // Stream might have closed
        }
      });

      // 3. Heartbeat ping every 15s to keep SSE connection alive
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 15_000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
