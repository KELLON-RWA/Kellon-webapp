"use client";

import { useQuery } from "@tanstack/react-query";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import {
  ArrowDownToLine,
  ArrowRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { yieldService, type YieldActionType } from "@/services/api/yield";
import { stocksService } from "@/services/api/stocks";
import {
  PositionStatus,
  RiskLevel,
  type User,
  type YieldOpportunity,
  type YieldPosition,
} from "@/types/db";
import EarnActionDialog from "./EarnActionDialog";
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

export default function EarnPage({ profile }: EarnPageProps) {
  const { isConnected } = useRealtime();
  const [activeTab, setActiveTab] = useState<"yield" | "stocks">("yield");
  const [stockProviderFilter, setStockProviderFilter] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<SelectedAction>(null);
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [isSearchToolbarStuck, setIsSearchToolbarStuck] = useState(false);
  const searchToolbarRef = useRef<HTMLDivElement>(null);
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
  } = useQuery({
    queryKey: ["available-stocks"],
    queryFn: async () => (await stocksService.getAvailableStocks("all")).data,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: stockPortfolio } = useQuery({
    queryKey: ["stock-portfolio"],
    queryFn: async () => (await stocksService.getPortfolio()).data,
    enabled: activeTab === "stocks",
    staleTime: 30_000,
  });

  const { data: marketIndices = [] } = useQuery({
    queryKey: ["market-indices"],
    queryFn: async () => (await stocksService.getIndices()).data,
    enabled: activeTab === "stocks",
    staleTime: 60_000,
  });

  useEffect(() => {
    const updateStickyState = () => {
      const toolbar = searchToolbarRef.current;
      if (!toolbar) return;

      const stickyOffset = window.matchMedia("(min-width: 768px)").matches
        ? 64
        : 0;
      const nextIsStuck = toolbar.getBoundingClientRect().top <= stickyOffset;

      setIsSearchToolbarStuck((current) =>
        current === nextIsStuck ? current : nextIsStuck,
      );
    };

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);

    return () => {
      window.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, []);
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
  const filteredOpportunities = useMemo(() => {
    const query = opportunitySearch.trim().toLowerCase();
    if (!query) return opportunities;

    return opportunities.filter((opportunity) =>
      [
        getProtocolName(opportunity.protocol),
        opportunity.symbol,
        opportunity.chain,
        opportunity.riskLevel,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [opportunities, opportunitySearch]);
  const isLoading = opportunitiesLoading || positionsLoading;
  const error = opportunitiesError || positionsError;

  const refresh = async () => {
    await Promise.all([refetchOpportunities(), refetchPositions()]);
  };

  return (
    <main className="container mx-auto min-h-[100dvh] w-full max-w-7xl px-4 pb-32 pt-4 md:px-6 md:pb-12 md:pt-28">
      <header className="mb-2 flex justify-end">
        <Button
          type="button"
          variant="iconCircle"
          size="icon"
          onClick={refresh}
          disabled={isLoading}
          aria-label="Refresh Earn data"
          title="Refresh"
        >
          <RefreshCw className={cn(isLoading && "animate-spin")} />
        </Button>
      </header>

      <section className="relative mb-8 grid min-h-44 grid-cols-3! overflow-hidden rounded-xl border border-white/70 bg-white/70 shadow-sm shadow-primary-90/30 backdrop-blur-xl lg:min-h-52 dark:border-white/10 dark:bg-secondary-50/20 dark:shadow-none">
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

      <section className="w-full">
        <div className="mb-4 flex items-center gap-2 border-b border-gray-80 pb-2 dark:border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("yield")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-bold transition",
              activeTab === "yield"
                ? "bg-primary-90 text-white dark:bg-primary-70"
                : "text-gray-30 hover:bg-gray-90 dark:text-gray-40 dark:hover:bg-white/10"
            )}
          >
            Yield Opportunities
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stocks")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-bold transition",
              activeTab === "stocks"
                ? "bg-primary-90 text-white dark:bg-primary-70"
                : "text-gray-30 hover:bg-gray-90 dark:text-gray-40 dark:hover:bg-white/10"
            )}
          >
            Tokenized Stocks
          </button>
        </div>

        {activeTab === "yield" ? (
          <>
            <div
              ref={searchToolbarRef}
              className={cn(
                "sticky top-0 z-30 mb-4 flex w-full flex-col gap-3 rounded-lg border border-transparent py-3 transition-[background-color,border-color,padding] duration-200 md:top-16 md:flex-row md:items-end md:justify-between",
                isSearchToolbarStuck &&
                  "border-gray-80 bg-white/65 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-secondary-50/55",
              )}
            >
              <div>
                <h2 className="text-base font-bold text-cryptoNight dark:text-white md:text-lg">
                  Yield opportunities
                </h2>
                <p className="text-xs text-gray-30 dark:text-gray-40">
                  Rates are variable and may change with market conditions
                </p>
              </div>

              <div className="relative w-full md:max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-30 dark:text-gray-40"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={opportunitySearch}
                  onChange={(event) => setOpportunitySearch(event.target.value)}
                  placeholder="Search yield opportunities"
                  aria-label="Search yield opportunities"
                  className="h-10 rounded-lg border-gray-80 bg-white/75 pl-9 pr-9 text-sm text-cryptoNight shadow-sm placeholder:text-gray-30 focus-visible:border-primary-80 focus-visible:ring-primary-80/20 dark:border-white/10 dark:bg-secondary-50/60 dark:text-white dark:placeholder:text-gray-40"
                />
                {opportunitySearch ? (
                  <button
                    type="button"
                    onClick={() => setOpportunitySearch("")}
                    aria-label="Clear opportunity search"
                    title="Clear search"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-gray-30 transition hover:bg-gray-90 hover:text-cryptoNight dark:text-gray-40 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            {opportunitiesLoading ? (
              <EarnSkeleton threeColumnsOnDesktop />
            ) : filteredOpportunities.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3!">
                {filteredOpportunities.map((opportunity) => {
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
                      className="group rounded-lg border border-gray-80 bg-white/80 p-4 shadow-sm transition hover:border-primary-90 hover:bg-white dark:border-white/10 dark:bg-secondary-50/75 dark:shadow-none dark:hover:border-primary-70/40 dark:hover:bg-secondary-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <AssetNetworkIcon
                            symbol={opportunity.symbol}
                            network={opportunity.chain}
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-bold text-cryptoNight dark:text-white">
                              {getProtocolName(opportunity.protocol)}
                            </p>
                            <p className="text-xs capitalize text-gray-30 dark:text-gray-40">
                              {opportunity.symbol} · {opportunity.chain}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-[9px] font-bold capitalize",
                            riskStyles[normalizedRisk],
                          )}
                        >
                          {normalizedRisk.toLowerCase()}
                        </span>
                      </div>

                      <div className="my-5 flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-bold text-cryptoNight dark:text-white">
                            {formatApy(opportunity.apy)}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold uppercase text-gray-30 dark:text-gray-40">
                            Variable APY
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="flex items-center justify-end gap-1 text-[10px] font-semibold text-gray-30 dark:text-gray-40">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Available
                          </p>
                          <p className="mt-1 text-xs font-bold text-cryptoNight dark:text-white">
                            {formatTokenAmount(available)} {opportunity.symbol}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="flow"
                        size="sm"
                        className="w-full"
                        disabled={available <= 0}
                        onClick={() =>
                          setSelectedAction({ action: "supply", opportunity })
                        }
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {available > 0 ? "Start earning" : "No available balance"}
                          {available > 0 ? (
                            <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                          ) : null}
                        </span>
                        {available > 0 ? (
                          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                        ) : null}
                      </Button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-36 items-center justify-center rounded-lg border border-gray-80 bg-white/65 px-4 text-center dark:border-white/10 dark:bg-secondary-50/55">
                <div>
                  <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                    {opportunitySearch
                      ? "No matching yield opportunities"
                      : "No opportunities available"}
                  </p>
                  <p className="mt-1 text-xs text-gray-30 dark:text-gray-40">
                    {opportunitySearch
                      ? "Try a different protocol, asset, network, or risk level."
                      : "New yield options will appear here when they are enabled."}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div>
            {/* Portfolio Performance Summary */}
            {stockPortfolio && (
              <div className="mb-6 rounded-xl border border-gray-80 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-secondary-50/75">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-30 dark:text-gray-40">Stock Portfolio Value</p>
                    <p className="text-2xl font-extrabold text-cryptoNight dark:text-white">
                      ${stockPortfolio.totalPortfolioValue.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold",
                      stockPortfolio.totalUnrealizedPnL >= 0
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"
                    )}>
                      {stockPortfolio.totalUnrealizedPnL >= 0 ? "+" : ""}${stockPortfolio.totalUnrealizedPnL.toFixed(2)} ({stockPortfolio.totalUnrealizedPnLPercentage.toFixed(2)}%)
                    </span>
                    <p className="text-xs text-gray-30 dark:text-gray-40">
                      Cost Basis: ${stockPortfolio.totalCostBasis.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Benchmark Market Indices */}
            {marketIndices.length > 0 && (
              <div className="mb-6">
                <h4 className="mb-3 text-sm font-bold text-cryptoNight dark:text-white">Market Benchmark Indices</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {marketIndices.map((idx) => (
                    <div key={idx.symbol} className="rounded-lg border border-gray-80 bg-white/60 p-3 dark:border-white/10 dark:bg-secondary-50/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cryptoNight dark:text-white">{idx.symbol}</span>
                        <span className={cn("text-xs font-bold", idx.change24hPercentage >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {idx.change24hPercentage >= 0 ? "+" : ""}{idx.change24hPercentage.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-30 dark:text-gray-40">{idx.name}</p>
                      <p className="mt-1 text-base font-bold text-cryptoNight dark:text-white">${idx.price.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { id: "all", label: "All Providers" },
                { id: "base_b20", label: "Base B20" },
                { id: "dinari", label: "Dinari dShares" },
                { id: "pancakeswap", label: "PancakeSwap bStocks" },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStockProviderFilter(chip.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition",
                    stockProviderFilter === chip.id
                      ? "bg-primary-90 text-white dark:bg-primary-70"
                      : "bg-gray-90 text-gray-30 hover:bg-gray-80 dark:bg-white/5 dark:text-gray-40 dark:hover:bg-white/10"
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {stocksLoading ? (
              <EarnSkeleton threeColumnsOnDesktop />
            ) : stocks.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3!">
                {stocks
                  .filter(
                    (stk) =>
                      stockProviderFilter === "all" ||
                      (stk.provider || "").toLowerCase() ===
                        stockProviderFilter.toLowerCase()
                  )
                  .map((stock) => (
                    <article
                      key={`${stock.provider}_${stock.symbol}`}
                      className="group rounded-lg border border-gray-80 bg-white/80 p-4 shadow-sm transition hover:border-primary-90 hover:bg-white dark:border-white/10 dark:bg-secondary-50/75 dark:shadow-none dark:hover:border-primary-70/40 dark:hover:bg-secondary-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-cryptoNight dark:text-white">
                              {stock.symbol}
                            </p>
                            <span className="rounded-full bg-primary-90/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">
                              {stock.provider.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-xs text-gray-30 dark:text-gray-40">
                            {stock.name}
                          </p>
                        </div>
                      </div>

                      <div className="my-5 flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-bold text-cryptoNight dark:text-white">
                            ${(Number(stock.price) || 0).toFixed(2)}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold uppercase text-gray-30 dark:text-gray-40">
                            {stock.currency}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                            24/7 Tokenized
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            ) : (
              <div className="flex min-h-36 items-center justify-center rounded-lg border border-gray-80 bg-white/65 px-4 text-center dark:border-white/10 dark:bg-secondary-50/55">
                <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                  No stocks available for selected provider.
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

      {isLoading ? (
        <span className="sr-only">
          <Loader2 className="animate-spin" />
          Loading Earn
        </span>
      ) : null}
    </main>
  );
}
