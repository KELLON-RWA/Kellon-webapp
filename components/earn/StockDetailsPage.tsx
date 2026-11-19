"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Building2,
  CandlestickChart,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Landmark,
  LineChart,
  MapPin,
  RefreshCw,
  Scale,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  Vote,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import HydrationSafeRelativeTime from "@/components/HydrationSafeRelativeTime";
import {
  getStockTransactionFiatAmount,
  getStockTransactionShares,
  getTransactionAmountLabel,
  getTransactionStatusClasses,
  getTransactionStatusLabel,
  getTransactionSymbol,
  getTransactionTitle,
} from "@/lib/dashboard-utils";
import { getActivityRefetchInterval } from "@/lib/transaction-polling";
import { transactionService } from "@/services/api/transactions";
import {
  stockResearchService,
  type DexScreenerPool,
  type FinnhubMarketData,
  type StockTradingData,
} from "@/services/api/stock-research";
import type { CompanyNewsArticle, CompanyNewsSource } from "@/lib/company-news";
import { getCompanyNewsName } from "@/lib/company-news";
import type { NewsCompanyFacts } from "@/lib/company-news-facts";
import type { WikidataCompanyProfile } from "@/lib/wikidata-company";
import { DANGOTE_COMPANY_PROFILE } from "@/lib/dangote-company-profile";
import CompanyNewsThumbnail from "@/components/earn/CompanyNewsThumbnail";
import { isRwaStockListing, stocksService } from "@/services/api/stocks";
import type { Transaction, User } from "@/types/db";
import StockActionDialog, { type StockActionType } from "./StockActionDialog";
import StockNairaPrice from "./StockNairaPrice";
import StockTradingChart, {
  type ChartType,
  type HoveredData,
  type IndicatorType,
} from "./StockTradingChart";
import {
  formatUsd,
  getStockProviderLabel,
  getStockSettlementChain,
} from "./earn-utils";
import {
  getDisplayStockName,
  getDisplayStockSymbol,
  getListingChange,
  getStockLogoUrl,
  StockSymbol,
  getUnderlyingTicker,
  StockLogo,
} from "./EarnPage";

const STOCK_PAGE_TABS = ["Charts", "Company", "Token Info", "Data"] as const;
type StockPageTab = (typeof STOCK_PAGE_TABS)[number];

const MAIN_TIMEFRAMES = ["Line", "1m", "15m", "1h", "4h", "1D"] as const;
const MORE_TIMEFRAMES = [
  { label: "1s", desc: "1 Sec" },
  { label: "5m", desc: "5 Min" },
  { label: "30m", desc: "30 Min" },
  { label: "2h", desc: "2 Hour" },
  { label: "1W", desc: "1 Week" },
  { label: "1M", desc: "1 Month" },
  { label: "3M", desc: "3 Month" },
] as const;

function getListingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function formatCompactVolume(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toLocaleString();
}

function formatCompactTurnover(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toLocaleString()}`;
}

const STOCK_DESCRIPTIONS: Record<string, string> = {
  AAPL: "Apple Inc. is an American multinational technology company known for the iPhone, Mac, iPad, Apple Watch, and services including the App Store and Apple Music.",
  AMZN: "Amazon.com, Inc. is a multinational technology company focused on e-commerce, cloud computing, digital streaming, and artificial intelligence.",
  GOOGL:
    "Alphabet Inc. is the parent company of Google and businesses spanning search, advertising, cloud computing, and artificial intelligence.",
  META: "Meta Platforms, Inc. builds products that help people connect and share, including Facebook, Instagram, WhatsApp, and virtual reality products.",
  MSFT: "Microsoft Corporation develops software, cloud services, devices, and artificial intelligence products for people and businesses worldwide.",
  NFLX: "Netflix, Inc. is an entertainment service offering films, series, and games to members around the world.",
};

type CompanyProfile = {
  name?: string;
  description?: string;
  facts?: Array<{ label: string; value: string }>;
  sources?: Array<{ label: string; url: string }>;
  reviewedAt?: string;
  website: string;
  sector: string;
  industry: string;
  ceo?: string;
  headquarters?: string;
  founded?: string;
  employees?: string;
};

const COMPANY_PROFILES: Record<string, CompanyProfile> = {
  DPRI: DANGOTE_COMPANY_PROFILE,
  AAPL: {
    website: "https://www.apple.com",
    sector: "Technology",
    industry: "Consumer electronics",
    ceo: "Tim Cook",
    headquarters: "Cupertino, California, USA",
    founded: "1976",
    employees: "161,000",
  },
  AMZN: {
    website: "https://aboutamazon.com",
    sector: "Consumer cyclical",
    industry: "Internet retail",
    ceo: "Andy Jassy",
    headquarters: "Seattle, Washington, USA",
    founded: "1994",
  },
  GOOGL: {
    website: "https://abc.xyz",
    sector: "Communication services",
    industry: "Internet content & information",
    ceo: "Sundar Pichai",
    headquarters: "Mountain View, California, USA",
    founded: "2015",
  },
  META: {
    website: "https://about.meta.com",
    sector: "Communication services",
    industry: "Internet content & information",
    ceo: "Mark Zuckerberg",
    headquarters: "Menlo Park, California, USA",
    founded: "2004",
  },
  MSFT: {
    website: "https://www.microsoft.com",
    sector: "Technology",
    industry: "Software",
    ceo: "Satya Nadella",
    headquarters: "Redmond, Washington, USA",
    founded: "1975",
  },
  NFLX: {
    website: "https://about.netflix.com",
    sector: "Communication services",
    industry: "Entertainment",
    ceo: "Greg Peters & Ted Sarandos",
    headquarters: "Los Gatos, California, USA",
    founded: "1997",
  },
};

function matchesStockActivity(
  transaction: Transaction,
  stockSymbol: string,
  underlyingTicker: string,
  provider?: string,
) {
  if (!["BUY", "SELL"].includes(transaction.type)) return false;

  const transactionSymbol = String(transaction.symbol || "").toUpperCase();
  const resolvedSymbol = getTransactionSymbol(transaction).toUpperCase();
  const normalizedStockSymbol = stockSymbol.toUpperCase();
  const matchesExactListing = transactionSymbol === normalizedStockSymbol;
  const matchesUnderlying =
    getUnderlyingTicker(transactionSymbol) === underlyingTicker ||
    getUnderlyingTicker(resolvedSymbol) === underlyingTicker;

  if (!matchesExactListing && !matchesUnderlying) return false;
  if (matchesExactListing || !provider) return true;

  const metadata = JSON.stringify(transaction.metadata || {}).toLowerCase();
  return metadata.includes(provider.toLowerCase());
}

export default function StockDetailsPage({
  profile,
  symbol,
}: {
  profile: User;
  symbol: string;
}) {
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<StockPageTab>("Charts");
  const [activeInterval, setActiveInterval] = useState<string>("15m");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [stockAction, setStockAction] = useState<StockActionType | null>(null);
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);

  const handleHoverDataChange = useCallback((data: HoveredData | null) => {
    setHoveredData(data);
  }, []);

  // Indicators toggle set (MA and VOL on by default)
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorType>>(
    new Set(["MA", "VOL"]),
  );

  const toggleIndicator = (ind: IndicatorType) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) {
        next.delete(ind);
      } else {
        next.add(ind);
      }
      return next;
    });
  };

  const normalizedSymbol = getUnderlyingTicker(symbol);

  // Queries
  const {
    data: stocks = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["available-stocks"],
    queryFn: async () => {
      const response = await stocksService.getAvailableStocks("all");
      return response.data;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const stockOptions = useMemo(
    () =>
      stocks.filter(
        (item) =>
          getListingSymbol(item.symbol) === normalizedSymbol ||
          getUnderlyingTicker(item.symbol, item.provider) === normalizedSymbol,
      ),
    [normalizedSymbol, stocks],
  );
  const stock = stockOptions[0];
  const isRwa = Boolean(stock && isRwaStockListing(stock));

  const underlyingTicker = stock
    ? getUnderlyingTicker(stock.symbol, stock.provider)
    : normalizedSymbol;

  const displayStockSymbol = stock?.symbol || normalizedSymbol;
  const name = stock ? getDisplayStockName(stock.name) : "Stock";
  const stockLogoUrl = getStockLogoUrl(displayStockSymbol, stock?.logoUrl);

  const settlementChain = stock
    ? getStockSettlementChain(
        stock.provider,
        stock.settlementChain || stock.chain || stock.network,
      ).toUpperCase()
    : "BASE";

  const networkBadge = `${settlementChain}20`;

  // Fetch full candles and 24h trading statistics
  const {
    data: tradingData,
    isLoading: isCandlesLoading,
    refetch: refetchCandles,
  } = useQuery({
    queryKey: ["stock-candles", underlyingTicker, activeInterval],
    queryFn: () =>
      stockResearchService.getCandles(
        underlyingTicker,
        activeInterval === "Line" ? "15m" : activeInterval,
      ),
    enabled: Boolean(underlyingTicker) && !isRwa,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Finnhub data
  const { data: exchangeMarketData, refetch: refetchFinnhubMarketData } =
    useQuery({
      queryKey: ["finnhub-stock-market-data", normalizedSymbol],
      queryFn: () =>
        stockResearchService.getFinnhubMarketData(normalizedSymbol),
      enabled: Boolean(stock) && !isRwa,
      staleTime: 60_000,
      refetchInterval: 60_000,
    });

  const finnhubMarketData = isRwa ? undefined : exchangeMarketData;

  // Company research queries
  const companyNewsName = getCompanyNewsName(stock?.name || "");
  const { data: companyProfileData, refetch: refetchCompanyProfile } = useQuery(
    {
      queryKey: ["wikidata-company-profile", normalizedSymbol, companyNewsName],
      queryFn: () =>
        stockResearchService.getCompanyProfile(
          normalizedSymbol,
          companyNewsName,
        ),
      enabled: !isRwa && Boolean(stock) && activeTab === "Company",
      staleTime: 24 * 60 * 60_000,
    },
  );

  const { data: companyNewsFactsData } = useQuery({
    queryKey: ["company-news-facts", normalizedSymbol, companyNewsName],
    queryFn: () =>
      stockResearchService.getCompanyNewsFacts(
        normalizedSymbol,
        companyNewsName,
      ),
    enabled:
      !isRwa &&
      Boolean(stock) &&
      Boolean(companyNewsName) &&
      activeTab === "Company",
    staleTime: 5 * 60_000,
  });

  const {
    data: companyNewsData,
    isLoading: isCompanyNewsLoading,
    isError: isCompanyNewsError,
    refetch: refetchCompanyNews,
  } = useQuery({
    queryKey: ["company-news", normalizedSymbol, companyNewsName],
    queryFn: () =>
      stockResearchService.getCompanyNews(normalizedSymbol, companyNewsName),
    enabled:
      Boolean(stock) && Boolean(companyNewsName) && activeTab === "Company",
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  // DexScreener query
  const dexListing = stockOptions.find(
    (option) =>
      option.pairAddress ||
      option.poolAddress ||
      option.tokenAddress ||
      option.contractAddress ||
      option.address,
  );
  const dexChain = dexListing
    ? getStockSettlementChain(
        dexListing.provider,
        dexListing.settlementChain || dexListing.chain || dexListing.network,
      )
    : undefined;
  const dexTokenAddress =
    dexListing?.tokenAddress ||
    dexListing?.contractAddress ||
    dexListing?.address;
  const dexPairAddress = dexListing?.pairAddress || dexListing?.poolAddress;

  const {
    data: dexScreenerData,
    isLoading: isDexScreenerLoading,
    refetch: refetchDexScreener,
  } = useQuery({
    queryKey: [
      "dexscreener-stock-pool",
      dexChain,
      dexTokenAddress,
      dexPairAddress,
    ],
    queryFn: () =>
      stockResearchService.getDexScreenerPool({
        chain: dexChain || "",
        tokenAddress: dexTokenAddress,
        pairAddress: dexPairAddress,
      }),
    enabled:
      activeTab === "Data" &&
      Boolean(dexChain && (dexTokenAddress || dexPairAddress)),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // User portfolio & transactions
  const { data: stockPortfolio, refetch: refetchPortfolio } = useQuery({
    queryKey: ["stock-portfolio"],
    queryFn: async () => (await stocksService.getPortfolio()).data,
    staleTime: 30_000,
  });

  const {
    data: accountTransactions = [],
    isLoading: isStockActivitiesLoading,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const response = await transactionService.getTransactions();
      return response.data || [];
    },
    staleTime: 5_000,
    refetchInterval: (query) => getActivityRefetchInterval(query.state.data),
  });

  const holding = useMemo(() => {
    const holdings = stockPortfolio?.holdings || [];
    return (
      holdings.find(
        (item) =>
          getListingSymbol(item.symbol) === normalizedSymbol ||
          getUnderlyingTicker(item.symbol, item.provider) === normalizedSymbol,
      ) || null
    );
  }, [normalizedSymbol, stockPortfolio?.holdings]);

  const canSell = Number(holding?.shares || 0) > 0;

  const stockActivities = useMemo(
    () =>
      [...accountTransactions]
        .filter((transaction) =>
          stock
            ? matchesStockActivity(
                transaction,
                stock.symbol,
                normalizedSymbol,
                undefined,
              )
            : false,
        )
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        ),
    [accountTransactions, normalizedSymbol, stock],
  );

  // Compute average sell price and past sell activities
  const sellTransactions = useMemo(
    () => stockActivities.filter((t) => t.type === "SELL"),
    [stockActivities],
  );

  const avgSellPrice = useMemo(() => {
    let totalSellFiat = 0;
    let totalSellShares = 0;
    for (const t of sellTransactions) {
      const shares = getStockTransactionShares(t) || 0;
      const fiat = getStockTransactionFiatAmount(t) || Number(t.amount || 0);
      if (shares > 0 && fiat > 0) {
        totalSellFiat += fiat;
        totalSellShares += shares;
      }
    }
    return totalSellShares > 0 ? totalSellFiat / totalSellShares : 0;
  }, [sellTransactions]);

  const handleRefreshAll = () => {
    toast.info("Refreshing stock data...");
    void Promise.all([
      refetch(),
      refetchCandles(),
      refetchFinnhubMarketData(),
      refetchPortfolio(),
      refetchTransactions(),
      refetchCompanyProfile(),
      refetchCompanyNews(),
      refetchDexScreener(),
    ]);
  };

  const handleToggleWatchlist = () => {
    setIsWatchlisted((prev) => {
      const next = !prev;
      toast.success(
        next
          ? `Added ${displayStockSymbol} to watchlist`
          : `Removed ${displayStockSymbol} from watchlist`,
      );
      return next;
    });
  };

  if (!isLoading && !stock) {
    return (
      <main className="container mx-auto flex min-h-[70dvh] max-w-2xl items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-lg font-bold text-cryptoNight dark:text-white">
            Stock not found
          </h1>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => router.push("/earn?category=stocks")}
          >
            Back to stocks
          </Button>
        </div>
      </main>
    );
  }

  // Price & Stats
  const currentPrice =
    tradingData?.stats?.currentPrice ||
    Number(finnhubMarketData?.quote?.current || stock?.price || 265.61);

  const changePercent =
    tradingData?.stats?.change24hPercent ??
    finnhubMarketData?.quote?.percentChange ??
    0;

  const isPositive = changePercent >= 0;

  const high24h =
    tradingData?.stats?.high24h ||
    finnhubMarketData?.quote?.high ||
    currentPrice * 1.02;

  const low24h =
    tradingData?.stats?.low24h ||
    finnhubMarketData?.quote?.low ||
    currentPrice * 0.98;

  const vol24h = tradingData?.stats?.vol24h || 23_670_000;
  const turnover24h = tradingData?.stats?.turnover24h || vol24h * currentPrice;

  // Performance columns
  const performance = tradingData?.performance || {
    today: Number(changePercent.toFixed(2)),
    days7: Number((changePercent * 0.9).toFixed(2)),
    days30: 0.94,
    days90: 2.5,
    days180: -0.46,
  };

  const candles = tradingData?.candles || [];

  return (
    <main className="container mx-auto min-h-[100dvh] w-full max-w-7xl px-4 pb-36 pt-4 md:px-6 md:pb-24 md:pt-28">
      {/* 1. Header Bar */}
      <header className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-secondary-60/60 text-white transition hover:bg-secondary-60 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 text-center">
          <h1 className="truncate text-sm font-bold text-white sm:text-base">
            {name.replace(/\s*Tokenized Stock$/i, "")} Tokenized Stock
          </h1>
          <p className="text-xs text-gray-400">
            {displayStockSymbol} · {networkBadge}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleWatchlist}
            aria-label="Watchlist"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-secondary-60/60 text-white transition hover:bg-secondary-60 active:scale-95"
          >
            <Star
              className={cn(
                "h-4 w-4",
                isWatchlisted
                  ? "fill-primary-50 text-primary-50"
                  : "text-gray-300",
              )}
            />
          </button>
          <button
            type="button"
            onClick={handleRefreshAll}
            aria-label="Refresh"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-secondary-60/60 text-white transition hover:bg-secondary-60 active:scale-95"
          >
            <RefreshCw
              className={cn("h-4 w-4 text-gray-300", isRefetching && "animate-spin")}
            />
          </button>
        </div>
      </header>

      {/* 2. Top Tabs: Charts, Company, Token Info, Data */}
      <nav
        className="mb-4 grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-secondary-60/40 p-1 backdrop-blur"
        aria-label="Stock tabs"
      >
        {STOCK_PAGE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "h-9 rounded-lg text-xs font-semibold transition sm:text-sm",
              activeTab === tab
                ? "bg-primary-60 text-white shadow-md"
                : "text-gray-400 hover:text-white hover:bg-white/5",
            )}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Charts" ? (
        <div className="space-y-4">
          {/* 3. Stock Summary Card */}
          <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-4 sm:p-5 shadow-lg backdrop-blur">
            {/* Top Row: Logo + Symbol + Network Badge */}
            <div className="flex items-center gap-2.5">
              <StockLogo symbol={displayStockSymbol} src={stockLogoUrl} size="sm" />
              <span className="text-base font-bold text-white sm:text-lg">
                {displayStockSymbol}
              </span>
              <span className="rounded border border-purple-800/30 bg-purple-950/40 px-2 py-0.5 text-[11px] font-medium text-purple-300">
                {networkBadge}
              </span>
            </div>

            {/* Subtle Divider Line */}
            <div className="my-3.5 border-t border-white/10" />

            {/* Bottom Row: Price & 24h Pill on Left, 2x2 Stats Grid on Right */}
            <div className="flex items-center justify-between gap-4">
              {/* Left Column: Price & 24h Change Pill */}
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums sm:text-3xl",
                    isPositive ? "text-emerald-400" : "text-rose-500",
                  )}
                >
                  {formatUsd(currentPrice)}
                </p>
                <div className="mt-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                      isPositive
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400",
                    )}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {isPositive ? "+" : ""}
                    {changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Right Column: 2x2 Stats Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-left sm:gap-x-12">
                <div>
                  <p className="text-[11px] text-gray-400">24h High</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:text-sm">
                    {formatUsd(high24h)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">
                    24h Vol ({displayStockSymbol})
                  </p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:text-sm">
                    {formatCompactVolume(vol24h)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">24h Low</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:text-sm">
                    {formatUsd(low24h)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">24h Turnover ($)</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:text-sm">
                    {formatCompactTurnover(turnover24h)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Timeframe Bar & Chart Controls */}
          <section className="relative rounded-2xl border border-white/10 bg-secondary-50/50 p-2 sm:p-3 backdrop-blur">
            <div className="flex items-center justify-between gap-1 text-xs">
              <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar sm:gap-2">
                {MAIN_TIMEFRAMES.map((tf) => {
                  const isActive =
                    (tf === "Line" && chartType === "line") ||
                    (tf !== "Line" && chartType === "candlestick" && activeInterval === tf);

                  return (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        if (tf === "Line") {
                          setChartType("line");
                        } else {
                          setChartType("candlestick");
                          setActiveInterval(tf);
                        }
                      }}
                      className={cn(
                        "relative px-2.5 py-1.5 font-semibold transition rounded-md",
                        isActive
                          ? "text-white bg-primary-60/20 text-primary-40"
                          : "text-gray-400 hover:text-white",
                      )}
                    >
                      {tf}
                      {isActive ? (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-60 rounded-full" />
                      ) : null}
                    </button>
                  );
                })}

                {/* More dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsMoreOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 font-semibold transition rounded-md",
                      MORE_TIMEFRAMES.some((m) => m.label === activeInterval)
                        ? "text-primary-40 bg-primary-60/20"
                        : "text-gray-400 hover:text-white",
                    )}
                  >
                    <span>
                      {MORE_TIMEFRAMES.find((m) => m.label === activeInterval)
                        ?.label || "More"}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {isMoreOpen ? (
                    <div className="absolute left-0 top-full z-30 mt-2 grid w-72 grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-secondary-60/95 p-3 shadow-2xl backdrop-blur">
                      {MORE_TIMEFRAMES.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setActiveInterval(item.label);
                            setChartType("candlestick");
                            setIsMoreOpen(false);
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center rounded-lg p-2 transition",
                            activeInterval === item.label
                              ? "bg-primary-60 text-white"
                              : "bg-white/5 text-gray-300 hover:bg-white/10",
                          )}
                        >
                          <span className="text-xs font-bold">{item.label}</span>
                          <span className="text-[10px] text-gray-400">
                            {item.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Chart Mode Toggle on Far Right */}
              <button
                type="button"
                onClick={() =>
                  setChartType((prev) =>
                    prev === "candlestick" ? "line" : "candlestick",
                  )
                }
                title="Toggle Candlestick / Line"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-primary-40 hover:bg-white/10"
              >
                {chartType === "candlestick" ? (
                  <CandlestickChart className="h-4 w-4" />
                ) : (
                  <LineChart className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* 5. OHLC & MA Readout */}
            <div className="mt-3 border-t border-white/5 pt-2">
              <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-400">
                <span>{hoveredData?.timeStr || "Loading..."}</span>
                {hoveredData ? (
                  <div className="flex items-center gap-2 tabular-nums">
                    <span>
                      O <span className="text-white">{hoveredData.open.toFixed(2)}</span>
                    </span>
                    <span>
                      H <span className="text-emerald-400">{hoveredData.high.toFixed(2)}</span>
                    </span>
                    <span>
                      L <span className="text-rose-400">{hoveredData.low.toFixed(2)}</span>
                    </span>
                    <span>
                      C <span className={hoveredData.close >= hoveredData.open ? "text-emerald-400" : "text-rose-400"}>
                        {hoveredData.close.toFixed(2)}
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>

              {activeIndicators.has("MA") && hoveredData ? (
                <div className="mt-1 flex items-center gap-3 text-[10px] tabular-nums">
                  {hoveredData.ma5 !== undefined ? (
                    <span className="text-amber-400 font-medium">
                      MA(5): {hoveredData.ma5.toFixed(2)}
                    </span>
                  ) : null}
                  {hoveredData.ma10 !== undefined ? (
                    <span className="text-purple-400 font-medium">
                      MA(10): {hoveredData.ma10.toFixed(2)}
                    </span>
                  ) : null}
                  {hoveredData.ma20 !== undefined ? (
                    <span className="text-cyan-400 font-medium">
                      MA(20): {hoveredData.ma20.toFixed(2)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* 6. Trading Chart Canvas */}
            <div className="mt-2 h-[340px] w-full sm:h-[420px] lg:h-[480px]">
              {isCandlesLoading && candles.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-60 border-t-transparent" />
                </div>
              ) : (
                <StockTradingChart
                  candles={candles}
                  chartType={chartType}
                  indicators={activeIndicators}
                  avgBuyPrice={holding?.avgBuyPrice}
                  avgSellPrice={avgSellPrice > 0 ? avgSellPrice : undefined}
                  onHoverDataChange={handleHoverDataChange}
                  className="h-full"
                />
              )}
            </div>

            {/* Volume Status bar */}
            {activeIndicators.has("VOL") && hoveredData ? (
              <div className="mt-1 flex items-center gap-3 border-t border-white/5 pt-1.5 text-[10px] text-gray-400 tabular-nums">
                <span>VOL: {formatCompactVolume(hoveredData.volume)}</span>
                {hoveredData.volMa5 !== undefined ? (
                  <span className="text-amber-400 font-medium">
                    MA(5): {formatCompactVolume(hoveredData.volMa5)}
                  </span>
                ) : null}
                {hoveredData.volMa10 !== undefined ? (
                  <span className="text-purple-400 font-medium">
                    MA(10): {formatCompactVolume(hoveredData.volMa10)}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* 7. Indicator Selector Pills */}
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                {(["MA", "EMA", "BOLL", "SAR"] as IndicatorType[]).map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggleIndicator(ind)}
                    className={cn(
                      "rounded px-2 py-0.5 font-semibold transition",
                      activeIndicators.has(ind)
                        ? "bg-primary-60/25 border border-primary-50/40 text-primary-40"
                        : "text-gray-400 hover:text-white",
                    )}
                  >
                    {ind}
                  </button>
                ))}
              </div>

              <div className="h-3.5 w-px bg-white/10" />

              <div className="flex items-center gap-1.5">
                {(["VOL", "MACD", "RSI", "KDJ"] as IndicatorType[]).map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggleIndicator(ind)}
                    className={cn(
                      "rounded px-2 py-0.5 font-semibold transition",
                      activeIndicators.has(ind)
                        ? "bg-primary-60/25 border border-primary-50/40 text-primary-40"
                        : "text-gray-400 hover:text-white",
                    )}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 8. 5-Column Historical Performance Table */}
          <section className="grid grid-cols-5 gap-1 rounded-2xl border border-white/10 bg-secondary-50/70 p-3 text-center backdrop-blur">
            <div>
              <p className="text-[10px] text-gray-400 sm:text-xs">Today</p>
              <p
                className={cn(
                  "mt-1 text-xs font-bold tabular-nums sm:text-sm",
                  performance.today >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {performance.today >= 0 ? "+" : ""}
                {performance.today.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 sm:text-xs">7 Days</p>
              <p
                className={cn(
                  "mt-1 text-xs font-bold tabular-nums sm:text-sm",
                  performance.days7 >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {performance.days7 >= 0 ? "+" : ""}
                {performance.days7.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 sm:text-xs">30 Days</p>
              <p
                className={cn(
                  "mt-1 text-xs font-bold tabular-nums sm:text-sm",
                  performance.days30 >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {performance.days30 >= 0 ? "+" : ""}
                {performance.days30.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 sm:text-xs">90 Days</p>
              <p
                className={cn(
                  "mt-1 text-xs font-bold tabular-nums sm:text-sm",
                  performance.days90 >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {performance.days90 >= 0 ? "+" : ""}
                {performance.days90.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 sm:text-xs">180 Days</p>
              <p
                className={cn(
                  "mt-1 text-xs font-bold tabular-nums sm:text-sm",
                  performance.days180 >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {performance.days180 >= 0 ? "+" : ""}
                {performance.days180.toFixed(2)}%
              </p>
            </div>
          </section>

          {/* 9 & 10. Position & Activity Grid (side-by-side on lg, stacked on mobile) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 9. My Position Card */}
            <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-4 sm:p-5 backdrop-blur flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">My Position</h2>
                  {holding ? (
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                        holding.unrealizedPnL >= 0
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400",
                      )}
                    >
                      {holding.unrealizedPnL >= 0 ? "+" : ""}
                      {holding.unrealizedPnLPercentage.toFixed(2)}%
                    </span>
                  ) : null}
                </div>

                {!holding ? (
                  <div className="my-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <WalletCards className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-white">
                      No Active Position
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-gray-400">
                      You do not own any {displayStockSymbol} shares yet. Start
                      investing with fractional shares from just $1.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-y-4 border-t border-white/5 pt-4 text-xs">
                    <div>
                      <p className="text-gray-400">Shares Owned</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-white">
                        {holding.shares.toFixed(4)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400">Total Value</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-white">
                        {formatUsd(holding.currentValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Average Cost</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-white">
                        {formatUsd(holding.avgBuyPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400">Total Return</p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-bold tabular-nums",
                          holding.unrealizedPnL >= 0
                            ? "text-emerald-400"
                            : "text-rose-400",
                        )}
                      >
                        {holding.unrealizedPnL >= 0 ? "+" : ""}
                        {formatUsd(holding.unrealizedPnL)} (
                        {holding.unrealizedPnL >= 0 ? "+" : ""}
                        {holding.unrealizedPnLPercentage.toFixed(2)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Average Sell</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-amber-400">
                        {avgSellPrice > 0 ? formatUsd(avgSellPrice) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400">Realized Status</p>
                      <p className="mt-1 text-sm font-bold text-white">
                        {sellTransactions.length > 0 ? "Settled Exit" : "Open Position"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 10. Recent Activity Card */}
            <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-4 sm:p-5 backdrop-blur flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">Recent Activity</h2>
                  {stockActivities.length > 0 ? (
                    <span className="text-xs text-gray-400">
                      {Math.min(stockActivities.length, 10)} of {stockActivities.length}
                    </span>
                  ) : null}
                </div>

                {isStockActivitiesLoading ? (
                  <div className="mt-4 space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-14 animate-pulse rounded-xl bg-white/5"
                      />
                    ))}
                  </div>
                ) : stockActivities.length === 0 ? (
                  <div className="my-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <Clock className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-white">
                      No Past Transactions
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-gray-400">
                      Your completed buy and sell orders for {displayStockSymbol} will
                      appear here.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-white/5">
                    {stockActivities.slice(0, 10).map((transaction) => {
                      const isSale = transaction.type === "SELL";
                      const dateStr = new Date(transaction.createdAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" },
                      );
                      const shares = getStockTransactionShares(transaction) || 0;
                      const fiatAmount =
                        getStockTransactionFiatAmount(transaction) ||
                        Number(transaction.amount || 0);

                      return (
                        <div
                          key={transaction.id}
                          onClick={() => router.push(`/transactions/${transaction.id}`)}
                          className="flex cursor-pointer items-center justify-between py-3 transition hover:opacity-80"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-xl border",
                                isSale
                                  ? "border-purple-800/40 bg-purple-950/40 text-purple-300"
                                  : "border-emerald-800/40 bg-emerald-950/40 text-emerald-300",
                              )}
                            >
                              {isSale ? (
                                <TrendingDown className="h-4 w-4" />
                              ) : (
                                <TrendingUp className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white sm:text-sm">
                                {isSale ? "Sell" : "Buy"} {displayStockSymbol}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                {dateStr} • {settlementChain.toLowerCase()}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p
                              className={cn(
                                "text-xs font-bold tabular-nums sm:text-sm",
                                isSale ? "text-purple-300" : "text-emerald-400",
                              )}
                            >
                              {isSale ? "-" : "+"}
                              {shares > 0 ? shares.toFixed(6) : "0.00"} {displayStockSymbol}
                            </p>
                            <p className="text-[11px] text-gray-400 tabular-nums">
                              {isSale ? "+" : "-"}${fiatAmount.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : (
        /* Company, Token Info, and Data tabs */
        <StockResearchContent
          tab={activeTab}
          title={displayStockSymbol}
          description={
            STOCK_DESCRIPTIONS[underlyingTicker] ||
            `${name} is available as a tokenized stock on Kellon.`
          }
          company={COMPANY_PROFILES[underlyingTicker]}
          finnhubMarketData={finnhubMarketData}
          companyNews={companyNewsData?.articles || []}
          newsFacts={companyNewsFactsData?.facts || {}}
          wikidataProfile={companyProfileData?.profile || undefined}
          companyNewsSource={companyNewsData?.source}
          isCompanyNewsLoading={isCompanyNewsLoading}
          isCompanyNewsError={isCompanyNewsError}
          provider={stock?.provider || "Backing"}
          settlementChain={settlementChain}
          price={currentPrice}
          chartHigh={high24h}
          chartLow={low24h}
          dexPool={dexScreenerData?.pair || null}
          isDexScreenerLoading={isDexScreenerLoading}
          hasDexPoolMetadata={Boolean(dexTokenAddress || dexPairAddress)}
        />
      )}

      {/* 11. Sticky Bottom Action Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-cryptoNight/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="container mx-auto flex max-w-7xl items-center gap-3">
          {canSell ? (
            <>
              <Button
                type="button"
                className="h-12 flex-1 rounded-xl bg-rose-500 text-base font-bold text-white shadow-lg shadow-rose-900/20 hover:bg-rose-600 active:scale-[0.98] transition"
                onClick={() => setStockAction("sell")}
              >
                Sell
              </Button>
              <Button
                type="button"
                className="h-12 flex-1 rounded-xl bg-gradient-to-r from-primary-70 to-primary-60 text-base font-bold text-white shadow-lg shadow-primary-60/20 hover:brightness-110 active:scale-[0.98] transition"
                onClick={() => setStockAction("buy")}
              >
                Buy
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-primary-70 to-primary-60 text-base font-bold text-white shadow-lg shadow-primary-60/20 hover:brightness-110 active:scale-[0.98] transition"
              onClick={() => setStockAction("buy")}
            >
              Buy
            </Button>
          )}
        </div>
      </footer>

      {/* Stock Action Dialog (Buy & Sell) */}
      <StockActionDialog
        action={stockAction || "buy"}
        stock={stock || null}
        holding={holding}
        stockOptions={stockOptions}
        profile={profile}
        open={Boolean(stockAction)}
        onOpenChange={(open) => {
          if (!open) setStockAction(null);
        }}
        onComplete={async () => {
          await Promise.all([refetch(), refetchPortfolio(), refetchTransactions()]);
        }}
        onViewPosition={() => setActiveTab("Charts")}
      />
    </main>
  );
}

function StockResearchContent({
  tab,
  title,
  description,
  company,
  finnhubMarketData,
  companyNews,
  newsFacts,
  wikidataProfile,
  companyNewsSource,
  isCompanyNewsLoading,
  isCompanyNewsError,
  provider,
  settlementChain,
  price,
  chartHigh,
  chartLow,
  dexPool,
  isDexScreenerLoading,
  hasDexPoolMetadata,
}: {
  tab: Exclude<StockPageTab, "Charts">;
  title: string;
  description: string;
  company?: CompanyProfile;
  finnhubMarketData?: FinnhubMarketData;
  companyNews: CompanyNewsArticle[];
  newsFacts: NewsCompanyFacts;
  wikidataProfile?: WikidataCompanyProfile;
  companyNewsSource?: CompanyNewsSource;
  isCompanyNewsLoading: boolean;
  isCompanyNewsError: boolean;
  provider: string;
  settlementChain: string;
  price: number;
  chartHigh: number;
  chartLow: number;
  dexPool: DexScreenerPool | null;
  isDexScreenerLoading: boolean;
  hasDexPoolMetadata: boolean;
}) {
  const officialProfile = finnhubMarketData?.profile;
  const metric = (key: string) => finnhubMarketData?.metrics?.[key];
  const hasFinnhubData = Boolean(
    finnhubMarketData?.quote ||
      officialProfile ||
      Object.keys(finnhubMarketData?.metrics || {}).length,
  );

  if (tab === "Company") {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-xl font-bold text-white">
              {company?.name ||
                wikidataProfile?.name ||
                officialProfile?.name ||
                title}
            </h2>
            <span className="rounded-full border border-primary-60/40 bg-primary-70/10 px-2.5 py-1 text-xs font-semibold text-primary-40">
              {company?.facts
                ? company.industry
                : wikidataProfile?.industry ||
                  officialProfile?.industry ||
                  company?.sector ||
                  "Public equity"}
            </span>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-400">
            {company?.description || wikidataProfile?.description || description}
          </p>
          {company?.website ||
          wikidataProfile?.website ||
          officialProfile?.website ? (
            <a
              href={
                company?.website ||
                wikidataProfile?.website ||
                officialProfile?.website
              }
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-primary-60/40 px-5 text-sm font-semibold text-primary-40 transition hover:bg-primary-70/10"
            >
              Visit official website <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}

          <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2">
            <CompanyFact
              icon={<Building2 className="h-4 w-4" />}
              label="Chief executive"
              value={
                wikidataProfile?.ceo ||
                company?.ceo ||
                newsFacts.ceo?.value ||
                "Not available"
              }
            />
            <CompanyFact
              icon={<MapPin className="h-4 w-4" />}
              label="Headquarters"
              value={
                wikidataProfile?.headquarters ||
                company?.headquarters ||
                newsFacts.headquarters?.value ||
                "Not available"
              }
            />
            <CompanyFact
              icon={<Landmark className="h-4 w-4" />}
              label="Founded"
              value={
                wikidataProfile?.founded ||
                company?.founded ||
                newsFacts.founded?.value ||
                "Not available"
              }
            />
            <CompanyFact
              icon={<Users className="h-4 w-4" />}
              label="Employees"
              value={
                wikidataProfile?.employees ||
                company?.employees ||
                newsFacts.employees?.value ||
                "Not available"
              }
            />
          </div>
        </section>

        {/* Latest news */}
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Latest news</h2>
            <span className="text-xs text-gray-400">
              {companyNewsSource || "Company news"}
            </span>
          </div>

          {isCompanyNewsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : isCompanyNewsError ? (
            <p className="mt-4 text-xs text-gray-400">
              News is temporarily unavailable.
            </p>
          ) : companyNews.length ? (
            <div className="mt-4 divide-y divide-white/10">
              {companyNews.map((article) => (
                <a
                  key={article.url}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-4 py-3 transition hover:opacity-80"
                >
                  <CompanyNewsThumbnail src={article.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {article.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {article.source}
                      {article.publishedAt ? ` • ${new Date(article.publishedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-primary-40" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-gray-400">No news articles found.</p>
          )}
        </section>
      </div>
    );
  }

  if (tab === "Token Info") {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <h2 className="text-lg font-bold text-white">Tokenholder Protections</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoBox
              icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
              title="1:1 Regulated Custody"
              desc="Underlying public equities are held by licensed trust custodians in segregated bankruptcy-remote accounts."
            />
            <InfoBox
              icon={<Vote className="h-4 w-4 text-primary-40" />}
              title="Pass-Through Rights"
              desc="Corporate actions and dividend distributions are reflected on-chain according to smart contract specifications."
            />
            <InfoBox
              icon={<Scale className="h-4 w-4 text-cyan-400" />}
              title="Continuous Compliance"
              desc="Audited reserves and collateral proofs ensure on-chain tokens mirror real-world custody balances."
            />
            <InfoBox
              icon={<Building2 className="h-4 w-4 text-amber-400" />}
              title="Settlement Network"
              desc={`Tokenized on ${settlementChain} with instant settlement and 24/7 liquidity access.`}
            />
          </div>
        </section>
      </div>
    );
  }

  // Data tab
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Market & Valuation Data</h2>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            {hasFinnhubData ? "Live Finnhub" : "Market Data"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <DataMetric label="Official Price" value={formatUsd(price)} />
          <DataMetric label="24h High" value={formatUsd(chartHigh)} />
          <DataMetric label="24h Low" value={formatUsd(chartLow)} />
          <DataMetric
            label="Market Cap"
            value={
              officialProfile?.marketCap
                ? `$${(officialProfile.marketCap / 1000).toFixed(2)}B`
                : "Not available"
            }
          />
          <DataMetric
            label="10D Avg Volume"
            value={formatCompactVolume(Number(metric("10DayAverageTradingVolume") || 0))}
          />
          <DataMetric
            label="52-Week Range"
            value={
              metric("52WeekLow") && metric("52WeekHigh")
                ? `$${metric("52WeekLow")} - $${metric("52WeekHigh")}`
                : "Not available"
            }
          />
        </div>
      </section>

      {dexPool ? (
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">On-Chain DEX Liquidity</h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              Live DexScreener
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DataMetric label="Pool Price" value={formatUsd(Number(dexPool.priceUsd || 0))} />
            <DataMetric label="Liquidity" value={formatCompactTurnover(dexPool.liquidityUsd || 0)} />
            <DataMetric label="24h Volume" value={formatCompactTurnover(dexPool.volume24hUsd || 0)} />
            <DataMetric
              label="24h Change"
              value={
                dexPool.change24hPercentage !== undefined
                  ? `${dexPool.change24hPercentage >= 0 ? "+" : ""}${dexPool.change24hPercentage.toFixed(2)}%`
                  : "—"
              }
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CompanyFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-secondary-50 p-4">
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoBox({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-white">
        {icon}
        <h3 className="text-xs font-bold sm:text-sm">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-400">{desc}</p>
    </div>
  );
}

function DataMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-3">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}
