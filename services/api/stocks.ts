import { apiFetch, handleResponse, type ApiResponse } from "./index";
import { handleTransferResponse } from "./transfers";

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

const RWA_CATEGORIES = new Set([
  "rwa",
  "real world asset",
  "real world assets",
  "real estate",
  "commodity",
  "commodities",
  "bond",
  "bonds",
  "treasury",
  "treasuries",
  "private credit",
]);

function normalizeStockCategory(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

export function isRwaStockListing(listing: StockListing): boolean {
  return [listing.rwaCategory, listing.category].some((category) =>
    RWA_CATEGORIES.has(normalizeStockCategory(category)),
  );
}

export interface BuyStockParams {
  symbol: string;
  amountFiat: number;
  currency?: string;
  provider: string;
  fundingSymbol?: string;
  fundingChain?: string;
  verificationCode?: string;
  verificationType?: string;
  verificationCodes?: Array<{ type: string; code: string }>;
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
  verificationCode?: string;
  verificationType?: string;
  verificationCodes?: Array<{ type: string; code: string }>;
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

export interface StockTransactionCall {
  to: string;
  data: string;
  value: string;
}

export interface BuildStockBuyTransactionParams extends BuyStockParams {
  userAddress: string;
}

export interface BuildStockBuyTransactionResponse extends StockTransactionCall {
  chain: string;
  approveTx?: StockTransactionCall;
  quote: {
    symbol: string;
    price: number;
    shares: number;
    amountFiat: number;
  };
}

export interface ConfirmStockBuyTransactionParams {
  symbol: string;
  amountFiat: number;
  shares: number;
  provider: string;
  txHash: string;
  fundingSymbol?: string;
  fundingChain?: string;
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
  async getAvailableStocks(
    provider = "all",
  ): Promise<ApiResponse<StockListing[]>> {
    const res = await apiFetch(
      `/api/stocks?provider=${encodeURIComponent(provider)}`,
      { method: "GET" },
      { signed: false },
    );
    return handleResponse<StockListing[]>(res);
  },

  async sellStock(
    params: SellStockParams,
  ): Promise<ApiResponse<SellStockResponse>> {
    const res = await apiFetch("/api/v1/stocks/sell", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return handleTransferResponse<SellStockResponse>(res);
  },

  async buildBuyTransaction(
    params: BuildStockBuyTransactionParams,
  ): Promise<ApiResponse<BuildStockBuyTransactionResponse>> {
    const res = await apiFetch("/api/v1/stocks/build-tx", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return handleResponse<BuildStockBuyTransactionResponse>(res);
  },

  async confirmTransaction(
    params: ConfirmStockBuyTransactionParams,
  ): Promise<ApiResponse<BuyStockResponse>> {
    const res = await apiFetch("/api/v1/stocks/confirm-tx", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return handleResponse<BuyStockResponse>(res);
  },

  async getPortfolio(): Promise<ApiResponse<StockPortfolio>> {
    const res = await apiFetch("/api/v1/stocks/portfolio", {
      method: "GET",
    });
    return handleResponse<StockPortfolio>(res);
  },

  async getIndices(): Promise<ApiResponse<MarketIndex[]>> {
    const res = await apiFetch(
      "/api/stocks/indices",
      { method: "GET" },
      { signed: false },
    );
    return handleResponse<MarketIndex[]>(res);
  },
};
