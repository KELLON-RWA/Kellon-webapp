"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import {
  ArrowDownRight,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { yieldService, type YieldActionType } from "@/services/api/yield";
import {
  isRwaStockListing,
  stocksService,
  type StockListing,
  type StockPortfolioHolding,
} from "@/services/api/stocks";
import {
  PositionStatus,
  RiskLevel,
  type User,
  type YieldOpportunity,
  type YieldPosition,
} from "@/types/db";
import EarnActionDialog from "./EarnActionDialog";
import StockActionDialog, { type StockActionType } from "./StockActionDialog";
import {
  formatApy,
  formatMetricUsd,
  formatTokenAmount,
  formatUsd,
  getMaxUsableBalance,
  getPositionOpportunity,
  getPositionValue,
  getProtocolName,
  toNumber,
} from "./earn-utils";
import { getStockCharts, StockSparkline } from "./StockSparkline";

interface EarnPageProps {
  profile: User;
}

type EarnCategory = "yield" | "stocks" | "rwa";
type StockSortKey = "name" | "price" | "change";

const STOCKS_PER_DESKTOP_PAGE = 15;

const earnCategories: Array<{
  id: EarnCategory;
  label: string;
}> = [
  {
    id: "yield",
    label: "Yield",
  },
  {
    id: "stocks",
    label: "Stock",
  },
  {
    id: "rwa",
    label: "RWA",
  },
];

function isRwaHolding(
  holding: StockPortfolioHolding,
  listings: StockListing[],
): boolean {
  const listing = listings.find(
    (stock) =>
      stock.symbol.toLowerCase() === holding.symbol.toLowerCase() &&
      stock.provider.toLowerCase() === holding.provider.toLowerCase(),
  );

  if (listing) return isRwaStockListing(listing);

  return isRwaStockListing({
    symbol: holding.symbol,
    name: holding.symbol,
    price: holding.currentPrice,
    currency: "USD",
    provider: holding.provider,
    rwaCategory: holding.rwaCategory,
  });
}

function getHoldingListing(
  holding: StockPortfolioHolding,
  listings: StockListing[],
): StockListing | undefined {
  return listings.find(
    (stock) =>
      stock.symbol.toLowerCase() === holding.symbol.toLowerCase() &&
      stock.provider.toLowerCase() === holding.provider.toLowerCase(),
  );
}

function getListingChange(
  listing: StockListing,
  yahooChange?: number,
): number | undefined {
  const change = [
    listing.change24hPercentage,
    listing.changePercentage,
    listing.change,
  ]
    .map((value) => Number(value))
    .find(Number.isFinite);

  return change ?? yahooChange;
}

function stockProviderPriority(provider: string): number {
  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider.includes("base")) return 0;
  if (normalizedProvider.includes("pancake")) return 1;
  return 2;
}

const STOCK_DOMAINS: Record<string, string> = {
  AAPL: "apple.com",
  ARM: "arm.com",
  AMZN: "amazon.com",
  AVGO: "broadcom.com",
  BABA: "alibaba.com",
  BE: "bloomenergy.com",
  COIN: "coinbase.com",
  CRCL: "circle.com",
  CRWV: "coreweave.com",
  DJT: "tmtgcorp.com",
  FLNC: "fluenceenergy.com",
  GME: "gamestop.com",
  GOOGL: "google.com",
  HOOD: "robinhood.com",
  INTC: "intel.com",
  KO: "coca-colacompany.com",
  LITE: "lumentum.com",
  META: "meta.com",
  MRNA: "modernatx.com",
  MRVL: "marvell.com",
  MSFT: "microsoft.com",
  MSTR: "strategy.com",
  NFLX: "netflix.com",
  NOK: "nokia.com",
  NVDA: "nvidia.com",
  QQQ: "invesco.com",
  SNDK: "sandisk.com",
  SKHY: "skhynix.com",
  SOXL: "direxion.com",
  SOXS: "direxion.com",
  SPCX: "spacex.com",
  SPY: "ssga.com",
  TQQQ: "proshares.com",
  TSLA: "tesla.com",
  TSM: "tsmc.com",
};

function getUnderlyingTicker(symbol: string): string {
  const raw = symbol.trim();
  const withoutProviderSuffix = /[bc]$/i.test(raw) ? raw.slice(0, -1) : raw;

  return (
    withoutProviderSuffix.startsWith("b")
      ? withoutProviderSuffix.slice(1)
      : withoutProviderSuffix
  ).toUpperCase();
}

function getStockLogoUrl(symbol: string, logoUrl?: string): string {
  // Prefer a known company mark to an inconsistent provider-supplied image.
  if (STOCK_DOMAINS[getUnderlyingTicker(symbol)]) {
    return getStockLogoFallbackUrl(symbol);
  }

  if (logoUrl) return logoUrl;

  return `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(getUnderlyingTicker(symbol))}.png`;
}

function getDisplayStockName(name: string): string {
  return name.replace(/\s+[bc]stock$/i, "").trim();
}

function getStockLogoFallbackUrl(symbol: string): string {
  const ticker = getUnderlyingTicker(symbol);
  const domain = STOCK_DOMAINS[ticker];

  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(ticker)}&backgroundType=gradientLinear`;
}

function StockLogo({
  symbol,
  src,
  size = "md",
}: {
  symbol: string;
  src?: string;
  size?: "sm" | "md";
}) {
  const fallbackSrc = getStockLogoFallbackUrl(symbol);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-80 bg-white font-extrabold text-primary-90 dark:border-white/10 dark:bg-secondary-60 dark:text-primary-30",
        size === "sm" ? "h-10 w-10 text-xs" : "h-12 w-12 text-sm",
      )}
    >
      {symbol.slice(0, 2).toUpperCase()}
      {/* Provider logos are preferred; market-ticker and generated image fallbacks
          ensure every stock renders an image rather than a text-only placeholder. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || fallbackSrc}
        alt={`${symbol} logo`}
        className="absolute inset-0 h-full w-full bg-white object-contain p-1 dark:bg-secondary-60"
        data-fallback-src={fallbackSrc}
        onError={(event) => {
          const image = event.currentTarget;
          const fallback = image.dataset.fallbackSrc;
          if (fallback && image.src !== fallback) {
            image.src = fallback;
            return;
          }
          image.hidden = true;
        }}
      />
    </span>
  );
}

type SelectedAction = {
  action: YieldActionType;
  opportunity: YieldOpportunity;
  position?: YieldPosition;
} | null;

const riskStyles: Record<RiskLevel, string> = {
  [RiskLevel.CONSERVATIVE]:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  [RiskLevel.MODERATE]:
    "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  [RiskLevel.AGGRESSIVE]:
    "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300",
};

function EarnSkeleton({
  threeColumnsOnDesktop = false,
}: {
  threeColumnsOnDesktop?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3",
        threeColumnsOnDesktop
          ? "md:grid-cols-2 lg:grid-cols-3!"
          : "md:grid-cols-2 xl:grid-cols-3",
      )}
    >
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-44 animate-pulse rounded-lg border border-gray-80 bg-white/70 dark:border-white/10 dark:bg-secondary-50/70"
        />
      ))}
    </div>
  );
}

type BalanceSummaryStat = {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
};

function MobileBalanceSummary({
  label,
  value,
  stats,
}: {
  label: string;
  value: string;
  stats: BalanceSummaryStat[];
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-xl border border-white/70 bg-white/70 p-5 shadow-sm shadow-primary-90/30 backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-secondary-50/40 dark:shadow-none">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(138,22,133,0.18),transparent_48%),linear-gradient(115deg,rgba(255,255,255,0.7),rgba(246,232,242,0.42)_48%,rgba(255,255,255,0.16))] dark:bg-[radial-gradient(circle_at_16%_0%,rgba(193,92,165,0.42),transparent_52%),radial-gradient(circle_at_90%_20%,rgba(255,255,255,0.1),transparent_40%)]" />

      <div className="relative">
        <p className="text-[10px] font-semibold uppercase text-gray-30 dark:text-gray-40">
          {label}
        </p>
        <p className="mt-2 truncate text-2xl font-extrabold text-cryptoNight tabular-nums min-[360px]:text-3xl dark:text-white">
          {value}
        </p>

        <div
          className={cn(
            "mt-6 grid border-t border-gray-80 pt-4 dark:border-white/10",
            stats.length === 2 ? "grid-cols-2" : "grid-cols-3",
          )}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                "min-w-0 px-2 text-center first:pl-0 last:pr-0",
                index > 0 && "border-l border-gray-80 dark:border-white/10",
              )}
            >
              <p className="min-h-6 text-[8px] leading-3 font-medium text-gray-30 min-[360px]:text-[9px] dark:text-gray-40">
                {stat.label}
              </p>
              <p
                className={cn(
                  "mt-1 truncate text-xs font-bold tabular-nums text-cryptoNight dark:text-white",
                  stat.tone === "positive" &&
                    "text-emerald-600 dark:text-emerald-300",
                  stat.tone === "negative" &&
                    "text-rose-600 dark:text-rose-300",
                )}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function EarnPage({ profile }: EarnPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected } = useRealtime();
  const marketEtfsRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<EarnCategory>("yield");
  const [stockSort, setStockSort] = useState<{
    key: StockSortKey;
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });
  const [stockPage, setStockPage] = useState(1);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SelectedAction>(null);
  const [selectedStockAction, setSelectedStockAction] = useState<{
    action: StockActionType;
    stock?: StockListing | null;
    holding?: StockPortfolioHolding | null;
  } | null>(null);
  const {
    data: opportunities = [],
    isLoading: opportunitiesLoading,
    error: opportunitiesError,
    refetch: refetchOpportunities,
  } = useQuery({
    queryKey: ["yield-opportunities"],
    queryFn: async () => (await yieldService.getOpportunities()).data,
    staleTime: 30_000,
    refetchInterval: isConnected ? 120_000 : 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const {
    data: stocks = [],
    isLoading: stocksLoading,
    error: stocksError,
    refetch: refetchStocks,
  } = useQuery({
    queryKey: ["available-stocks"],
    queryFn: async () => (await stocksService.getAvailableStocks("all")).data,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const {
    data: stockPortfolio,
    error: stockPortfolioError,
    refetch: refetchStockPortfolio,
  } = useQuery({
    queryKey: ["stock-portfolio"],
    queryFn: async () => (await stocksService.getPortfolio()).data,
    enabled: activeTab !== "yield",
    staleTime: 30_000,
  });

  const {
    data: marketIndices = [],
    error: marketIndicesError,
    refetch: refetchMarketIndices,
  } = useQuery({
    queryKey: ["market-indices"],
    queryFn: async () => (await stocksService.getIndices()).data,
    enabled: activeTab !== "yield",
    staleTime: 60_000,
  });

  useEffect(() => {
    const requestedCategory = searchParams.get("category");
    if (
      requestedCategory === "yield" ||
      requestedCategory === "stocks" ||
      requestedCategory === "rwa"
    ) {
      setActiveTab(requestedCategory);
    }
  }, [searchParams]);

  useEffect(() => {
    const opportunityId = searchParams.get("opportunity");
    if (!opportunityId || !opportunities.length) return;

    const opportunity = opportunities.find((item) => item.id === opportunityId);
    if (!opportunity) return;

    setSelectedAction({ action: "supply", opportunity });
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("opportunity");
    router.replace(`/earn?${nextParams.toString()}`, { scroll: false });
  }, [opportunities, router, searchParams]);

  useEffect(() => {
    const stockSymbol = searchParams.get("stock");
    const provider = searchParams.get("provider");
    if (!stockSymbol || !stocks.length) return;

    const stock = stocks.find(
      (item) =>
        item.symbol.toLowerCase() === stockSymbol.toLowerCase() &&
        (!provider || item.provider.toLowerCase() === provider.toLowerCase()),
    );
    if (!stock) return;

    setSelectedStockAction({ action: "buy", stock });
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("stock");
    nextParams.delete("provider");
    router.replace(`/earn?${nextParams.toString()}`, { scroll: false });
  }, [router, searchParams, stocks]);

  const {
    data: positions = [],
    isLoading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = useQuery({
    queryKey: ["yield-positions"],
    queryFn: async () => (await yieldService.getPositions()).data,
    staleTime: 30_000,
    refetchInterval: isConnected ? 120_000 : 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const activePositions = useMemo(
    () =>
      positions.filter((position) => position.status !== PositionStatus.CLOSED),
    [positions],
  );
  const totalSupplied = activePositions.reduce(
    (total, position) => total + getPositionValue(position),
    0,
  );
  const currentPositionMetrics = useMemo(
    () =>
      activePositions.map((position) => {
        const currentOpportunity =
          opportunities.find(
            (opportunity) => opportunity.id === position.opportunityId,
          ) || position.opportunity;
        const apy = toNumber(currentOpportunity?.apy ?? position.entryApy);
        const amount = getPositionValue(position);

        return {
          amount,
          apy,
          annualYield: (amount * apy) / 100,
          label: currentOpportunity
            ? `${getProtocolName(currentOpportunity.protocol)} ${currentOpportunity.symbol}`
            : position.opportunityId,
        };
      }),
    [activePositions, opportunities],
  );
  const estimatedAnnualYield = currentPositionMetrics.reduce(
    (total, position) => total + position.annualYield,
    0,
  );
  const averageApy =
    totalSupplied > 0
      ? currentPositionMetrics.reduce(
          (total, position) => total + position.amount * position.apy,
          0,
        ) / totalSupplied
      : 0;
  const categoryStocks = useMemo(
    () =>
      stocks.filter((stock) =>
        activeTab === "rwa"
          ? isRwaStockListing(stock)
          : !isRwaStockListing(stock),
      ),
    [activeTab, stocks],
  );
  const unifiedStocks = useMemo(() => {
    const preferredListings = new Map<string, StockListing>();
    categoryStocks.forEach((stock) => {
      const ticker = getUnderlyingTicker(stock.symbol);
      const existing = preferredListings.get(ticker);

      if (
        !existing ||
        stockProviderPriority(stock.provider) <
          stockProviderPriority(existing.provider)
      ) {
        preferredListings.set(ticker, stock);
      }
    });

    return [...preferredListings.values()];
  }, [categoryStocks]);
  const chartSymbolGroups = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(unifiedStocks.length / 20) },
        (_, index) =>
          unifiedStocks
            .slice(index * 20, (index + 1) * 20)
            .map((stock) => stock.symbol),
      ),
    [unifiedStocks],
  );
  const chartQueries = useQueries({
    queries: chartSymbolGroups.map((symbols) => ({
      queryKey: ["stock-charts", symbols],
      queryFn: () => getStockCharts(symbols),
      enabled: activeTab !== "yield" && symbols.length > 0,
      staleTime: 60_000,
      refetchInterval: isConnected ? 60_000 : (false as const),
    })),
  });
  const stockChartData = useMemo(
    () =>
      chartQueries.reduce(
        (data, query) => ({
          charts: { ...data.charts, ...(query.data?.charts || {}) },
          changes: { ...data.changes, ...(query.data?.changes || {}) },
        }),
        {
          charts: {} as Record<string, number[]>,
          changes: {} as Record<string, number>,
        },
      ),
    [chartQueries],
  );
  const stockCharts = stockChartData.charts;
  const stockChartChanges = stockChartData.changes;
  const sortedStocks = useMemo(() => {
    const multiplier = stockSort.direction === "asc" ? 1 : -1;
    return [...unifiedStocks].sort((left, right) => {
      if (stockSort.key === "name") {
        return multiplier * left.symbol.localeCompare(right.symbol);
      }

      const leftValue =
        stockSort.key === "price"
          ? Number(left.price) || 0
          : getListingChange(left, stockChartChanges[left.symbol]) || 0;
      const rightValue =
        stockSort.key === "price"
          ? Number(right.price) || 0
          : getListingChange(right, stockChartChanges[right.symbol]) || 0;
      return multiplier * (leftValue - rightValue);
    });
  }, [unifiedStocks, stockChartChanges, stockSort]);
  const stockPageCount = Math.max(
    1,
    Math.ceil(sortedStocks.length / STOCKS_PER_DESKTOP_PAGE),
  );
  const activeStockPage = Math.min(stockPage, stockPageCount);
  const desktopStocks = useMemo(
    () =>
      sortedStocks.slice(
        (activeStockPage - 1) * STOCKS_PER_DESKTOP_PAGE,
        activeStockPage * STOCKS_PER_DESKTOP_PAGE,
      ),
    [activeStockPage, sortedStocks],
  );
  useEffect(() => {
    setStockPage(1);
  }, [activeTab, stockSort]);
  const toggleStockSort = (key: StockSortKey) => {
    setStockSort((current) => ({
      key,
      direction:
        current.key === key
          ? current.direction === "asc"
            ? "desc"
            : "asc"
          : key === "name"
            ? "asc"
            : "desc",
    }));
  };
  const marketEtfs = useMemo(() => {
    if (marketIndices.length) {
      return marketIndices.map((index) => ({
        ...index,
        change: index.change24hPercentage,
      }));
    }

    return stocks
      .filter((stock) => /\b(etf|trust|s&p 500|nasdaq 100)\b/i.test(stock.name))
      .slice(0, 6)
      .map((stock) => ({
        symbol: getUnderlyingTicker(stock.symbol),
        name: getDisplayStockName(stock.name),
        price: Number(stock.price) || 0,
        currency: stock.currency,
        change: getListingChange(stock),
      }));
  }, [marketIndices, stocks]);
  const categoryPortfolioHoldings = useMemo(() => {
    const holdings = stockPortfolio?.holdings || [];

    return holdings.filter((holding) =>
      activeTab === "rwa"
        ? isRwaHolding(holding, stocks)
        : !isRwaHolding(holding, stocks),
    );
  }, [activeTab, stockPortfolio?.holdings, stocks]);
  const categoryPortfolio = useMemo(() => {
    const totalPortfolioValue = categoryPortfolioHoldings.reduce(
      (total, holding) => total + toNumber(holding.currentValue),
      0,
    );
    const totalCostBasis = categoryPortfolioHoldings.reduce(
      (total, holding) => total + toNumber(holding.costBasis),
      0,
    );
    const totalUnrealizedPnL = categoryPortfolioHoldings.reduce(
      (total, holding) => total + toNumber(holding.unrealizedPnL),
      0,
    );

    return {
      totalPortfolioValue,
      totalCostBasis,
      totalUnrealizedPnL,
      totalUnrealizedPnLPercentage:
        totalCostBasis > 0 ? (totalUnrealizedPnL / totalCostBasis) * 100 : 0,
    };
  }, [categoryPortfolioHoldings]);
  const isYieldLoading = opportunitiesLoading || positionsLoading;
  const isLoading = activeTab === "yield" ? isYieldLoading : stocksLoading;
  const error =
    activeTab === "yield"
      ? opportunitiesError || positionsError
      : stocksError || stockPortfolioError || marketIndicesError;

  const refresh = async () => {
    if (activeTab === "yield") {
      await Promise.all([refetchOpportunities(), refetchPositions()]);
      return;
    }

    await Promise.all([
      refetchStocks(),
      refetchStockPortfolio(),
      refetchMarketIndices(),
    ]);
  };

  return (
    <main className="container mx-auto min-h-[100dvh] w-full max-w-7xl px-4 pb-32 pt-4 md:px-6 md:pb-12 md:pt-28">
      <div className="mb-5 flex items-center gap-2 md:mb-6">
        <section
          aria-label="Earn categories"
          className="inline-flex min-w-0 items-center gap-1 rounded-full border border-gray-80 bg-white/60 p-1 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-secondary-50/40"
        >
          {earnCategories.map((category) => {
            const isActive = activeTab === category.id;

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setActiveTab(category.id);
                }}
                className={cn(
                  "min-w-0 rounded-full px-3 py-1.5 text-center transition md:px-4",
                  isActive
                    ? "bg-primary-90 text-white shadow-sm dark:bg-primary-70"
                    : "text-gray-30 hover:bg-gray-90 dark:text-gray-40 dark:hover:bg-white/10",
                )}
              >
                <span className="block truncate text-xs font-bold min-[360px]:text-sm">
                  {category.label}
                </span>
              </button>
            );
          })}
        </section>

        <button
          type="button"
          onClick={() => setIsGlobalSearchOpen(true)}
          aria-label="Search Kellon"
          aria-expanded={isGlobalSearchOpen}
          title="Search Kellon"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-80 bg-white/70 text-gray-20 shadow-sm transition hover:border-primary-80 hover:text-primary-50 md:hidden dark:border-white/10 dark:bg-secondary-50/55 dark:text-gray-40 dark:hover:border-primary-80/60 dark:hover:text-primary-90"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        <SearchBar
          profile={profile}
          variant="overlay"
          open={isGlobalSearchOpen}
          onOpenChange={setIsGlobalSearchOpen}
          className="md:hidden"
        />
      </div>

      {error ? (
        <section className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
          <span>
            {error instanceof Error
              ? error.message
              : "Earn data could not be loaded."}
          </span>
          <Button variant="outline" size="sm" onClick={refresh}>
            Try again
          </Button>
        </section>
      ) : null}

      {activeTab === "yield" ? (
        <>
          <MobileBalanceSummary
            label="Total portfolio balance"
            value={formatMetricUsd(totalSupplied)}
            stats={[
              {
                label: "Active pools",
                value: activePositions.length.toString(),
              },
              {
                label: "Average APY",
                value: `${averageApy.toFixed(2)}%`,
                tone: averageApy > 0 ? "positive" : "default",
              },
              {
                label: "Est. annual yield",
                value: formatMetricUsd(estimatedAnnualYield),
                tone: estimatedAnnualYield > 0 ? "positive" : "default",
              },
            ]}
          />

          <section className="relative mb-8 hidden overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-7 shadow-sm shadow-primary-90/30 backdrop-blur-xl md:block dark:border-white/10 dark:bg-secondary-50/40 dark:shadow-none">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(138,22,133,0.18),transparent_48%),linear-gradient(115deg,rgba(255,255,255,0.7),rgba(246,232,242,0.42)_48%,rgba(255,255,255,0.16))] dark:bg-[radial-gradient(circle_at_16%_0%,rgba(193,92,165,0.42),transparent_52%),radial-gradient(circle_at_90%_20%,rgba(255,255,255,0.1),transparent_40%)]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-30 dark:text-gray-40">
                Total portfolio balance
              </p>
              <p className="mt-3 text-4xl font-extrabold tabular-nums text-cryptoNight dark:text-white">
                {formatUsd(totalSupplied)}
              </p>
              <div className="mt-8 grid max-w-2xl grid-cols-3 border-t border-gray-80 pt-5 dark:border-white/10">
                <div className="pr-6">
                  <p className="text-xs font-medium text-gray-30 dark:text-gray-40">
                    Active pools
                  </p>
                  <p className="mt-2 text-lg font-bold tabular-nums text-cryptoNight dark:text-white">
                    {activePositions.length}
                  </p>
                </div>
                <div className="border-l border-gray-80 px-6 dark:border-white/10">
                  <p className="text-xs font-medium text-gray-30 dark:text-gray-40">
                    Average APY
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-lg font-bold tabular-nums",
                      averageApy > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-cryptoNight dark:text-white",
                    )}
                  >
                    {averageApy.toFixed(2)}%
                  </p>
                </div>
                <div className="border-l border-gray-80 pl-6 dark:border-white/10">
                  <p className="text-xs font-medium text-gray-30 dark:text-gray-40">
                    Est. annual yield
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-lg font-bold tabular-nums",
                      estimatedAnnualYield > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-cryptoNight dark:text-white",
                    )}
                  >
                    {formatUsd(estimatedAnnualYield)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {positionsLoading || activePositions.length > 0 ? (
            <section className="mb-9">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-cryptoNight dark:text-white md:text-lg">
                  Your positions
                </h2>
                <span className="rounded-full bg-gray-90 px-2.5 py-1 text-[10px] font-bold text-gray-20 dark:bg-white/5 dark:text-gray-40">
                  {activePositions.length} active
                </span>
              </div>

              {positionsLoading ? (
                <EarnSkeleton />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {activePositions.map((position) => {
                    const opportunity = getPositionOpportunity(
                      position,
                      opportunities,
                    );
                    if (!opportunity) return null;

                    return (
                      <article
                        key={position.id}
                        className="rounded-lg border border-gray-80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-secondary-50/75 dark:shadow-none"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <AssetNetworkIcon
                              symbol={opportunity.symbol}
                              network={opportunity.chain}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-cryptoNight dark:text-white">
                                {opportunity.symbol}
                              </p>
                              <p className="truncate text-xs capitalize text-gray-30 dark:text-gray-40">
                                {getProtocolName(opportunity.protocol)} ·{" "}
                                {opportunity.chain}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                            {position.status}
                          </span>
                        </div>
                        <div className="mt-5 flex items-end justify-between">
                          <div>
                            <p className="text-[10px] font-semibold uppercase text-gray-30 dark:text-gray-40">
                              Supplied
                            </p>
                            <p className="mt-1 text-xl font-bold text-cryptoNight dark:text-white">
                              {formatTokenAmount(getPositionValue(position))}{" "}
                              <span className="text-xs text-gray-30 dark:text-gray-40">
                                {opportunity.symbol}
                              </span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase text-gray-30 dark:text-gray-40">
                              Entry APY
                            </p>
                            <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-300">
                              {formatApy(position.entryApy)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="flowSecondary"
                          size="sm"
                          className="mt-4 w-full"
                          onClick={() =>
                            setSelectedAction({
                              action: "withdraw",
                              opportunity,
                              position,
                            })
                          }
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            <ArrowDownToLine className="transition-transform group-hover:-translate-y-0.5" />
                            Withdraw
                          </span>
                          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary-80/10 to-transparent transition-transform duration-500 group-hover:translate-x-full dark:via-white/10" />
                        </Button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : null}

      <section className="w-full">
        {activeTab === "yield" ? (
          <>
            <h2 className="mb-3 text-base font-bold text-cryptoNight dark:text-white">
              Yield opportunities
            </h2>
            {opportunitiesLoading ? (
              <EarnSkeleton threeColumnsOnDesktop />
            ) : opportunities.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3!">
                {opportunities.map((opportunity) => {
                  const available = getMaxUsableBalance(
                    profile,
                    opportunity.symbol,
                  );
                  const normalizedRisk = Object.values(RiskLevel).includes(
                    opportunity.riskLevel,
                  )
                    ? opportunity.riskLevel
                    : RiskLevel.MODERATE;
                  return (
                    <article
                      key={opportunity.id}
                      className="group rounded-xl border border-gray-80 bg-white/80 p-4 shadow-sm transition hover:border-primary-90 hover:bg-white dark:border-white/10 dark:bg-secondary-50/75 dark:shadow-none dark:hover:border-primary-70/40 dark:hover:bg-secondary-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <AssetNetworkIcon
                            symbol={opportunity.symbol}
                            network={opportunity.chain}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-cryptoNight dark:text-white">
                              {getProtocolName(opportunity.protocol)}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-semibold text-gray-30 dark:text-gray-40">
                                {opportunity.symbol}
                              </span>
                              <span className="rounded-full bg-gray-90 px-1.5 py-0.5 text-[8px] font-bold uppercase text-gray-20 dark:bg-white/5 dark:text-gray-40">
                                {opportunity.chain}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[8px] font-bold capitalize",
                                  riskStyles[normalizedRisk],
                                )}
                              >
                                {normalizedRisk.toLowerCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-300">
                            {formatApy(opportunity.apy)}
                          </p>
                          <p className="text-[9px] font-semibold text-gray-30 dark:text-gray-40">
                            Est. APY
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-3 border-t border-gray-80 pt-4 dark:border-white/10">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-semibold text-gray-30 dark:text-gray-40">
                          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>Audited</span>
                        </div>
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-semibold text-gray-30 dark:text-gray-40">
                          <Zap className="h-4 w-4 shrink-0 text-primary-90 dark:text-primary-30" />
                          <span>Instant liquidity</span>
                        </div>
                        <Button
                          type="button"
                          variant="flow"
                          size="sm"
                          className="h-9 shrink-0 px-4"
                          disabled={available <= 0}
                          onClick={() =>
                            setSelectedAction({ action: "supply", opportunity })
                          }
                        >
                          <span className="relative z-10 flex items-center justify-center gap-1.5">
                            {available > 0 ? "Deposit" : "Unavailable"}
                            {available > 0 ? (
                              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            ) : null}
                          </span>
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-gray-30 dark:text-gray-40">
                        <span>Wallet balance</span>
                        <span className="font-semibold text-cryptoNight dark:text-white">
                          {formatTokenAmount(available)} {opportunity.symbol}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-36 items-center justify-center rounded-lg border border-gray-80 bg-white/65 px-4 text-center dark:border-white/10 dark:bg-secondary-50/55">
                <div>
                  <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                    No opportunities available
                  </p>
                  <p className="mt-1 text-xs text-gray-30 dark:text-gray-40">
                    New yield options will appear here when they are enabled.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div>
            <MobileBalanceSummary
              label={`${activeTab === "rwa" ? "RWA" : "Stock"} portfolio value`}
              value={formatMetricUsd(categoryPortfolio.totalPortfolioValue)}
              stats={[
                {
                  label: "Total return (PnL)",
                  value: `${categoryPortfolio.totalUnrealizedPnL >= 0 ? "+" : ""}${formatMetricUsd(categoryPortfolio.totalUnrealizedPnL)} (${categoryPortfolio.totalUnrealizedPnLPercentage.toFixed(2)}%)`,
                  tone:
                    categoryPortfolio.totalUnrealizedPnL > 0
                      ? "positive"
                      : categoryPortfolio.totalUnrealizedPnL < 0
                        ? "negative"
                        : "default",
                },
                {
                  label: "Cost basis",
                  value: formatMetricUsd(categoryPortfolio.totalCostBasis),
                },
              ]}
            />

            {/* Portfolio Performance Summary */}
            {stockPortfolio && (
              <div className="relative mb-8 hidden overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-7 shadow-sm shadow-primary-90/30 backdrop-blur-xl md:block dark:border-white/10 dark:bg-secondary-50/40 dark:shadow-none">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(138,22,133,0.18),transparent_48%),linear-gradient(115deg,rgba(255,255,255,0.7),rgba(246,232,242,0.42)_48%,rgba(255,255,255,0.16))] dark:bg-[radial-gradient(circle_at_16%_0%,rgba(193,92,165,0.42),transparent_52%),radial-gradient(circle_at_90%_20%,rgba(255,255,255,0.1),transparent_40%)]" />

                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-30 dark:text-gray-40">
                    {activeTab === "rwa" ? "RWA" : "Stock"} portfolio value
                  </p>
                  <p className="mt-3 text-4xl font-extrabold tabular-nums text-cryptoNight dark:text-white">
                    {formatUsd(categoryPortfolio.totalPortfolioValue)}
                  </p>

                  <div className="mt-8 grid max-w-xl grid-cols-2 border-t border-gray-80 pt-5 dark:border-white/10">
                    <div className="pr-8">
                      <p className="text-xs font-medium text-gray-30 dark:text-gray-40">
                        Total return (PnL)
                      </p>
                      <p
                        className={cn(
                          "mt-2 text-lg font-bold tabular-nums",
                          categoryPortfolio.totalUnrealizedPnL > 0
                            ? "text-emerald-600 dark:text-emerald-300"
                            : categoryPortfolio.totalUnrealizedPnL < 0
                              ? "text-rose-600 dark:text-rose-300"
                              : "text-cryptoNight dark:text-white",
                        )}
                      >
                        {categoryPortfolio.totalUnrealizedPnL >= 0 ? "+" : ""}
                        {formatUsd(categoryPortfolio.totalUnrealizedPnL)} (
                        {categoryPortfolio.totalUnrealizedPnLPercentage.toFixed(
                          2,
                        )}
                        %)
                      </p>
                    </div>
                    <div className="border-l border-gray-80 pl-8 dark:border-white/10">
                      <p className="text-xs font-medium text-gray-30 dark:text-gray-40">
                        Cost basis
                      </p>
                      <p className="mt-2 text-lg font-bold tabular-nums text-cryptoNight dark:text-white">
                        {formatUsd(categoryPortfolio.totalCostBasis)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {categoryPortfolioHoldings.length > 0 ? (
              <section className="mb-7">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-cryptoNight dark:text-white">
                    My positions
                  </h2>
                  <span className="rounded-full bg-gray-90 px-2.5 py-1 text-[10px] font-bold text-gray-20 dark:bg-white/5 dark:text-gray-40">
                    {categoryPortfolioHoldings.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {categoryPortfolioHoldings.map((holding) => {
                    const listing = getHoldingListing(holding, stocks);
                    const pnl = toNumber(holding.unrealizedPnL);
                    const pnlPercentage = toNumber(
                      holding.unrealizedPnLPercentage,
                    );

                    return (
                      <article
                        key={holding.id}
                        className="rounded-xl border border-gray-80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-secondary-50/75 dark:shadow-none"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <StockLogo
                              symbol={holding.symbol}
                              src={getStockLogoUrl(
                                holding.symbol,
                                listing?.logoUrl,
                              )}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-bold text-cryptoNight dark:text-white">
                                  {holding.symbol}
                                </p>
                                <span className="rounded-full bg-primary-90/10 px-1.5 py-0.5 text-[8px] font-bold text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">
                                  {getProtocolName(holding.provider)}
                                </span>
                              </div>
                              <p className="truncate text-xs text-gray-30 dark:text-gray-40">
                                {listing?.name || `${holding.symbol} position`}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-cryptoNight dark:text-white">
                              {formatUsd(toNumber(holding.currentValue))}
                            </p>
                            <p
                              className={cn(
                                "mt-1 flex items-center justify-end gap-1 text-[10px] font-bold",
                                pnl >= 0
                                  ? "text-emerald-600 dark:text-emerald-300"
                                  : "text-rose-600 dark:text-rose-300",
                              )}
                            >
                              {pnl > 0 ? (
                                <ArrowUpRight
                                  className="h-3 w-3 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : pnl < 0 ? (
                                <ArrowDownRight
                                  className="h-3 w-3 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : null}
                              {pnl >= 0 ? "+" : ""}
                              {formatUsd(pnl)} ({pnlPercentage.toFixed(2)}%)
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-80 pt-4 dark:border-white/10">
                          <p className="min-w-0 truncate text-[10px] text-gray-30 dark:text-gray-40">
                            {toNumber(holding.shares).toFixed(4)} shares · Avg.{" "}
                            {formatUsd(toNumber(holding.avgBuyPrice))}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled
                            className="h-9 shrink-0 px-4"
                            title="Selling is temporarily unavailable while on-chain settlement is being enabled."
                          >
                            Sell
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* Market ETFs */}
            {activeTab === "stocks" && marketEtfs.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-cryptoNight dark:text-white">
                    Market ETFs
                  </h4>
                  <div className="hidden items-center gap-1 md:flex">
                    <button
                      type="button"
                      aria-label="Show previous market ETFs"
                      onClick={() =>
                        marketEtfsRef.current?.scrollBy({
                          left: -220,
                          behavior: "smooth",
                        })
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-80 text-gray-30 transition hover:border-primary-90 hover:text-primary-90 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-70 dark:hover:text-primary-30"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Show more market ETFs"
                      onClick={() =>
                        marketEtfsRef.current?.scrollBy({
                          left: 220,
                          behavior: "smooth",
                        })
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-80 text-gray-30 transition hover:border-primary-90 hover:text-primary-90 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-70 dark:hover:text-primary-30"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div
                  ref={marketEtfsRef}
                  className="mr-[calc(50%_-_50vw)] flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mr-0 md:pr-0"
                >
                  {marketEtfs.map((idx) => (
                    <div
                      key={idx.symbol}
                      className="flex min-h-[128px] w-[44%] min-w-32 shrink-0 snap-start flex-col rounded-xl border border-gray-80 bg-white/60 p-3 dark:border-white/10 dark:bg-secondary-50/50 md:min-h-[116px] md:w-44 md:min-w-44"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cryptoNight dark:text-white">
                          {idx.symbol}
                        </span>
                        {idx.change !== undefined && idx.change > 0 ? (
                          <ArrowUpRight
                            className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                            aria-hidden="true"
                          />
                        ) : idx.change !== undefined && idx.change < 0 ? (
                          <ArrowDownRight
                            className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 flex-1 text-[10px] leading-4 text-gray-30 dark:text-gray-40 md:text-[11px]">
                        {idx.name}
                      </p>
                      <div className="mt-3 flex flex-col items-start gap-0.5">
                        <p className="truncate text-xs font-bold text-cryptoNight dark:text-white min-[360px]:text-sm md:text-base">
                          ${idx.price.toFixed(2)}
                        </p>
                        {idx.change !== undefined ? (
                          <span
                            className={cn(
                              "text-[9px] font-bold min-[360px]:text-[10px] md:text-xs",
                              idx.change >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400",
                            )}
                          >
                            {idx.change >= 0 ? "+" : ""}
                            {idx.change.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold uppercase text-gray-30 dark:text-gray-40">
                            {idx.currency}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <h2 className="mb-3 text-base font-bold text-cryptoNight dark:text-white">
                {activeTab === "rwa"
                  ? "RWA opportunities"
                  : "Stock opportunities"}
              </h2>

            </div>

            {stocksLoading ? (
              <EarnSkeleton threeColumnsOnDesktop />
            ) : unifiedStocks.length ? (
              <>
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {sortedStocks.map((stock) => (
                    <article
                      key={`${stock.provider}_${stock.symbol}`}
                      className="group rounded-xl border border-gray-80 bg-white/80 p-4 shadow-sm transition hover:border-primary-90 hover:bg-white dark:border-white/10 dark:bg-secondary-50/75 dark:shadow-none dark:hover:border-primary-70/40 dark:hover:bg-secondary-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <StockLogo
                            symbol={stock.symbol}
                            src={getStockLogoUrl(stock.symbol, stock.logoUrl)}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-bold text-cryptoNight dark:text-white">
                                {getUnderlyingTicker(stock.symbol)}
                              </p>
                              <span className="rounded-full bg-primary-90/10 px-1.5 py-0.5 text-[8px] font-bold text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">
                                {getProtocolName(stock.provider)}
                              </span>
                            </div>
                            <p className="truncate text-xs text-gray-30 dark:text-gray-40">
                              {getDisplayStockName(stock.name)}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-bold text-cryptoNight dark:text-white">
                            {formatUsd(Number(stock.price) || 0)}
                          </p>
                          <p className="text-[9px] font-semibold uppercase text-gray-30 dark:text-gray-40">
                            {stock.currency}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-3 border-t border-gray-80 pt-4 dark:border-white/10">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-semibold text-gray-30 dark:text-gray-40">
                          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {activeTab === "rwa"
                              ? stock.rwaCategory ||
                                stock.category ||
                                "Tokenized"
                              : "Tokenized"}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[10px] font-semibold text-gray-30 dark:text-gray-40">
                          <Clock3 className="h-4 w-4 shrink-0 text-primary-90 dark:text-primary-30" />
                          <span>24/7 trading</span>
                        </div>
                        <Button
                          type="button"
                          variant="flow"
                          size="sm"
                          className="h-9 shrink-0 px-4"
                          onClick={() =>
                            setSelectedStockAction({ action: "buy", stock })
                          }
                        >
                          <span className="relative z-10 flex items-center justify-center gap-1.5">
                            Buy
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto rounded-2xl border border-gray-80 bg-white/70 dark:border-white/10 dark:bg-secondary-50/65 md:block">
                  <table className="w-full min-w-[780px] border-collapse text-left">
                    <thead className="border-b border-gray-80 bg-gray-95 text-[11px] text-gray-30 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-40">
                      <tr>
                        <th className="px-5 py-3 font-semibold">
                          <button
                            type="button"
                            onClick={() => toggleStockSort("name")}
                            className="inline-flex items-center gap-1 hover:text-cryptoNight dark:hover:text-white"
                          >
                            Name
                            {stockSort.key === "name"
                              ? stockSort.direction === "asc"
                                ? " ↑"
                                : " ↓"
                              : ""}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          <button
                            type="button"
                            onClick={() => toggleStockSort("price")}
                            className="inline-flex items-center gap-1 hover:text-cryptoNight dark:hover:text-white"
                          >
                            Price
                            {stockSort.key === "price"
                              ? stockSort.direction === "asc"
                                ? " ↑"
                                : " ↓"
                              : ""}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          <button
                            type="button"
                            onClick={() => toggleStockSort("change")}
                            className="inline-flex items-center gap-1 hover:text-cryptoNight dark:hover:text-white"
                          >
                            24h change
                            {stockSort.key === "change"
                              ? stockSort.direction === "asc"
                                ? " ↑"
                                : " ↓"
                              : ""}
                          </button>
                        </th>
                        <th className="px-4 py-3 font-semibold">Last 24h</th>
                        <th className="px-4 py-3 font-semibold">Provider</th>
                        <th className="px-5 py-3" aria-label="Action" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-80 dark:divide-white/10">
                      {desktopStocks.map((stock) => {
                        const change = getListingChange(
                          stock,
                          stockChartChanges[stock.symbol],
                        );
                        return (
                          <tr
                            key={`${stock.provider}_${stock.symbol}`}
                            className="transition-colors hover:bg-primary-90/[0.035] dark:hover:bg-white/[0.025]"
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex min-w-0 items-center gap-3">
                                <StockLogo
                                  symbol={stock.symbol}
                                  src={getStockLogoUrl(
                                    stock.symbol,
                                    stock.logoUrl,
                                  )}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className="font-bold text-cryptoNight dark:text-white">
                                    {getUnderlyingTicker(stock.symbol)}
                                  </p>
                                  <p className="max-w-48 truncate text-xs text-gray-30 dark:text-gray-40">
                                    {getDisplayStockName(stock.name)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <p className="font-normal tabular-nums text-cryptoNight dark:text-white">
                                {formatUsd(Number(stock.price) || 0)}
                              </p>
                              <p className="text-[10px] font-semibold uppercase text-gray-30 dark:text-gray-40">
                                {stock.currency}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              {change === undefined ? (
                                <span className="text-sm text-gray-30 dark:text-gray-40">
                                  —
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    "font-normal tabular-nums",
                                    change >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400",
                                  )}
                                >
                                  {change >= 0 ? "+" : ""}
                                  {change.toFixed(2)}%
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <StockSparkline
                                values={stockCharts[stock.symbol]}
                              />
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex rounded-full bg-primary-90/10 px-2 py-1 text-[10px] font-bold text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">
                                {getProtocolName(stock.provider)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <Button
                                type="button"
                                variant="flow"
                                size="sm"
                                className="h-9 px-4"
                                onClick={() =>
                                  setSelectedStockAction({
                                    action: "buy",
                                    stock,
                                  })
                                }
                              >
                                <span className="relative z-10 flex items-center gap-1.5">
                                  Buy <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {stockPageCount > 1 ? (
                  <nav
                    className="mt-4 hidden items-center justify-center gap-2 md:flex"
                    aria-label="Stock listing pages"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setStockPage((page) => Math.max(1, page - 1))
                      }
                      disabled={activeStockPage === 1}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-80 text-gray-30 transition hover:border-primary-90 hover:text-primary-90 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-30 dark:hover:text-primary-30"
                      aria-label="Previous stock page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-14 text-center text-sm font-semibold tabular-nums text-cryptoNight dark:text-white">
                      {activeStockPage} / {stockPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setStockPage((page) =>
                          Math.min(stockPageCount, page + 1),
                        )
                      }
                      disabled={activeStockPage === stockPageCount}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-80 text-gray-30 transition hover:border-primary-90 hover:text-primary-90 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-30 dark:hover:text-primary-30"
                      aria-label="Next stock page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </nav>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-36 items-center justify-center rounded-lg border border-gray-80 bg-white/65 px-4 text-center dark:border-white/10 dark:bg-secondary-50/55">
                <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                  {`No ${activeTab === "rwa" ? "RWA products" : "stocks"} are available yet.`}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <EarnActionDialog
        action={selectedAction?.action || "supply"}
        opportunity={selectedAction?.opportunity || null}
        position={selectedAction?.position}
        profile={profile}
        open={Boolean(selectedAction)}
        onOpenChange={(open) => {
          if (!open) setSelectedAction(null);
        }}
        onComplete={refresh}
      />

      <StockActionDialog
        action={selectedStockAction?.action || "buy"}
        stock={selectedStockAction?.stock || null}
        holding={selectedStockAction?.holding || null}
        profile={profile}
        open={Boolean(selectedStockAction)}
        onOpenChange={(open) => {
          if (!open) setSelectedStockAction(null);
        }}
        onComplete={async () => {
          await Promise.all([
            refetchStocks(),
            refetchStockPortfolio(),
            refresh(),
          ]);
          router.refresh();
        }}
      />

      {isLoading ? (
        <span className="sr-only">
          <Loader2 className="animate-spin" />
          Loading Earn
        </span>
      ) : null}
    </main>
  );
}
