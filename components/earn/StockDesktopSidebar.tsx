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
}

type TabType = "all" | "watchlist";
type MoverFilterType = "all" | "gainers" | "losers";

export default function StockDesktopSidebar({
  stocks,
  currentSymbol,
  watchlist,
  onToggleWatchlist,
  className = "",
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
      }
    }
    return Array.from(map.values());
  }, [stocks]);

  // Fetch 24h market chart changes for the stock universe
  const marketSymbols = useMemo(
    () =>
      uniqueStocks
        .map((s) => getUnderlyingTicker(s.symbol, s.provider))
        .slice(0, 50),
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
      const price = Number(stock.price) || 0;
      const displaySymbol = getDisplayStockSymbol(stock.symbol, stock.provider);
      const displayName = getDisplayStockName(stock.name);
      const logoUrl = getStockLogoUrl(displaySymbol, stock.logoUrl);
      const isStarred = watchlist.has(ticker);
      const isCurrent =
        ticker === normalizedCurrentSymbol ||
        displaySymbol === normalizedCurrentSymbol;

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
  }, [uniqueStocks, chartData, watchlist, normalizedCurrentSymbol]);

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
      <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-4 shadow-lg backdrop-blur">
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
            className="h-9 w-full rounded-xl border border-white/10 bg-secondary-60/80 py-1.5 pl-9 pr-8 text-xs text-white placeholder-gray-400 outline-none transition focus:border-primary-50 focus:ring-1 focus:ring-primary-50/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tab Toggle: All vs Watchlist */}
        <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                activeTab === "all"
                  ? "bg-primary-60 text-white shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5",
              )}
            >
              All ({enrichedStocks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("watchlist")}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                activeTab === "watchlist"
                  ? "bg-primary-60 text-white shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5",
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
          <span className="text-[10px] font-medium text-gray-400">
            {filteredStocks.length} listed
          </span>
        </div>

        {/* Column Headers */}
        <div className="flex items-center justify-between px-1 py-1 text-[10px] font-semibold text-gray-400">
          <span>Asset</span>
          <span>Last Price / 24h</span>
        </div>

        {/* Scrollable Stocks List */}
        <div className="max-h-[340px] space-y-1 overflow-y-auto pr-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
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
                      : "hover:border-white/10 hover:bg-white/5",
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
                            : "text-gray-500 group-hover:text-gray-400",
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
                          <span className="truncate text-xs font-bold text-white">
                            {item.ticker}
                          </span>
                          {item.isCurrent && (
                            <span className="rounded bg-primary-60/30 px-1 py-0.2 text-[9px] font-semibold text-primary-30">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="max-w-[110px] truncate text-[10px] text-gray-400">
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
                    <p className="text-xs font-bold tabular-nums text-white">
                      {formatUsd(item.price)}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
                        isPositive ? "text-emerald-400" : "text-rose-400",
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
            <div className="py-8 text-center text-xs text-gray-400">
              {activeTab === "watchlist" ? (
                <>
                  <Star className="mx-auto mb-2 h-6 w-6 text-gray-600" />
                  <p className="font-semibold text-gray-300">
                    No stocks in watchlist
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
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
      <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-4 shadow-lg backdrop-blur">
        {/* Header with Title and Filter Pills */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white sm:text-sm">
              Top Movers
            </h3>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-gray-300">
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
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize transition",
                  moverFilter === filter
                    ? "bg-white/20 text-white font-semibold"
                    : "text-gray-400 hover:text-white",
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
                  className="flex items-center justify-between rounded-xl border border-transparent p-2 transition hover:border-white/10 hover:bg-white/5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/5 text-[10px] font-bold text-gray-400">
                      {idx + 1}
                    </span>
                    <StockLogo
                      symbol={item.displaySymbol}
                      src={item.logoUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        {item.ticker}
                      </p>
                      <p className="max-w-[120px] truncate text-[10px] text-gray-400">
                        {item.displayName}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold tabular-nums text-white">
                      {formatUsd(item.price)}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        isPositive
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400",
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
            <p className="py-4 text-center text-xs text-gray-400">
              No movers data available
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
