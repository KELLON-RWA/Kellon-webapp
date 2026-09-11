"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import {
  ArrowDownRight,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Loader2,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import EarnMetricSparkline from "./EarnMetricSparkline";

interface EarnPageProps {
  profile: User;
}

type EarnCategory = "yield" | "stocks" | "rwa";

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

const STOCK_DOMAINS: Record<string, string> = {
  AAPL: "apple.com",
  AMZN: "amazon.com",
  BABA: "alibaba.com",
  COIN: "coinbase.com",
  CRCL: "circle.com",
  GME: "gamestop.com",
  GOOGL: "google.com",
  HOOD: "robinhood.com",
  INTC: "intel.com",
  META: "meta.com",
  MSFT: "microsoft.com",
  MSTR: "strategy.com",
  NFLX: "netflix.com",
  NOK: "nokia.com",
  NVDA: "nvidia.com",
  QQQ: "invesco.com",
  SNDK: "sandisk.com",
  SOXL: "direxion.com",
  SOXS: "direxion.com",
  SPCX: "spacex.com",
  TQQQ: "proshares.com",
  TSLA: "tesla.com",
  TSM: "tsmc.com",
};

function getStockLogoUrl(symbol: string, logoUrl?: string): string | undefined {
  if (logoUrl) return logoUrl;

  const upperSymbol = symbol.toUpperCase();
  const symbolCandidates = [
    upperSymbol.replace(/[BC]$/, ""),
    upperSymbol.replace(/^B/, ""),
  ];
  const domain = symbolCandidates
    .map((candidate) => STOCK_DOMAINS[candidate])
    .find(Boolean);

  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : undefined;
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
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-80 bg-white font-extrabold text-primary-90 dark:border-white/10 dark:bg-secondary-60 dark:text-primary-30",
        size === "sm" ? "h-10 w-10 text-xs" : "h-12 w-12 text-sm",
      )}
    >
      {symbol.slice(0, 2).toUpperCase()}
      {src ? (
        // Stock logos are supplied by the catalogue API and can use provider CDNs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${symbol} logo`}
          className="absolute inset-0 h-full w-full bg-white object-contain p-1 dark:bg-secondary-60"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
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
  const [activeTab, setActiveTab] = useState<EarnCategory>("yield");
  const [stockProviderFilter, setStockProviderFilter] = useState<string>("all");
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
      setStockProviderFilter("all");
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
  const totalSuppliedPoints = useMemo(() => {
    let runningTotal = 0;
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    });
    const positionHistory = [...activePositions]
      .sort((left, right) => {
        const leftDate = left.createdAt
          ? new Date(left.createdAt).getTime()
          : 0;
        const rightDate = right.createdAt
          ? new Date(right.createdAt).getTime()
          : 0;
        return leftDate - rightDate;
      })
      .map((position, index) => {
        runningTotal += getPositionValue(position);
        return {
          label: position.createdAt
            ? dateFormatter.format(new Date(position.createdAt))
            : `Position ${index + 1}`,
          value: runningTotal,
        };
      });

    return positionHistory.length
      ? positionHistory
      : [{ label: "No active positions", value: 0 }];
  }, [activePositions]);
  const averageApyPoints = currentPositionMetrics.length
    ? currentPositionMetrics.map(({ apy, label }) => ({
        label,
        value: apy,
      }))
    : [{ label: "No active positions", value: 0 }];
  const annualYieldPoints = Array.from({ length: 13 }, (_, month) => ({
    label: month === 0 ? "Now" : `Month ${month}`,
    value:
      totalSupplied > 0
        ? totalSupplied * (Math.pow(1 + averageApy / 100, month / 12) - 1)
        : 0,
  }));
  const categoryStocks = useMemo(
    () =>
      stocks.filter((stock) =>
        activeTab === "rwa"
          ? isRwaStockListing(stock)
          : !isRwaStockListing(stock),
      ),
    [activeTab, stocks],
  );
  const filteredStocks = useMemo(() => {
    return categoryStocks.filter(
      (stock) =>
        stockProviderFilter === "all" ||
        (stock.provider || "").toLowerCase() ===
          stockProviderFilter.toLowerCase(),
    );
  }, [categoryStocks, stockProviderFilter]);
  const stockProviders = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(categoryStocks.map((stock) => stock.provider).filter(Boolean)),
      ).sort(),
    ],
    [categoryStocks],
  );
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
        symbol: stock.symbol.replace(/[bBcC]$/, ""),
        name: stock.name.replace(/\s+bStock$/i, ""),
        price: Number(stock.price) || 0,
        currency: stock.currency,
        change: undefined as number | undefined,
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
      <div className="mb-6 flex items-center gap-2">
        <section
          aria-label="Earn categories"
          className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-xl border border-gray-80 bg-white/60 p-1 shadow-sm backdrop-blur-xl md:gap-2 md:p-2 dark:border-white/10 dark:bg-secondary-50/40"
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
                  setStockProviderFilter("all");
                }}
                className={cn(
                  "min-w-0 rounded-lg px-2 py-2 text-center transition md:px-4 md:py-3",
                  isActive
                    ? "bg-primary-90 text-white shadow-sm dark:bg-primary-70"
                    : "text-gray-30 hover:bg-gray-90 dark:text-gray-40 dark:hover:bg-white/10",
                )}
              >
                <span className="block truncate text-xs font-bold min-[360px]:text-sm md:text-base">
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

          <section className="relative mb-8 hidden min-h-44 grid-cols-3! overflow-hidden rounded-xl border border-white/70 bg-white/70 shadow-sm shadow-primary-90/30 backdrop-blur-xl md:grid lg:min-h-52 dark:border-white/10 dark:bg-secondary-50/20 dark:shadow-none">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_18%_0%,rgba(138,22,133,0.16),transparent_42%),linear-gradient(115deg,rgba(255,255,255,0.72),rgba(246,232,242,0.5)_44%,rgba(255,255,255,0.24))] dark:hidden lg:h-52" />
            <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-44 dark:block dark:bg-[radial-gradient(circle_at_20%_0%,rgba(193,92,165,0.45),transparent_48%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.14),transparent_38%)] lg:h-52" />

            <div className="relative flex min-h-44 min-w-0 flex-col justify-between border-r border-gray-80 p-3 lg:min-h-52 lg:p-5 dark:border-white/10">
              <div className="min-w-0">
                <p className="text-[9px] leading-tight font-medium text-gray-30 lg:flex lg:items-center lg:justify-between lg:gap-3 lg:text-xs dark:text-gray-40">
                  <span>Total supplied</span>
                  <span className="hidden text-[9px] font-semibold uppercase lg:inline">
                    Position history
                  </span>
                </p>
                <p className="mt-1 max-w-full whitespace-nowrap text-xs leading-tight font-bold text-cryptoNight tabular-nums lg:text-xl dark:text-white">
                  <span className="lg:hidden">
                    {formatMetricUsd(totalSupplied)}
                  </span>
                  <span className="hidden lg:inline">
                    {formatUsd(totalSupplied)}
                  </span>
                </p>
              </div>
              <EarnMetricSparkline
                points={totalSuppliedPoints}
                label="Cumulative supplied position history in US dollars"
                tone="primary"
                formatValue={formatUsd}
                className="-mx-3 -mb-3 mt-4 w-[calc(100%+1.5rem)] lg:-mx-5 lg:-mb-5 lg:w-[calc(100%+2.5rem)]"
              />
            </div>
            <div className="relative flex min-h-44 min-w-0 flex-col justify-between border-r border-gray-80 p-3 lg:min-h-52 lg:p-5 dark:border-white/10">
              <div>
                <p className="text-[9px] leading-tight font-medium text-gray-30 lg:flex lg:items-center lg:justify-between lg:gap-3 lg:text-xs dark:text-gray-40">
                  <span>Average APY</span>
                  <span className="hidden text-[9px] font-semibold uppercase lg:inline">
                    Current rates
                  </span>
                </p>
                <p className="mt-1 text-base font-bold text-cryptoNight tabular-nums lg:text-2xl dark:text-white">
                  {averageApy.toFixed(2)}%
                </p>
              </div>
              <EarnMetricSparkline
                points={averageApyPoints}
                label="Current APY by active position in percent"
                tone="positive"
                formatValue={(value) => `${value.toFixed(2)}%`}
                className="-mx-3 -mb-3 mt-4 w-[calc(100%+1.5rem)] lg:-mx-5 lg:-mb-5 lg:w-[calc(100%+2.5rem)]"
              />
            </div>
            <div className="relative flex min-h-44 min-w-0 flex-col justify-between p-3 lg:min-h-52 lg:p-5">
              <div className="min-w-0">
                <p className="text-[9px] leading-tight font-medium text-gray-30 lg:flex lg:items-center lg:justify-between lg:gap-3 lg:text-xs dark:text-gray-40">
                  <span className="lg:hidden">Annual yield</span>
                  <span className="hidden lg:inline">Est. annual yield</span>
                  <span className="hidden text-[9px] font-semibold uppercase lg:inline">
                    12 months
                  </span>
                </p>
                <p className="mt-1 max-w-full whitespace-nowrap text-xs leading-tight font-bold text-cryptoNight tabular-nums lg:text-xl dark:text-white">
                  <span className="lg:hidden">
                    {formatMetricUsd(estimatedAnnualYield)}
                  </span>
                  <span className="hidden lg:inline">
                    {formatUsd(estimatedAnnualYield)}
                  </span>
                </p>
              </div>
              <EarnMetricSparkline
                points={annualYieldPoints}
                label="Twelve month estimated yield projection in US dollars"
                tone="info"
                formatValue={formatUsd}
                className="-mx-3 -mb-3 mt-4 w-[calc(100%+1.5rem)] lg:-mx-5 lg:-mb-5 lg:w-[calc(100%+2.5rem)]"
              />
            </div>
          </section>

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
            ) : activePositions.length ? (
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
            ) : (
              <div className="rounded-lg border border-gray-80 bg-white/65 p-4 dark:border-white/10 dark:bg-secondary-50/55">
                <div>
                  <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                    No active positions yet
                  </p>
                  <p className="text-xs text-gray-30 dark:text-gray-40">
                    Choose an opportunity below to start earning.
                  </p>
                </div>
              </div>
            )}
          </section>
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
              <div className="mb-6 hidden rounded-xl border border-gray-80 bg-white/80 p-5 shadow-sm md:block dark:border-white/10 dark:bg-secondary-50/75">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-30 dark:text-gray-40">
                      {activeTab === "rwa" ? "RWA" : "Stock"} Portfolio Value
                    </p>
                    <p className="text-2xl font-extrabold text-cryptoNight dark:text-white">
                      {formatUsd(categoryPortfolio.totalPortfolioValue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold",
                        categoryPortfolio.totalUnrealizedPnL >= 0
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
                      )}
                    >
                      {categoryPortfolio.totalUnrealizedPnL >= 0 ? "+" : ""}
                      {formatUsd(categoryPortfolio.totalUnrealizedPnL)} (
                      {categoryPortfolio.totalUnrealizedPnLPercentage.toFixed(
                        2,
                      )}
                      %)
                    </span>
                    <p className="text-xs text-gray-30 dark:text-gray-40">
                      Cost Basis: {formatUsd(categoryPortfolio.totalCostBasis)}
                    </p>
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
                                "mt-1 text-[10px] font-bold",
                                pnl >= 0
                                  ? "text-emerald-600 dark:text-emerald-300"
                                  : "text-rose-600 dark:text-rose-300",
                              )}
                            >
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
                <h4 className="mb-3 text-sm font-bold text-cryptoNight dark:text-white">
                  Market ETFs
                </h4>
                <div className="mr-[calc(50%_-_50vw)] flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mr-0 md:grid md:grid-cols-3 md:overflow-visible md:pr-0">
                  {marketEtfs.map((idx) => (
                    <div
                      key={idx.symbol}
                      className="flex min-h-[128px] w-[44%] min-w-32 shrink-0 snap-start flex-col rounded-xl border border-gray-80 bg-white/60 p-3 dark:border-white/10 dark:bg-secondary-50/50 md:min-h-[140px] md:w-auto"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cryptoNight dark:text-white">
                          {idx.symbol}
                        </span>
                        {idx.change !== undefined && idx.change >= 0 ? (
                          <ArrowUpRight
                            className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                            aria-hidden="true"
                          />
                        ) : idx.change !== undefined ? (
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

            <h2 className="mb-3 text-base font-bold text-cryptoNight dark:text-white">
              {activeTab === "rwa"
                ? "RWA opportunities"
                : "Stock opportunities"}
            </h2>

            {stockProviders.length > 1 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {stockProviders.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setStockProviderFilter(provider)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      stockProviderFilter === provider
                        ? "bg-primary-90 text-white dark:bg-primary-70"
                        : "bg-gray-90 text-gray-30 hover:bg-gray-80 dark:bg-white/5 dark:text-gray-40 dark:hover:bg-white/10",
                    )}
                  >
                    {provider === "all"
                      ? "All providers"
                      : getProtocolName(provider)}
                  </button>
                ))}
              </div>
            ) : null}

            {stocksLoading ? (
              <EarnSkeleton threeColumnsOnDesktop />
            ) : filteredStocks.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3!">
                {filteredStocks.map((stock) => (
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
                              {stock.symbol}
                            </p>
                            <span className="rounded-full bg-primary-90/10 px-1.5 py-0.5 text-[8px] font-bold text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">
                              {getProtocolName(stock.provider)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-gray-30 dark:text-gray-40">
                            {stock.name}
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
                            ? stock.rwaCategory || stock.category || "Tokenized"
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
            ) : (
              <div className="flex min-h-36 items-center justify-center rounded-lg border border-gray-80 bg-white/65 px-4 text-center dark:border-white/10 dark:bg-secondary-50/55">
                <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                  {stockProviderFilter !== "all"
                    ? `No ${activeTab === "rwa" ? "RWA products" : "stocks"} are available from ${getProtocolName(stockProviderFilter)}.`
                    : `No ${activeTab === "rwa" ? "RWA products" : "stocks"} are available yet.`}
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
