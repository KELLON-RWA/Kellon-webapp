import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 60;

const CHART_CACHE_TTL_MS = 60_000;
const MAX_CONCURRENT_YAHOO_REQUESTS = 5;
const MAX_CHART_SYMBOLS = 20;
const HOURS_24_IN_SECONDS = 24 * 60 * 60;
type ChartData = {
  values: number[];
  change24hPercentage?: number;
};
const chartCache = new Map<
  string,
  { expiresAt: number; chart: ChartData | null }
>();
const pendingCharts = new Map<string, Promise<ChartData | null>>();

function toYahooSymbol(symbol: string) {
  const raw = symbol.trim();
  const withoutProviderSuffix = /[bc]$/i.test(raw) ? raw.slice(0, -1) : raw;

  // Kellon's bStock catalogue uses a lowercase "b" prefix (for example,
  // bNVDA). Preserve genuine uppercase tickers such as BABA.
  const ticker = (
    withoutProviderSuffix.startsWith("b")
      ? withoutProviderSuffix.slice(1)
      : withoutProviderSuffix
  ).toUpperCase();

  return ticker === "SKHY" ? "000660.KS" : ticker;
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

async function getChart(symbol: string) {
  const yahooSymbol = toYahooSymbol(symbol);
  if (!/^[A-Z0-9.-]{1,12}$/.test(yahooSymbol)) return null;

  const cached = chartCache.get(yahooSymbol);
  if (cached && cached.expiresAt > Date.now()) return cached.chart;

  const pending = pendingCharts.get(yahooSymbol);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=5d&interval=5m&includePrePost=false`,
        {
          headers: { "User-Agent": "Kellon market charts" },
          next: { revalidate: 60 },
        },
      );
      if (!response.ok) return null;

      const payload = (await response.json()) as YahooChartResponse;
      const result = payload.chart?.result?.[0];
      const timestamps = result?.timestamp || [];
      const closes = result?.indicators?.quote?.[0]?.close || [];
      const points = closes.flatMap((close, index) => {
        const timestamp = timestamps[index];
        return typeof close === "number" &&
          Number.isFinite(close) &&
          typeof timestamp === "number" &&
          Number.isFinite(timestamp)
          ? [{ timestamp, value: close }]
          : [];
      });
      if (points.length < 2) return null;

      const latest = points.at(-1)!;
      const targetTimestamp = latest.timestamp - HOURS_24_IN_SECONDS;
      const baseline = [...points]
        .reverse()
        .find((point) => point.timestamp <= targetTimestamp);
      const change24hPercentage =
        baseline && baseline.value > 0
          ? ((latest.value - baseline.value) / baseline.value) * 100
          : undefined;

      return {
        values: points.slice(-78).map((point) => point.value),
        ...(Number.isFinite(change24hPercentage)
          ? { change24hPercentage }
          : {}),
      };
    } catch {
      return null;
    }
  })();

  pendingCharts.set(yahooSymbol, request);
  try {
    const chart = await request;
    chartCache.set(yahooSymbol, {
      chart,
      expiresAt: Date.now() + CHART_CACHE_TTL_MS,
    });
    return chart;
  } finally {
    pendingCharts.delete(yahooSymbol);
  }
}

async function getCharts(symbols: string[]) {
  const remaining = [...symbols];
  const charts: Array<readonly [string, ChartData | null]> = [];
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_YAHOO_REQUESTS, remaining.length) },
    async () => {
      let symbol = remaining.shift();
      while (symbol) {
        charts.push([symbol, await getChart(symbol)]);
        symbol = remaining.shift();
      }
    },
  );

  await Promise.all(workers);
  return charts;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = Array.from(
    new Set(
      (searchParams.get("symbols") || "")
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean)
        .slice(0, MAX_CHART_SYMBOLS),
    ),
  );

  const charts = await getCharts(symbols);

  return NextResponse.json({
    charts: Object.fromEntries(
      charts.flatMap(([symbol, chart]) =>
        chart ? [[symbol, chart.values]] : [],
      ),
    ),
    changes: Object.fromEntries(
      charts.flatMap(([symbol, chart]) =>
        chart?.change24hPercentage !== undefined
          ? [[symbol, chart.change24hPercentage]]
          : [],
      ),
    ),
  });
}
