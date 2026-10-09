export type FinnhubMarketData = {
  quote: {
    current?: number;
    change?: number;
    percentChange?: number;
    high?: number;
    low?: number;
    open?: number;
    previousClose?: number;
    timestamp?: number;
  } | null;
  profile: {
    name?: string;
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
  source: "Finnhub";
};

export type GoogleNewsArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
};

export type DexScreenerPool = {
  chain?: string;
  dex?: string;
  url?: string;
  priceUsd?: string;
  liquidityUsd?: number;
  volume24hUsd?: number;
  change24hPercentage?: number;
  fdv?: number;
  marketCap?: number;
  tokenAddress?: string;
  pairAddress?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load market research");
  return (await response.json()) as T;
}

export const stockResearchService = {
  getFinnhubMarketData(symbol: string) {
    return getJson<FinnhubMarketData>(
      `/api/market/stocks/${encodeURIComponent(symbol)}`,
    );
  },
  getGoogleNews(symbol: string) {
    return getJson<{ articles: GoogleNewsArticle[]; source: "Google News" }>(
      `/api/market/news/${encodeURIComponent(symbol)}`,
    );
  },
  getDexScreenerPool({
    chain,
    tokenAddress,
    pairAddress,
  }: {
    chain: string;
    tokenAddress?: string;
    pairAddress?: string;
  }) {
    const params = new URLSearchParams({ chain });
    if (pairAddress) params.set("pair", pairAddress);
    if (tokenAddress) params.set("token", tokenAddress);
    return getJson<{ pair: DexScreenerPool | null; source: "DexScreener" }>(
      `/api/market/dex?${params.toString()}`,
    );
  },
};
