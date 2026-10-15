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

import type { CompanyNewsArticle, CompanyNewsSource } from "@/lib/company-news";
import type { NewsCompanyFacts } from "@/lib/company-news-facts";
import type { WikidataCompanyProfile } from "@/lib/wikidata-company";

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
  getCompanyProfile(symbol: string, name: string) {
    return getJson<{ profile: WikidataCompanyProfile | null }>(
      `/api/market/company/${encodeURIComponent(symbol)}?${new URLSearchParams({ name })}`,
    );
  },
  getCompanyNewsFacts(symbol: string, name: string) {
    return getJson<{ facts: NewsCompanyFacts }>(
      `/api/market/news/${encodeURIComponent(symbol)}?${new URLSearchParams({ name, profile: "1" })}`,
    );
  },
  getFinnhubMarketData(symbol: string) {
    return getJson<FinnhubMarketData>(
      `/api/market/stocks/${encodeURIComponent(symbol)}`,
    );
  },
  getCompanyNews(symbol: string, name: string) {
    return getJson<{
      articles: CompanyNewsArticle[];
      source: CompanyNewsSource;
    }>(
      `/api/market/news/${encodeURIComponent(symbol)}?${new URLSearchParams({ name })}`,
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
