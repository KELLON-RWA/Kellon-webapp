import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 60;

const CHART_CACHE_TTL_MS = 60_000;
const MAX_CONCURRENT_YAHOO_REQUESTS = 5;
const MAX_CHART_SYMBOLS = 20;
const HOURS_24_IN_SECONDS = 24 * 60 * 60;
const ONE_HOUR_IN_SECONDS = 60 * 60;
const CHART_RANGES = {
  "1D": { interval: "5m" },
  "1W": { interval: "30m" },
  "1M": { interval: "1h" },
  "1Y": { interval: "1d" },
  ALL: { interval: "1mo" },
} as const;
type ChartRange = keyof typeof CHART_RANGES;
type ChartData = {
  values: number[];
  timestamps: number[];
  change24hPercentage?: number;
  high24h?: number;
  low24h?: number;
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

function getRangeStart(range: ChartRange, now: number) {
  if (range === "ALL") return 0;
  if (range === "1D") return now - HOURS_24_IN_SECONDS;
  if (range === "1W") return now - 7 * HOURS_24_IN_SECONDS;

  const start = new Date(now * 1_000);
  if (range === "1M") start.setUTCMonth(start.getUTCMonth() - 1);
  if (range === "1Y") start.setUTCFullYear(start.getUTCFullYear() - 1);
  return Math.floor(start.getTime() / 1_000);
}

async function getChart(symbol: string, range: ChartRange) {
  const yahooSymbol = toYahooSymbol(symbol);
  if (!/^[A-Z0-9.-]{1,12}$/.test(yahooSymbol)) return null;
  const rangeConfig = CHART_RANGES[range];

  const cacheKey = `${yahooSymbol}:${range}`;
  const cached = chartCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.chart;

  const pending = pendingCharts.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    try {
      const now = Math.floor(Date.now() / 1_000);
      const rangeStart = getRangeStart(range, now);
      const queryStart = range === "1D"
        ? rangeStart - ONE_HOUR_IN_SECONDS
        : rangeStart;
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${queryStart}&period2=${now}&interval=${rangeConfig.interval}&includePrePost=${range === "1D"}`;
      const response = await fetch(
        chartUrl,
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
      const targetTimestamp = now - HOURS_24_IN_SECONDS;
      const baseline = [...points]
        .reverse()
        .find((point) => point.timestamp <= targetTimestamp);
      const change24hPercentage =
        baseline && baseline.value > 0
          ? ((latest.value - baseline.value) / baseline.value) * 100
          : undefined;
      const last24Hours = points.filter(
        (point) => point.timestamp >= targetTimestamp,
      );
      const high24h = last24Hours.length
        ? Math.max(...last24Hours.map((point) => point.value))
        : undefined;
      const low24h = last24Hours.length
        ? Math.min(...last24Hours.map((point) => point.value))
        : undefined;

      const displayedPoints = points.filter(
        (point) => point.timestamp >= rangeStart,
      );
      return {
        values: displayedPoints.map((point) => point.value),
        timestamps: displayedPoints.map((point) => point.timestamp),
        ...(Number.isFinite(change24hPercentage)
          ? { change24hPercentage }
          : {}),
        ...(Number.isFinite(high24h) ? { high24h } : {}),
        ...(Number.isFinite(low24h) ? { low24h } : {}),
      };
    } catch {
      return null;
    }
  })();

    pendingCharts.set(cacheKey, request);
  try {
    const chart = await request;
    chartCache.set(cacheKey, {
      chart,
      expiresAt: Date.now() + CHART_CACHE_TTL_MS,
    });
    return chart;
  } finally {
    pendingCharts.delete(cacheKey);
  }
}

async function getCharts(symbols: string[], range: ChartRange) {
  const remaining = [...symbols];
  const charts: Array<readonly [string, ChartData | null]> = [];
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_YAHOO_REQUESTS, remaining.length) },
    async () => {
      let symbol = remaining.shift();
      while (symbol) {
        charts.push([symbol, await getChart(symbol, range)]);
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
  const requestedRange = searchParams.get("range")?.toUpperCase();
  const range: ChartRange =
    requestedRange && requestedRange in CHART_RANGES
      ? (requestedRange as ChartRange)
      : "1W";

  const charts = await getCharts(symbols, range);

  return NextResponse.json({
    charts: Object.fromEntries(
      charts.flatMap(([symbol, chart]) =>
        chart ? [[symbol, chart.values]] : [],
      ),
    ),
    timestamps: Object.fromEntries(
      charts.flatMap(([symbol, chart]) =>
        chart ? [[symbol, chart.timestamps]] : [],
      ),
    ),
    changes: Object.fromEntries(
      charts.flatMap(([symbol, chart]) =>
        chart?.change24hPercentage !== undefined
          ? [[symbol, chart.change24hPercentage]]
          : [],
      ),
    ),
    stats: Object.fromEntries(
      charts.flatMap(([symbol, chart]) =>
        chart?.high24h !== undefined && chart?.low24h !== undefined
          ? [[symbol, { high24h: chart.high24h, low24h: chart.low24h }]]
          : [],
      ),
    ),
  });
}
