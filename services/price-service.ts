// --- Types & Interfaces ---

interface TokenPriceResponse {
  [tokenId: string]: { [vsCurrency: string]: number };
}

interface PriceMapping {
  [chainKey: string]: { tokenId: string; symbol: string };
}

interface DetailedPrice {
  currentPrice: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  marketCap: number;
  volume24h: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  ath?: number;
  athChangePercentage?: number;
  atl?: number;
  atlChangePercentage?: number;
  description: string;
  homepage: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// --- Mappings ---

const CHAIN_TO_COINGECKO: PriceMapping = {
  base: { tokenId: "ethereum", symbol: "ETH" },
  polygon: { tokenId: "matic-network", symbol: "MATIC" },
  celo: { tokenId: "celo", symbol: "CELO" },
  arc: { tokenId: "usd-coin", symbol: "USDC" },
  stellar: { tokenId: "stellar", symbol: "XLM" },
};

const TOKEN_SYMBOL_TO_COINGECKO: Record<string, string> = {
  ETH: "ethereum",
  USDC: "usd-coin",
  USDT: "tether",
  MATIC: "matic-network",
  POL: "matic-network",
  BTC: "bitcoin",
  XLM: "stellar",
};

class PriceService {
  private cache: Record<string, CacheEntry<number>> = {};
  private detailedCache: Record<string, CacheEntry<DetailedPrice>> = {};
  private exchangeRateCache = new Map<string, CacheEntry<number>>();
  private pendingRequests: Record<string, Promise<number> | undefined> = {};

  private readonly CACHE_DURATION = 10 * 60 * 1000;
  private readonly STORAGE_KEY = "price_service_cache";
  private readonly COINGECKO_API = "https://api.coingecko.com/api/v3";
  private readonly RATE_LIMIT_DELAY = 1500;
  private lastRequestTime = 0;

  constructor() {
    this.loadPersistedCache();
  }

  // --- Persistence ---

  private loadPersistedCache(): void {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.cache = parsed.simple || {};
        this.detailedCache = parsed.detailed || {};
      }
    } catch {
      console.error("[PriceService] Failed to load cache");
    }
  }

  private persistCache(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          simple: this.cache,
          detailed: this.detailedCache,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  // --- Core Price Methods ---

  async getTokenPrices(chainKeys: string[]): Promise<Record<string, number>> {
    try {
      const results: Record<string, number> = {};
      const tokenIdsToFetch: string[] = [];

      for (const key of chainKeys) {
        const mapping = CHAIN_TO_COINGECKO[key];
        if (!mapping) continue;

        const cached = this.cache[mapping.tokenId];
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
          results[key] = cached.data;
        } else {
          tokenIdsToFetch.push(mapping.tokenId);
        }
      }

      if (tokenIdsToFetch.length > 0) {
        const fetched = await this.fetchPricesFromAPI([
          ...new Set(tokenIdsToFetch),
        ]);

        Object.entries(fetched).forEach(([tokenId, price]) => {
          this.cache[tokenId] = { data: price, timestamp: Date.now() };
          chainKeys.forEach((key) => {
            if (CHAIN_TO_COINGECKO[key]?.tokenId === tokenId)
              results[key] = price;
          });
        });
        this.persistCache();
      }

      return results;
    } catch (error) {
      console.error("[PriceService] getTokenPrices error:", error);
      return {};
    }
  }

  async getTokenPrice(chainKey: string): Promise<number> {
    const prices = await this.getTokenPrices([chainKey]);
    return prices[chainKey] || 0;
  }

  async getTokenPriceBySymbol(symbol: string): Promise<number> {
    const tokenId = TOKEN_SYMBOL_TO_COINGECKO[symbol.toUpperCase()];
    if (!tokenId) return 0;

    const cached = this.cache[tokenId];
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    if (this.pendingRequests[tokenId]) return this.pendingRequests[tokenId]!;

    const fetchPromise = (async () => {
      try {
        const prices = await this.fetchPricesFromAPI([tokenId]);
        const price = prices[tokenId] || 0;
        if (price > 0) {
          this.cache[tokenId] = { data: price, timestamp: Date.now() };
          this.persistCache();
        }
        return price;
      } finally {
        delete this.pendingRequests[tokenId];
      }
    })();

    this.pendingRequests[tokenId] = fetchPromise;
    return fetchPromise;
  }

  async getMultipleTokenPrices(
    symbols: string[],
  ): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    const missingIds: string[] = [];
    const symbolToId: Record<string, string> = {};

    symbols.forEach((s) => {
      const tid = TOKEN_SYMBOL_TO_COINGECKO[s.toUpperCase()];
      if (tid) {
        symbolToId[s] = tid;
        const cached = this.cache[tid];
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
          results[s] = cached.data;
        } else {
          missingIds.push(tid);
        }
      }
    });

    if (missingIds.length > 0) {
      try {
        const fetched = await this.fetchPricesFromAPI([...new Set(missingIds)]);
        Object.entries(fetched).forEach(([id, price]) => {
          this.cache[id] = { data: price, timestamp: Date.now() };
        });
        this.persistCache();
        symbols.forEach((s) => {
          if (results[s] === undefined)
            results[s] = fetched[symbolToId[s]] || 0;
        });
      } catch {
        symbols.forEach((s) => {
          if (results[s] === undefined)
            results[s] = this.cache[symbolToId[s]]?.data || 0;
        });
      }
    }
    return results;
  }

  async getStablecoinPrices(): Promise<Record<string, number>> {
    const prices = await this.fetchPricesFromAPI(["usd-coin", "tether"]);
    return {
      USDC: prices["usd-coin"] || 0,
      USDT: prices["tether"] || 0,
    };
  }

  // --- Detailed Data ---

  async getDetailedTokenPrice(symbol: string): Promise<DetailedPrice> {
    const tokenId = TOKEN_SYMBOL_TO_COINGECKO[symbol.toUpperCase()];
    const fallback: DetailedPrice = {
      currentPrice: 0,
      priceChange24h: 0,
      priceChangePercentage24h: 0,
      marketCap: 0,
      volume24h: 0,
      description: "",
      homepage: "",
    };

    if (!tokenId) return fallback;

    const cacheKey = `detailed_${tokenId}`;
    const cached = this.detailedCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const url = `${this.COINGECKO_API}/coins/${tokenId}?localization=false&tickers=false&community_data=false&developer_data=false`;
      const response = await this.rateLimitedFetch(url);
      if (!response.ok) throw new Error();

      const data = await response.json();
      const detailed: DetailedPrice = {
        currentPrice: data.market_data?.current_price?.usd || 0,
        priceChange24h: data.market_data?.price_change_24h || 0,
        priceChangePercentage24h:
          data.market_data?.price_change_percentage_24h || 0,
        marketCap: data.market_data?.market_cap?.usd || 0,
        volume24h: data.market_data?.total_volume?.usd || 0,
        circulatingSupply: data.market_data?.circulating_supply,
        totalSupply: data.market_data?.total_supply,
        maxSupply: data.market_data?.max_supply,
        ath: data.market_data?.ath?.usd,
        athChangePercentage: data.market_data?.ath_change_percentage?.usd,
        atl: data.market_data?.atl?.usd,
        atlChangePercentage: data.market_data?.atl_change_percentage?.usd,
        description: data.description?.en || "",
        homepage: data.links?.homepage?.[0] || "",
      };

      this.detailedCache[cacheKey] = { data: detailed, timestamp: Date.now() };
      this.persistCache();
      return detailed;
    } catch {
      return this.detailedCache[cacheKey]?.data || fallback;
    }
  }

  // --- Exchange Rates ---

  async getFiatExchangeRate(targetCurrency: string): Promise<number> {
    const currency = targetCurrency.toUpperCase();
    if (["USD", "USDC", "USDT"].includes(currency)) return 1;

    const cacheKey = currency.toLowerCase();
    const cached = this.exchangeRateCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 4 * 60 * 60 * 1000) {
      return cached.data;
    }

    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/USD`);
      const data = (await response.json()) as {
        result: string;
        rates: Record<string, number>;
      };
      if (data?.result === "success" && data.rates[currency]) {
        const rate = data.rates[currency];
        this.exchangeRateCache.set(cacheKey, {
          data: rate,
          timestamp: Date.now(),
        });
        return rate;
      }
    } catch {
      console.warn(`[PriceService] Fiat rate fetch failed for ${currency}`);
    }
    return cached?.data || 0;
  }

  // --- Internal Logic ---

  private async fetchPricesFromAPI(
    tokenIds: string[],
    vsCurrency: string = "usd",
  ): Promise<Record<string, number>> {
    const idsParam = tokenIds.join(",");
    const url = `${this.COINGECKO_API}/simple/price?ids=${idsParam}&vs_currencies=${vsCurrency}`;

    const response = await this.rateLimitedFetch(url);
    if (!response.ok) throw new Error(`CoinGecko status ${response.status}`);

    const data = (await response.json()) as TokenPriceResponse;
    const prices: Record<string, number> = {};
    Object.entries(data).forEach(([id, val]) => {
      prices[id] = val[vsCurrency] || 0;
    });
    return prices;
  }

  private async rateLimitedFetch(url: string, retries = 3): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const now = Date.now();
      const diff = now - this.lastRequestTime;
      if (diff < this.RATE_LIMIT_DELAY) {
        await new Promise((r) => setTimeout(r, this.RATE_LIMIT_DELAY - diff));
      }
      this.lastRequestTime = Date.now();

      try {
        const response = await fetch(url);
        if (response.status === 429 && attempt < retries) {
          await new Promise((r) =>
            setTimeout(r, Math.pow(2, attempt + 1) * 1000),
          );
          continue;
        }
        return response;
      } catch (e) {
        if (attempt === retries) throw e;
        await new Promise((r) =>
          setTimeout(r, Math.pow(2, attempt + 1) * 1000),
        );
      }
    }
    throw new Error("Failed after retries");
  }

  // --- Formatting ---

  formatDisplayUSD(totalUSD: number): string {
    if (totalUSD === 0) return "$0.00";
    if (totalUSD < 0.01) return "<$0.01";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(totalUSD);
  }

  formatPriceUSD(amount: string | number, pricePerToken: number): string {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numAmount) || pricePerToken <= 0) return "$0.00";
    const val = numAmount * pricePerToken;
    if (val < 0.01) return "<$0.01";
    return this.formatLargeNumber(val);
  }

  formatLargeNumber(num: number): string {
    if (num === 0) return "$0";
    if (num < 1000) return `$${num.toFixed(2)}`;
    if (num < 1000000) return `$${(num / 1000).toFixed(1)}K`;
    if (num < 1000000000) return `$${(num / 1000000).toFixed(1)}M`;
    return `$${(num / 1000000000).toFixed(1)}B`;
  }

  // --- Utility ---

  clearCache(): void {
    this.cache = {};
    this.detailedCache = {};
    if (typeof window !== "undefined")
      localStorage.removeItem(this.STORAGE_KEY);
  }

  getSupportedChains(): string[] {
    return Object.keys(CHAIN_TO_COINGECKO);
  }
}

export const priceService = new PriceService();
export default priceService;
