"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStockCharts } from "@/components/earn/StockSparkline";
import { getCompanyLogoUrl } from "@/lib/stock-branding";
import { getUnderlyingTicker } from "@/lib/stock-catalog";
import type { StockListing } from "@/services/api/stocks";
import { TopMoversListSkeleton } from "./DashboardSkeletons";

interface TopMoversPanelProps {
  listings: StockListing[];
  isListingsLoading: boolean;
}

function assetLogo(ticker: string, listing: StockListing) {
  return (
    getCompanyLogoUrl(ticker) ||
    listing.logoUrl ||
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(ticker)}`
  );
}

export default function TopMoversPanel({
  listings,
  isListingsLoading,
}: TopMoversPanelProps) {
  // Deduplicate listings by underlying ticker so the same company is never repeated
  const uniqueListings = useMemo(() => {
    const map = new Map<string, StockListing>();
    for (const listing of listings) {
      const ticker = getUnderlyingTicker(listing.symbol, listing.provider);
      if (!ticker) continue;
      if (!map.has(ticker)) {
        map.set(ticker, listing);
      } else {
        const existing = map.get(ticker)!;
        const isCurrentExact = listing.symbol.toUpperCase() === ticker;
        const isExistingExact = existing.symbol.toUpperCase() === ticker;
        if (isCurrentExact && !isExistingExact) {
          map.set(ticker, listing);
        } else if (
          !isExistingExact &&
          !/on$/i.test(listing.symbol) &&
          /on$/i.test(existing.symbol)
        ) {
          map.set(ticker, listing);
        }
      }
    }
    return Array.from(map.values());
  }, [listings]);

  const marketSymbols = useMemo(
    () =>
      uniqueListings
        .map((listing) => getUnderlyingTicker(listing.symbol, listing.provider))
        .slice(0, 20),
    [uniqueListings],
  );

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["dashboard-top-mover-changes", marketSymbols],
    queryFn: () => getStockCharts(marketSymbols, "1D"),
    enabled: marketSymbols.length > 0,
    staleTime: 60_000,
  });

  const movers = useMemo(() => {
    return uniqueListings
      .map((listing) => {
        const ticker = getUnderlyingTicker(listing.symbol, listing.provider);
        return {
          listing,
          ticker,
          change: chartData?.changes[ticker],
        };
      })
      .filter(
        (mover): mover is { listing: StockListing; ticker: string; change: number } =>
          typeof mover.change === "number" && Number.isFinite(mover.change),
      )
      .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))
      .slice(0, 4);
  }, [uniqueListings, chartData]);

  return (
    <section className="hidden rounded-xl border border-black/10 bg-white/80 p-5 shadow-none dark:border-white/10 dark:bg-secondary-50 min-[1280px]:block min-[1280px]:border-0 min-[1280px]:!bg-white/80 min-[1280px]:p-4 min-[1280px]:shadow-none min-[1280px]:dark:!bg-secondary-50">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-cryptoNight dark:text-white">
          Top movers (24h)
        </h3>
      </div>
      {isListingsLoading || isLoading ? (
        <TopMoversListSkeleton />
      ) : movers.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
          {movers.map(({ listing, ticker, change }) => {
            const positive = change >= 0;
            return (
              <Link
                key={ticker}
                href={`/earn/stocks/${encodeURIComponent(ticker)}?provider=${encodeURIComponent(listing.provider)}`}
                className="flex items-center justify-between gap-3 border-b border-black/10 px-3 py-1.5 last:border-b-0 transition hover:bg-primary-99 dark:border-white/10 dark:hover:bg-white/5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="relative grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border border-black/10 bg-white text-[8px] font-bold text-primary-70 dark:border-white/10 dark:bg-secondary-60">
                    {ticker.slice(0, 2)}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetLogo(ticker, listing)}
                      alt=""
                      className="absolute inset-0 h-full w-full rounded-full bg-white object-contain p-0.5"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-cryptoNight dark:text-white min-[1024px]:text-[11px] lg:text-sm">
                    {ticker}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums min-[1024px]:text-[11px] lg:text-sm ${
                    positive
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {positive ? "+" : ""}
                  {change.toFixed(2)}%
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-40">
          Live market data is unavailable.
        </p>
      )}
    </section>
  );
}
