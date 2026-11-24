"use client";

import { useEffect, useRef, useState } from "react";

export type LiveStockTick = {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  direction: "up" | "down" | null;
};

export function useStockRealtime(symbol?: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastTick, setLastTick] = useState<LiveStockTick | null>(null);

  const prevPriceRef = useRef<number | null>(null);
  const resetDirectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!symbol || typeof window === "undefined") {
      setIsConnected(false);
      return;
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const sseUrl = `/api/market/stocks/${encodeURIComponent(cleanSymbol)}/stream`;
    let eventSource: EventSource | null = null;
    let isCancelled = false;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        if (!isCancelled) {
          setIsConnected(true);
        }
      };

      eventSource.onmessage = (event) => {
        if (isCancelled || !event.data) return;
        try {
          const data = JSON.parse(event.data);

          if (data.type === "trade" && typeof data.price === "number" && data.price > 0) {
            const newPrice = Number(data.price);
            const prev = prevPriceRef.current;
            let dir: "up" | "down" | null = null;

            if (prev !== null) {
              if (newPrice > prev) dir = "up";
              else if (newPrice < prev) dir = "down";
            }
            prevPriceRef.current = newPrice;

            setPrice(newPrice);
            if (dir) {
              setDirection(dir);
              if (resetDirectionTimerRef.current) {
                clearTimeout(resetDirectionTimerRef.current);
              }
              resetDirectionTimerRef.current = setTimeout(() => {
                setDirection(null);
              }, 1200);
            }

            setLastTick({
              symbol: cleanSymbol,
              price: newPrice,
              volume: Number(data.volume || 0),
              timestamp: Number(data.timestamp || Date.now()),
              direction: dir,
            });
          } else if (data.type === "connected" && typeof data.price === "number" && data.price > 0) {
            // Baseline initial price
            if (prevPriceRef.current === null) {
              prevPriceRef.current = data.price;
              setPrice(data.price);
            }
          }
        } catch {
          // ignore parse error
        }
      };

      eventSource.onerror = () => {
        if (!isCancelled) {
          setIsConnected(false);
        }
      };
    } catch (err) {
      console.error("[useStockRealtime] Failed to open SSE:", err);
    }

    return () => {
      isCancelled = true;
      if (resetDirectionTimerRef.current) {
        clearTimeout(resetDirectionTimerRef.current);
      }
      if (eventSource) {
        eventSource.close();
      }
      setIsConnected(false);
    };
  }, [symbol]);

  return {
    price,
    direction,
    isConnected,
    lastTick,
  };
}
