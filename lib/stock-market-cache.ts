export type FinnhubStockMarketPayload = {
  quote: {
    current: number;
    change?: number;
    percentChange?: number;
    high?: number;
    low?: number;
    open?: number;
    previousClose?: number;
    timestamp?: number;
  } | null;
  profile: {
    name: string;
    ticker?: string;
    website?: string;
    logo?: string;
    industry?: string;
    country?: string;
    exchange?: string;
    currency?: string;
    ipo?: string;
    marketCap?: number;
    sharesOutstanding?: number;
  } | null;
  metrics: Record<string, number | string | null>;
  source: string;
};

export type CachedCompanyFundamentals = {
  profile: FinnhubStockMarketPayload["profile"] | Record<string, unknown> | null;
  metrics: Record<string, number | string | null>;
};

// Quotes are live: fresh every 5 seconds
export const STOCK_DATA_CACHE_TTL_MS = 5_000;
// Company fundamentals (profile & financial metrics) are cached for 1 hour
export const COMPANY_FUNDAMENTALS_CACHE_TTL_MS = 3_600_000;

const stockDataCache = new Map<
  string,
  { expiresAt: number; data: FinnhubStockMarketPayload }
>();
const fundamentalsCache = new Map<
  string,
  { expiresAt: number; data: CachedCompanyFundamentals }
>();
const pendingStockData = new Map<string, Promise<FinnhubStockMarketPayload>>();

export function getCachedStockData(symbol: string): FinnhubStockMarketPayload | null {
  const cached = stockDataCache.get(symbol);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }
  return null;
}

export function getCachedFundamentals(symbol: string): CachedCompanyFundamentals | null {
  const cached = fundamentalsCache.get(symbol);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }
  return null;
}

export function setCachedFundamentals(
  symbol: string,
  data: CachedCompanyFundamentals,
  ttlMs = COMPANY_FUNDAMENTALS_CACHE_TTL_MS,
) {
  fundamentalsCache.set(symbol, {
    expiresAt: Date.now() + ttlMs,
    data,
  });
}

export function getStaleStockData(symbol: string): FinnhubStockMarketPayload | null {
  return stockDataCache.get(symbol)?.data || null;
}

export function setCachedStockData(
  symbol: string,
  data: FinnhubStockMarketPayload,
  ttlMs = STOCK_DATA_CACHE_TTL_MS,
) {
  stockDataCache.set(symbol, {
    expiresAt: Date.now() + ttlMs,
    data,
  });
}

export function getPendingStockData(symbol: string) {
  return pendingStockData.get(symbol);
}

export function setPendingStockData(
  symbol: string,
  promise: Promise<FinnhubStockMarketPayload>,
) {
  pendingStockData.set(symbol, promise);
}

export function removePendingStockData(symbol: string) {
  pendingStockData.delete(symbol);
}

export function clearStockDataCache() {
  stockDataCache.clear();
  fundamentalsCache.clear();
  pendingStockData.clear();
  newsCache.clear();
  pendingNews.clear();
}

export type CachedNewsPayload = {
  articles?: Array<Record<string, unknown>>;
  facts?: Record<string, unknown>;
  source: string;
};

// News is cached for 15 minutes
export const NEWS_CACHE_TTL_MS = 15 * 60_000;

const newsCache = new Map<
  string,
  { expiresAt: number; data: CachedNewsPayload }
>();
const pendingNews = new Map<string, Promise<CachedNewsPayload>>();

export function getCachedNews(cacheKey: string): CachedNewsPayload | null {
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }
  return null;
}

export function getStaleNews(cacheKey: string): CachedNewsPayload | null {
  return newsCache.get(cacheKey)?.data || null;
}

export function setCachedNews(
  cacheKey: string,
  data: CachedNewsPayload,
  ttlMs = NEWS_CACHE_TTL_MS,
) {
  newsCache.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    data,
  });
}

export function getPendingNews(cacheKey: string) {
  return pendingNews.get(cacheKey);
}

export function setPendingNews(
  cacheKey: string,
  promise: Promise<CachedNewsPayload>,
) {
  pendingNews.set(cacheKey, promise);
}

export function removePendingNews(cacheKey: string) {
  pendingNews.delete(cacheKey);
}
