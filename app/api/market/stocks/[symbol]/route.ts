import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 60;

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
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(
    `${FINNHUB_BASE_URL}${path}${separator}token=${token}`,
    {
      next: { revalidate: 60 },
    },
  );
  if (!response.ok) return null;
  return (await response.json()) as T;
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

  try {
    const [quote, profile, metrics] = await Promise.all([
      getFinnhubResource<FinnhubQuote>(
        `/quote?symbol=${encodeURIComponent(symbol)}`,
        token,
      ),
      getFinnhubResource<FinnhubProfile>(
        `/stock/profile2?symbol=${encodeURIComponent(symbol)}`,
        token,
      ),
      getFinnhubResource<FinnhubMetrics>(
        `/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`,
        token,
      ),
    ]);

    return NextResponse.json({
      quote: quote
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
      profile: profile
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
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to load Finnhub market data" },
      { status: 502 },
    );
  }
}
