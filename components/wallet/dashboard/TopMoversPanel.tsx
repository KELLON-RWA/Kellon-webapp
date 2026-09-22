"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStockCharts } from "@/components/earn/StockSparkline";
import type { StockListing } from "@/services/api/stocks";

interface TopMoversPanelProps {
  listings: StockListing[];
}

function ticker(symbol: string) {
  return symbol.replace(/^[b]/i, "").replace(/[bc]$/i, "").toUpperCase();
}

function assetLogo(listing: StockListing) {
  return (
    listing.logoUrl ||
    `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(ticker(listing.symbol))}.png`
  );
}

export default function TopMoversPanel({ listings }: TopMoversPanelProps) {
  const marketSymbols = useMemo(
    () =>
      Array.from(
        new Map(listings.map((listing) => [ticker(listing.symbol), listing])).keys(),
      ).slice(0, 20),
    [listings],
  );
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["dashboard-top-mover-changes", marketSymbols],
    queryFn: () => getStockCharts(marketSymbols, "1D"),
    enabled: marketSymbols.length > 0,
    staleTime: 60_000,
  });
  const movers = listings
    .map((listing) => ({
      listing,
      change: chartData?.changes[ticker(listing.symbol)],
    }))
    .filter(
      (mover): mover is { listing: StockListing; change: number } =>
        typeof mover.change === "number" && Number.isFinite(mover.change),
    )
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))
    .slice(0, 4);

  return (
    <section className="hidden rounded-xl border border-black/10 bg-white/80 p-5 shadow-none dark:border-white/10 dark:bg-secondary-50 min-[1280px]:block min-[1280px]:border-0 min-[1280px]:!bg-white/80 min-[1280px]:p-4 min-[1280px]:shadow-none min-[1280px]:dark:!bg-secondary-50">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-cryptoNight dark:text-white">Top movers (24h)</h3>
      </div>
      {movers.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
          {movers.map(({ listing, change }) => {
            const positive = change >= 0;
            return (
              <Link
                key={`${listing.provider}:${listing.symbol}`}
                href={`/earn/stocks/${encodeURIComponent(ticker(listing.symbol))}?provider=${encodeURIComponent(listing.provider)}`}
                className="flex items-center justify-between gap-3 border-b border-black/10 px-3 py-1.5 last:border-b-0 transition hover:bg-primary-99 dark:border-white/10 dark:hover:bg-white/5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="relative grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border border-black/10 bg-white text-[8px] font-bold text-primary-70 dark:border-white/10 dark:bg-secondary-60">
                    {ticker(listing.symbol).slice(0, 2)}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetLogo(listing)}
                      alt=""
                      className="absolute inset-0 h-full w-full bg-white object-contain p-0.5"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-cryptoNight dark:text-white min-[1024px]:text-[11px] lg:text-sm">
                    {ticker(listing.symbol)}
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
          {isLoading ? "Loading live market movement…" : "Live market data is unavailable."}
        </p>
      )}
    </section>
  );
}
