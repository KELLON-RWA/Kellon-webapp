import { apiFetch, handleResponse, type ApiResponse } from "./index";
import { handleTransferResponse } from "./transfers";

export const SOLANA_STOCKS_PROVIDER = "solana_xstocks";

export interface StockListing {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change24hPercentage?: number | string;
  changePercentage?: number | string;
  change?: number | string;
  logoUrl?: string;
  category?: string;
  provider: string;
  /** Settlement network supplied by newer stock providers. */
  settlementChain?: string;
  /** Backwards-compatible aliases used by provider integrations. */
  chain?: string;
  network?: string;
  /** On-chain metadata used to look up live pool data when a provider supplies it. */
  tokenAddress?: string;
  contractAddress?: string;
  address?: string;
  poolAddress?: string;
  pairAddress?: string;
  rwaCategory?: string;
  /** Issuer-side halt. The token still exists, but the venue refuses to route it. */
  isTradingHalted?: boolean;
  /** The underlying equity market. xStocks trade 24/5, so this is false at weekends. */
  marketOpen?: boolean;
  /** The catalogue instrument this listing is a venue of. */
  ticker?: string;
  /** What to send as `symbol` with this provider. Absent on older backends. */
  tradeKey?: string;
  /** Annual percentage yield for RWA vaults, treasury funds, and yielding instruments. */
  apy?: number | string;
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
  "fixed income",
]);

const RWA_SYMBOLS_REGEX =
  /^(GNT|GNTB|SGOV|TLT|FXI|SHY|IEF|BIL|BND|AGG|GLD|SLV|IAU|USO)(ON|[bcx])?$/i;

function normalizeStockCategory(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

export function isRwaStockListing(listing: StockListing): boolean {
  return (
    RWA_SYMBOLS_REGEX.test(listing.symbol) ||
    /\b(treasury|t-bills?|government bonds?|fixed income|sovereign reserve)\b/i.test(
      listing.name || "",
    ) ||
    [listing.rwaCategory, listing.category].some((category) =>
      RWA_CATEGORIES.has(normalizeStockCategory(category)),
    )
  );
}

export interface StockCatalogDeployment {
  provider: string;
  chain: string;
  symbol: string;
  tradeKey: string;
  address: string;
  decimals?: number;
  issuer: string;
}

export interface StockCatalogInstrument {
  ticker: string;
  displayTicker: string;
  name: string;
  logoUrl?: string;
  assetClass: "equity" | "etf" | "commodity" | "treasury" | "fund";
  region: string;
  sector?: string;
  themes: string[];
  domain?: string;
  categories: string[];
  deployments: StockCatalogDeployment[];
}

export interface StockCatalogCategory {
  id: string;
  label: string;
  title: string;
  description: string;
  icon: string;
  section: "tradfi" | "rwa";
  provider?: string;
}

export interface StockCatalog {
  version: string;
  categories: StockCatalogCategory[];
  instruments: StockCatalogInstrument[];
}

export interface StockTradePlan {
  chainKind?: "evm" | "solana";
  to?: string;
  data?: string;
  value?: string;
  chain?: string;
  approveTx?: { to: string; data: string; value: string };
  calls?: { to: string; data: string; value: string }[];
  transactionBase64?: string;
  quote: { symbol: string; price: number; shares: number; amountFiat: number };
}

export interface StockQuote {
  symbol: string;
  price: number;
  currency: string;
}

export interface StockBuildVerification {
  verificationCode?: string;
  verificationType?: string;
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
  side?: "buy" | "sell";
  shares?: number;
  sellAll?: boolean;
}

export interface StockSweepPlan {
  kind: "permit" | "transfer";
  chain: string;
  from: string;
  to: string;
  amount: string;
  typedData?: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  };
  deadline?: string;
}

export interface StockSweepExecution {
  chain: string;
  from: string;
  to: string;
  calls: StockTransactionCall[];
}

export interface BuildStockBuyTransactionResponse extends StockTransactionCall {
  chain: string;
  approveTx?: StockTransactionCall;
  calls?: StockTransactionCall[];
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
  side?: "buy" | "sell";
  fundingSymbol?: string;
  fundingChain?: string;
  verificationCode?: string;
  verificationType?: string;
  verificationCodes?: Array<{ type: string; code: string }>;
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
  /** Static metadata: categories, and what each listing is. Changes only with a backend deploy. */
  async getCatalog(): Promise<ApiResponse<StockCatalog>> {
    const res = await apiFetch(
      `/api/stocks/catalog`,
      { method: "GET" },
      { signed: false },
    );
    return handleResponse<StockCatalog>(res);
  },

  async planSweep(params: {
    symbol: string;
    provider: string;
  }): Promise<ApiResponse<StockSweepPlan>> {
    const res = await apiFetch("/api/v1/stocks/sweep/plan", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return handleTransferResponse<StockSweepPlan>(res);
  },

  async buildSweep(params: {
    symbol: string;
    provider: string;
    holder: string;
    amount: string;
    deadline: string;
    signature: string;
  }): Promise<ApiResponse<StockSweepExecution>> {
    const res = await apiFetch("/api/v1/stocks/sweep", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return handleTransferResponse<StockSweepExecution>(res);
  },
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

  /** The price a trade is actually built against, as opposed to the listing snapshot. */
  async getQuote(
    symbol: string,
    provider: string,
  ): Promise<ApiResponse<StockQuote>> {
    const res = await apiFetch(
      `/api/stocks/quote/${encodeURIComponent(symbol.toUpperCase())}?provider=${encodeURIComponent(provider)}`,
      { method: "GET" },
      { signed: false },
    );
    return handleResponse<StockQuote>(res);
  },

  /** Selling is the same two-phase build/settle path as buying: the backend never holds the shares. */
  async buildSellTransaction(
    params: {
      symbol: string;
      provider: string;
      shares?: number;
      sellAll?: boolean;
      fundingChain?: string;
      userAddress?: string;
    } & StockBuildVerification,
  ): Promise<ApiResponse<StockTradePlan>> {
    const res = await apiFetch("/api/stocks/build-tx", {
      method: "POST",
      body: JSON.stringify({ ...params, side: "sell" }),
    });
    return handleResponse<StockTradePlan>(res);
  },

  /**
   * Solana only. The fee sponsor signs at broadcast time, server-side, so the signed
   * transaction goes back to the backend rather than out to an RPC from here. This both
   * broadcasts and records the trade — confirmTransaction is not called for Solana.
   */
  async submitSolanaTransaction(params: {
    symbol: string;
    side: "buy" | "sell";
    transactionBase64: string;
    amountFiat?: number;
    shares?: number;
  }): Promise<ApiResponse<unknown>> {
    const res = await apiFetch("/api/stocks/submit-tx", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return handleResponse<unknown>(res);
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
    return handleTransferResponse<BuildStockBuyTransactionResponse>(res);
  },

  async confirmTransaction(
    params: ConfirmStockBuyTransactionParams,
  ): Promise<ApiResponse<BuyStockResponse>> {
    const res = await apiFetch("/api/v1/stocks/confirm-tx", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return handleTransferResponse<BuyStockResponse>(res);
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
