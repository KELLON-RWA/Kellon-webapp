"use client";

import { cn } from "@/lib/utils";

export type StockChartRange = "1D" | "1W" | "1M" | "1Y" | "ALL";

export function StockSparkline({
  values,
  className,
}: {
  values?: number[];
  className?: string;
}) {
  if (!values || values.length < 2) {
    return (
      <span className={cn("block h-9 w-28", className)} aria-hidden="true" />
    );
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - ((value - minimum) / range) * 86 - 7;
      return `${x},${y}`;
    })
    .join(" ");
  const isUp = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-label={isUp ? "Price trend up" : "Price trend down"}
      className={cn(
        "h-9 w-28",
        isUp ? "text-emerald-500" : "text-rose-500",
        className,
      )}
    >
      <polyline
        fill="none"
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export async function getStockCharts(
  symbols: string[],
  range?: StockChartRange,
) {
  if (!symbols.length) {
    return {
      charts: {} as Record<string, number[]>,
      timestamps: {} as Record<string, number[]>,
      changes: {} as Record<string, number>,
      stats: {} as Record<string, { high24h: number; low24h: number }>,
    };
  }
  const query = new URLSearchParams({ symbols: symbols.join(",") });
  if (range) query.set("range", range);
  const response = await fetch(`/api/market/charts?${query.toString()}`);
  if (!response.ok) {
    return {
      charts: {} as Record<string, number[]>,
      timestamps: {} as Record<string, number[]>,
      changes: {} as Record<string, number>,
    };
  }
  const payload = (await response.json()) as {
    charts?: Record<string, number[]>;
    timestamps?: Record<string, number[]>;
    changes?: Record<string, number>;
    stats?: Record<string, { high24h: number; low24h: number }>;
  };
  return {
    charts: payload.charts || {},
    timestamps: payload.timestamps || {},
    changes: payload.changes || {},
    stats: payload.stats || {},
  };
}
