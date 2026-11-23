"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Flame,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import type { StockListing } from "@/services/api/stocks";
import { getStockCharts } from "@/components/earn/StockSparkline";
import {
  getDisplayStockName,
  getDisplayStockSymbol,
  getListingChange,
  getStockLogoUrl,
  getUnderlyingTicker,
  StockLogo,
} from "@/components/earn/EarnPage";
import { formatUsd } from "@/components/earn/earn-utils";
import { cn } from "@/lib/utils";

interface StockDesktopSidebarProps {
  stocks: StockListing[];
  currentSymbol: string;
  watchlist: Set<string>;
  onToggleWatchlist: (ticker: string) => void;
  className?: string;
  currentLivePrice?: number;
}

type TabType = "all" | "watchlist";
type MoverFilterType = "all" | "gainers" | "losers";

export default function StockDesktopSidebar({
  stocks,
  currentSymbol,
  watchlist,
  onToggleWatchlist,
  className = "",
  currentLivePrice,
}: StockDesktopSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [moverFilter, setMoverFilter] = useState<MoverFilterType>("all");

  const normalizedCurrentSymbol = currentSymbol.trim().toUpperCase();

  // Deduplicate stocks by underlying ticker for the sidebar list
  const uniqueStocks = useMemo(() => {
    const map = new Map<string, StockListing>();
    for (const stock of stocks) {
      const ticker = getUnderlyingTicker(stock.symbol, stock.provider);
      if (!map.has(ticker)) {
        map.set(ticker, stock);
      } else {
        const existing = map.get(ticker)!;
        const isCurrentExact = stock.symbol.toUpperCase() === ticker;
        const isExistingExact = existing.symbol.toUpperCase() === ticker;
        if (isCurrentExact && !isExistingExact) {
          map.set(ticker, stock);
        } else if (
          !isExistingExact &&
          !/on$/i.test(stock.symbol) &&
          /on$/i.test(existing.symbol)
        ) {
          map.set(ticker, stock);
        }
      }
    }
    return Array.from(map.values());
  }, [stocks]);

  // Fetch 24h market chart changes for the stock universe
  const marketSymbols = useMemo(
    () =>
      uniqueStocks
        .map((s) => getUnderlyingTicker(s.symbol, s.provider))
        .slice(0, 20),
    [uniqueStocks],
  );

  const { data: chartData } = useQuery({
    queryKey: ["desktop-sidebar-stock-changes", marketSymbols],
    queryFn: () => getStockCharts(marketSymbols, "1D"),
    enabled: marketSymbols.length > 0,
    staleTime: 60_000,
  });

  // Enriched stock items with price & calculated 24h change
  const enrichedStocks = useMemo(() => {
    return uniqueStocks.map((stock) => {
      const ticker = getUnderlyingTicker(stock.symbol, stock.provider);
      const yahooChange = chartData?.changes[ticker];
      const change = getListingChange(stock, yahooChange) ?? 0;
      const displaySymbol = getDisplayStockSymbol(stock.symbol, stock.provider);
      const displayName = getDisplayStockName(stock.name);
      const logoUrl = getStockLogoUrl(displaySymbol, stock.logoUrl);
      const isStarred = watchlist.has(ticker);
      const isCurrent =
        ticker === normalizedCurrentSymbol ||
        displaySymbol === normalizedCurrentSymbol;
      const price =
        isCurrent && currentLivePrice && currentLivePrice > 0
          ? currentLivePrice
          : Number(stock.price) || 0;

      return {
        stock,
        ticker,
        displaySymbol,
        displayName,
        logoUrl,
        price,
        change,
        isStarred,
        isCurrent,
      };
    });
  }, [uniqueStocks, chartData, watchlist, normalizedCurrentSymbol, currentLivePrice]);

  // Filter Box 1 stocks based on search and All/Watchlist tab
  const filteredStocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedStocks.filter((item) => {
      if (activeTab === "watchlist" && !item.isStarred) {
        return false;
      }
      if (q) {
        const matchesSymbol = item.ticker.toLowerCase().includes(q);
        const matchesName = item.displayName.toLowerCase().includes(q);
        if (!matchesSymbol && !matchesName) return false;
      }
      return true;
    });
  }, [enrichedStocks, activeTab, searchQuery]);

  // Box 2: Top Movers (filtered by All, Gainers, or Losers)
  const topMovers = useMemo(() => {
    const valid = enrichedStocks.filter((item) => Number.isFinite(item.change));
    if (moverFilter === "gainers") {
      return valid
        .filter((item) => item.change > 0)
        .sort((a, b) => b.change - a.change)
        .slice(0, 5);
    }
    if (moverFilter === "losers") {
      return valid
        .filter((item) => item.change < 0)
        .sort((a, b) => a.change - b.change)
        .slice(0, 5);
    }
    return valid
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 5);
  }, [enrichedStocks, moverFilter]);

  const watchlistCount = useMemo(
    () => enrichedStocks.filter((s) => s.isStarred).length,
    [enrichedStocks],
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ─────────────────────────────────────────────────────────────
          BOX 1: Other Stocks (Search + All / Watchlist Toggle)
         ───────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-lg">
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stocks..."
            className="h-9 w-full rounded-xl border border-gray-80 bg-white/90 py-1.5 pl-9 pr-8 text-xs text-cryptoNight placeholder-gray-40 outline-none transition focus:border-primary-50 focus:ring-1 focus:ring-primary-50/50 dark:border-white/10 dark:bg-secondary-60/80 dark:text-white dark:placeholder-gray-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-cryptoNight dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tab Toggle: All vs Watchlist */}
        <div className="mb-2 flex items-center justify-between border-b border-gray-80 pb-2 dark:border-white/10">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
                activeTab === "all"
                  ? "bg-gradient-to-r from-primary-70 to-primary-60 font-bold text-white shadow-sm"
                  : "text-gray-20 hover:text-cryptoNight hover:bg-gray-90/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5",
              )}
            >
              All ({enrichedStocks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("watchlist")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
                activeTab === "watchlist"
                  ? "bg-gradient-to-r from-primary-70 to-primary-60 font-bold text-white shadow-sm"
                  : "text-gray-20 hover:text-cryptoNight hover:bg-gray-90/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5",
              )}
            >
              <Star
                className={cn(
                  "h-3 w-3",
                  activeTab === "watchlist"
                    ? "fill-white text-white"
                    : "fill-amber-400/80 text-amber-400",
                )}
              />
              Watchlist {watchlistCount > 0 && `(${watchlistCount})`}
            </button>
          </div>
          <span className="text-[10px] font-medium text-gray-20 dark:text-gray-400">
            {filteredStocks.length} listed
          </span>
        </div>

        {/* Column Headers */}
        <div className="flex items-center justify-between px-1 py-1 text-[10px] font-semibold text-gray-20 dark:text-gray-400">
          <span>Asset</span>
          <span>Last Price / 24h</span>
        </div>

        {/* Scrollable Stocks List */}
        <div className="max-h-[340px] space-y-1 overflow-y-auto pr-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.15)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.15)_transparent]">
          {filteredStocks.length > 0 ? (
            filteredStocks.map((item) => {
              const isPositive = item.change >= 0;
              return (
                <div
                  key={item.ticker}
                  className={cn(
                    "group flex items-center justify-between rounded-xl border border-transparent p-2 transition",
                    item.isCurrent
                      ? "border-primary-50/40 bg-primary-60/15"
                      : "hover:border-gray-80 hover:bg-gray-90/60 dark:hover:border-white/10 dark:hover:bg-white/5",
                  )}
                >
                  {/* Star Toggle + Link to Stock */}
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      aria-label={
                        item.isStarred
                          ? `Remove ${item.ticker} from watchlist`
                          : `Add ${item.ticker} to watchlist`
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleWatchlist(item.ticker);
                      }}
                      className="p-0.5 text-gray-400 transition hover:scale-110 hover:text-amber-400"
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5 transition",
                          item.isStarred
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-400 group-hover:text-amber-400 dark:text-gray-500",
                        )}
                      />
                    </button>

                    <Link
                      href={`/earn/stocks/${encodeURIComponent(item.ticker)}?provider=${encodeURIComponent(item.stock.provider)}`}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <StockLogo
                        symbol={item.displaySymbol}
                        src={item.logoUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-cryptoNight dark:text-white">
                            {item.ticker}
                          </span>
                        </div>
                        <p className="max-w-[110px] truncate text-[10px] text-gray-20 dark:text-gray-400">
                          {item.displayName}
                        </p>
                      </div>
                    </Link>
                  </div>

                  {/* Price & 24h Change */}
                  <Link
                    href={`/earn/stocks/${encodeURIComponent(item.ticker)}?provider=${encodeURIComponent(item.stock.provider)}`}
                    className="shrink-0 text-right"
                  >
                    <p className="text-xs font-bold tabular-nums text-cryptoNight dark:text-white">
                      {formatUsd(item.price)}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
                        isPositive ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {item.change.toFixed(2)}%
                    </span>
                  </Link>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-gray-20 dark:text-gray-400">
              {activeTab === "watchlist" ? (
                <>
                  <Star className="mx-auto mb-2 h-6 w-6 text-gray-400 dark:text-gray-600" />
                  <p className="font-semibold text-cryptoNight dark:text-gray-300">
                    No stocks in watchlist
                  </p>
                  <p className="mt-1 text-[11px] text-gray-20 dark:text-gray-500">
                    Star stocks to add them to your favorites
                  </p>
                </>
              ) : (
                <p>No stocks found matching &ldquo;{searchQuery}&rdquo;</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          BOX 2: Top Movers (Ranked 24h Gainers & Decliners)
         ───────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-lg">
        {/* Header with Title and Filter Pills */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-bold text-cryptoNight sm:text-sm dark:text-white">
              Top Movers
            </h3>
            <span className="rounded bg-gray-90 px-1.5 py-0.5 text-[9px] font-semibold text-gray-20 dark:bg-white/10 dark:text-gray-300">
              24h
            </span>
          </div>

          <div className="flex items-center gap-1">
            {(["all", "gainers", "losers"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setMoverFilter(filter)}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize transition cursor-pointer",
                  moverFilter === filter
                    ? "bg-gray-80 text-cryptoNight font-semibold shadow-xs dark:bg-white/20 dark:text-white"
                    : "text-gray-20 hover:text-cryptoNight dark:text-gray-400 dark:hover:text-white",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Top Movers List */}
        <div className="space-y-1.5">
          {topMovers.length > 0 ? (
            topMovers.map((item, idx) => {
              const isPositive = item.change >= 0;
              return (
                <Link
                  key={`mover-${item.ticker}`}
                  href={`/earn/stocks/${encodeURIComponent(item.ticker)}?provider=${encodeURIComponent(item.stock.provider)}`}
                  className="flex items-center justify-between rounded-xl border border-transparent p-2 transition hover:border-gray-80 hover:bg-gray-90/60 dark:hover:border-white/10 dark:hover:bg-white/5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gray-90 text-[10px] font-bold text-gray-20 dark:bg-white/5 dark:text-gray-400">
                      {idx + 1}
                    </span>
                    <StockLogo
                      symbol={item.displaySymbol}
                      src={item.logoUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-cryptoNight dark:text-white">
                        {item.ticker}
                      </p>
                      <p className="max-w-[120px] truncate text-[10px] text-gray-20 dark:text-gray-400">
                        {item.displayName}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold tabular-nums text-cryptoNight dark:text-white">
                      {formatUsd(item.price)}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        isPositive
                          ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-500 dark:text-rose-400",
                      )}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-2.5 w-2.5" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5" />
                      )}
                      {isPositive ? "+" : ""}
                      {item.change.toFixed(2)}%
                    </span>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="py-4 text-center text-xs text-gray-20 dark:text-gray-400">
              No movers data available
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
