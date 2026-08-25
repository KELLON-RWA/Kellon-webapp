import { apiFetch, handleResponse, type ApiResponse } from "./index";

export interface StockListing {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  logoUrl?: string;
  category?: string;
  provider: string;
  rwaCategory?: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  currency: string;
  provider: string;
}

export interface BuyStockParams {
  symbol: string;
  amountFiat: number;
  currency?: string;
  provider: string;
  fundingSymbol?: string;
  fundingChain?: string;
}

export interface BuyStockResponse {
  success: boolean;
  transactionId: string;
  symbol: string;
  shares: number;
  price: number;
  cost: number;
  provider: string;
}

export interface SellStockParams {
  symbol: string;
  shares: number;
  currency?: string;
  provider: string;
}

export interface SellStockResponse {
  success: boolean;
  transactionId: string;
  symbol: string;
  shares: number;
  price: number;
  proceeds: number;
  provider: string;
}

export interface StockPortfolioHolding {
  id: string;
  symbol: string;
  rwaCategory?: string;
  shares: number;
  provider: string;
  avgBuyPrice: number;
  currentPrice: number;
  costBasis: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
}

export interface StockPortfolio {
  totalPortfolioValue: number;
  totalCostBasis: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercentage: number;
  holdings: StockPortfolioHolding[];
}

export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change24hPercentage: number;
}

export const stocksService = {
  async getAvailableStocks(provider = "all"): Promise<ApiResponse<StockListing[]>> {
    const res = await apiFetch(`/api/v1/stocks?provider=${encodeURIComponent(provider)}`, {
      method: "GET",
    });
    return handleResponse<StockListing[]>(res);
  },

  async getQuote(symbol: string, provider: string): Promise<ApiResponse<StockQuote>> {
    const res = await apiFetch(
      `/api/v1/stocks/quote/${encodeURIComponent(symbol)}?provider=${encodeURIComponent(provider)}`,
      {
        method: "GET",
      }
    );
    return handleResponse<StockQuote>(res);
  },

  async buyStock(params: BuyStockParams): Promise<ApiResponse<BuyStockResponse>> {
    const res = await apiFetch("/api/v1/stocks/buy", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return handleResponse<BuyStockResponse>(res);
  },

  async sellStock(params: SellStockParams): Promise<ApiResponse<SellStockResponse>> {
    const res = await apiFetch("/api/v1/stocks/sell", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return handleResponse<SellStockResponse>(res);
  },

  async getPortfolio(): Promise<ApiResponse<StockPortfolio>> {
    const res = await apiFetch("/api/v1/stocks/portfolio", {
      method: "GET",
    });
    return handleResponse<StockPortfolio>(res);
  },

  async getIndices(): Promise<ApiResponse<MarketIndex[]>> {
    const res = await apiFetch("/api/v1/stocks/indices", {
      method: "GET",
    });
    return handleResponse<MarketIndex[]>(res);
  },
};
