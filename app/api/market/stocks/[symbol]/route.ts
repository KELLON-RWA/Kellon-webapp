import { NextResponse } from "next/server";
import {
  type FinnhubStockMarketPayload,
  getCachedFundamentals,
  getCachedStockData,
  getPendingStockData,
  getStaleStockData,
  removePendingStockData,
  setCachedFundamentals,
  setCachedStockData,
  setPendingStockData,
} from "@/lib/stock-market-cache";

export const runtime = "nodejs";
export const revalidate = 5;

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
const STOCK_SYMBOLS: Record<string, string> = {
  SKHY: "000660.KS",
};

function getFinnhubSymbol(value: string) {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,16}$/.test(symbol)) return null;
  return STOCK_SYMBOLS[symbol] || symbol;
}

async function getFinnhubResource<T>(path: string, token: string) {
  try {
    const isQuote = path.startsWith("/quote?");
    const response = await fetch(`${FINNHUB_BASE_URL}${path}`, {
      headers: { "X-Finnhub-Token": token },
      cache: isQuote ? "no-store" : "default",
      next: { revalidate: isQuote ? 0 : 86400 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data) || data.error)
      return null;
    return data as T;
  } catch {
    return null;
  }
}

type FinnhubQuote = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
};

type FinnhubProfile = {
  country?: string;
  currency?: string;
  exchange?: string;
  finnhubIndustry?: string;
  ipo?: string;
  logo?: string;
  marketCapitalization?: number;
  name?: string;
  shareOutstanding?: number;
  ticker?: string;
  weburl?: string;
};

type FinnhubMetrics = { metric?: Record<string, number | string | null> };

async function fetchFinnhubMarketData(
  symbol: string,
  token: string,
): Promise<FinnhubStockMarketPayload> {
  const cachedFundamentals = getCachedFundamentals(symbol);

  const quotePromise = getFinnhubResource<FinnhubQuote>(
    `/quote?symbol=${encodeURIComponent(symbol)}`,
    token,
  );

  const profilePromise = cachedFundamentals?.profile
    ? Promise.resolve(cachedFundamentals.profile as FinnhubProfile)
    : getFinnhubResource<FinnhubProfile>(
        `/stock/profile2?symbol=${encodeURIComponent(symbol)}`,
        token,
      );

  const metricsPromise = cachedFundamentals?.metrics
    ? Promise.resolve({ metric: cachedFundamentals.metrics } as FinnhubMetrics)
    : getFinnhubResource<FinnhubMetrics>(
        `/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`,
        token,
      );

  const [quote, profile, metrics] = await Promise.all([
    quotePromise,
    profilePromise,
    metricsPromise,
  ]);

  if (!cachedFundamentals && (profile || metrics?.metric)) {
    setCachedFundamentals(symbol, {
      profile: profile || null,
      metrics: metrics?.metric || {},
    });
  }

  return {
    quote:
      quote && typeof quote.c === "number" && quote.c > 0
        ? {
            current: quote.c,
            change: quote.d,
            percentChange: quote.dp,
            high: quote.h,
            low: quote.l,
            open: quote.o,
            previousClose: quote.pc,
            timestamp: quote.t,
          }
        : null,
    profile: profile?.name
      ? {
          name: profile.name,
          ticker: profile.ticker,
          website: profile.weburl,
          logo: profile.logo,
          industry: profile.finnhubIndustry,
          country: profile.country,
          exchange: profile.exchange,
          currency: profile.currency,
          ipo: profile.ipo,
          marketCap: profile.marketCapitalization,
          sharesOutstanding: profile.shareOutstanding,
        }
      : null,
    metrics: metrics?.metric || {},
    source: "Finnhub",
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return NextResponse.json(
      { message: "Finnhub is not configured" },
      { status: 503 },
    );
  }

  const { symbol: requestedSymbol } = await params;
  const symbol = getFinnhubSymbol(requestedSymbol);
  if (!symbol) {
    return NextResponse.json(
      { message: "Invalid stock symbol" },
      { status: 400 },
    );
  }

  const cached = getCachedStockData(symbol);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, max-age=5, stale-while-revalidate=15",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    let pending = getPendingStockData(symbol);
    if (!pending) {
      pending = fetchFinnhubMarketData(symbol, token).finally(() => {
        removePendingStockData(symbol);
      });
      setPendingStockData(symbol, pending);
    }

    const data = await pending;

    // Cache valid response (5-second quote window to deduplicate concurrent requests)
    setCachedStockData(symbol, data);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=5, stale-while-revalidate=15",
        "X-Cache": "MISS",
      },
    });
  } catch {
    // If Finnhub fails but we have stale cached data, serve stale data gracefully
    const stale = getStaleStockData(symbol);
    if (stale) {
      return NextResponse.json(stale, {
        headers: {
          "Cache-Control": "public, max-age=5, stale-while-revalidate=15",
          "X-Cache": "STALE",
        },
      });
    }

    return NextResponse.json(
      { message: "Unable to load Finnhub market data" },
      { status: 502 },
    );
  }
}
