"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import {
  ArrowRight,
  Building2,
  ChartLine,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getActiveChainKey, getActiveChains } from "@/lib/chains";
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
  formatUsd,
  getMaxUsableBalance,
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
type StockProviderOption = { id: string; label: string; count: number };

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
    label: "Stocks",
  },
  {
    id: "rwa",
    label: "RWA",
  },
];

function getSupportedYieldChainKey(chain: string): string | null {
  return getActiveChainKey(chain);
}

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

export function getListingChange(
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

export function getUnderlyingTicker(symbol: string, provider?: string): string {
  const raw = symbol.trim();
  const withoutProviderSuffix = /[bc]$/i.test(raw) ? raw.slice(0, -1) : raw;
  const withoutXStockSuffix =
    provider?.toLowerCase().includes("xstock") &&
    /x$/i.test(withoutProviderSuffix)
      ? withoutProviderSuffix.slice(0, -1)
      : withoutProviderSuffix;

  return (
    withoutXStockSuffix.startsWith("b")
      ? withoutXStockSuffix.slice(1)
      : withoutXStockSuffix
  ).toUpperCase();
}

export function getStockLogoUrl(symbol: string, logoUrl?: string): string {
  // Prefer a known company mark to an inconsistent provider-supplied image.
  if (STOCK_DOMAINS[getUnderlyingTicker(symbol)]) {
    return getStockLogoFallbackUrl(symbol);
  }

  if (logoUrl) return logoUrl;

  return `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(getUnderlyingTicker(symbol))}.png`;
}

function StockProviderFilterMenu({
  providers,
  value,
  onValueChange,
  iconOnly = false,
}: {
  providers: StockProviderOption[];
  value: string;
  onValueChange: (value: string) => void;
  iconOnly?: boolean;
}) {
  const selectedProvider = providers.find((provider) => provider.id === value);
  const label = selectedProvider ? selectedProvider.label : "All providers";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Filter stocks by provider"
          className={cn(
            "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-gray-80 bg-white/70 px-2 text-xs font-semibold text-gray-30 transition hover:border-primary-60 hover:text-primary-60 dark:border-white/10 dark:bg-secondary-50/65 dark:text-gray-40 dark:hover:border-primary-60 dark:hover:text-primary-60",
            iconOnly && "w-8 px-0",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {!iconOnly ? <span className="max-w-28 truncate">{label}</span> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-52 rounded-xl border border-gray-80 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-secondary-50"
      >
        <DropdownMenuLabel className="text-xs text-gray-30 dark:text-gray-40">
          Filter by provider
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="dark:bg-white/10" />
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          <DropdownMenuRadioItem
            value="all"
            className="cursor-pointer rounded-lg border border-transparent py-2.5 pr-3 pl-10 text-sm font-semibold text-gray-30 hover:border-primary-60/40 hover:bg-primary-70/5 hover:text-primary-60 focus:border-primary-60/40 focus:bg-primary-70/5 focus:text-primary-60 data-[state=checked]:border-primary-60 data-[state=checked]:bg-primary-70/5 data-[state=checked]:text-primary-60 dark:text-gray-40 dark:hover:bg-primary-70/10 dark:hover:text-primary-60 dark:focus:bg-primary-70/10 dark:focus:text-primary-60 dark:data-[state=checked]:border-primary-60 dark:data-[state=checked]:bg-primary-70/10 dark:data-[state=checked]:text-primary-60 [&>span:first-child]:left-3"
          >
            All providers
          </DropdownMenuRadioItem>
          {providers.map((provider) => (
            <DropdownMenuRadioItem
              key={provider.id}
              value={provider.id}
              className="group cursor-pointer rounded-lg border border-transparent py-2.5 pr-3 pl-10 text-sm font-semibold text-gray-30 hover:border-primary-60/40 hover:bg-primary-70/5 hover:text-primary-60 focus:border-primary-60/40 focus:bg-primary-70/5 focus:text-primary-60 data-[state=checked]:border-primary-60 data-[state=checked]:bg-primary-70/5 data-[state=checked]:text-primary-60 dark:text-gray-40 dark:hover:bg-primary-70/10 dark:hover:text-primary-60 dark:focus:bg-primary-70/10 dark:focus:text-primary-60 dark:data-[state=checked]:border-primary-60 dark:data-[state=checked]:bg-primary-70/10 dark:data-[state=checked]:text-primary-60 [&>span:first-child]:left-3"
            >
              <span className="flex w-full items-center justify-between gap-6">
                {provider.label}
                <span className="text-xs text-gray-30 group-data-[state=checked]:text-primary-60 dark:text-gray-40 dark:group-data-[state=checked]:text-primary-60">
                  {provider.count}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getDisplayStockName(name: string): string {
  return name.replace(/\s+[bc]stock$/i, "").trim();
}

function getStockLogoFallbackUrl(symbol: string): string {
  const ticker = getUnderlyingTicker(symbol);
  const domain = STOCK_DOMAINS[ticker];

  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(ticker)}&backgroundType=gradientLinear`;
}

export function StockLogo({
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

const yieldRiskStyles: Record<RiskLevel, string> = {
  [RiskLevel.CONSERVATIVE]:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  [RiskLevel.MODERATE]:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  [RiskLevel.AGGRESSIVE]:
    "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function PortfolioSummarySkeleton({ metricCount }: { metricCount: 2 | 3 }) {
  return (
    <section
      aria-label="Loading portfolio summary"
      className="relative mb-6 overflow-hidden rounded-xl border border-white/70 bg-white/70 p-5 shadow-sm shadow-primary-90/30 backdrop-blur-xl md:mb-8 md:rounded-2xl md:p-7 dark:border-white/10 dark:bg-secondary-50/40 dark:shadow-none"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(138,22,133,0.18),transparent_48%),linear-gradient(115deg,rgba(255,255,255,0.7),rgba(246,232,242,0.42)_48%,rgba(255,255,255,0.16))] dark:bg-[radial-gradient(circle_at_16%_0%,rgba(193,92,165,0.42),transparent_52%),radial-gradient(circle_at_90%_20%,rgba(255,255,255,0.1),transparent_40%)]" />
      <div className="relative animate-pulse">
        <div className="h-2.5 w-32 rounded bg-gray-90 dark:bg-white/10" />
        <div className="mt-3 h-9 w-36 rounded bg-gray-90 dark:bg-white/10" />
        <div
          className={cn(
            "mt-7 grid border-t border-gray-80 pt-4 md:mt-8 md:pt-5",
            metricCount === 3 ? "grid-cols-3 max-w-2xl" : "grid-cols-2 max-w-xl",
          )}
        >
          {Array.from({ length: metricCount }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "min-w-0 px-2 first:pl-0 last:pr-0 md:px-6 md:first:pl-0 md:last:pr-0",
                index > 0 && "border-l border-gray-80 dark:border-white/10",
              )}
            >
              <div className="h-2.5 w-16 rounded bg-gray-90 dark:bg-white/10" />
              <div className="mt-2 h-4 w-20 rounded bg-gray-90 dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function YieldOpportunitySkeleton() {
  const rows = Array.from({ length: 6 });

  return (
    <div aria-label="Loading yield opportunities">
      <div className="md:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-1 pb-2 text-[11px] font-semibold text-gray-30 dark:text-gray-40">
          <span>Protocol</span>
          <span>Est. APY</span>
        </div>
        <div className="space-y-1">
          {rows.map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-1 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-gray-90 dark:bg-white/10" />
                <div className="space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
                  <div className="h-2.5 w-16 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <div className="ml-auto h-3 w-12 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
                <div className="ml-auto h-2.5 w-14 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-gray-80 dark:border-white/10 md:block">
        <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_5rem] gap-4 border-b border-gray-80 px-5 py-3 text-[11px] font-semibold text-gray-30 dark:border-white/10 dark:text-gray-40">
          <span>Protocol</span><span className="text-right">Est. APY</span><span>Risk</span><span>Network</span><span />
        </div>
        {rows.map((_, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_5rem] items-center gap-4 border-b border-gray-80 px-5 py-3.5 last:border-b-0 dark:border-white/10">
            <div className="flex items-center gap-3"><div className="h-9 w-9 animate-pulse rounded-full bg-gray-90 dark:bg-white/10" /><div className="space-y-2"><div className="h-3 w-20 animate-pulse rounded bg-gray-90 dark:bg-white/10" /><div className="h-2.5 w-24 animate-pulse rounded bg-gray-90 dark:bg-white/10" /></div></div>
            <div className="ml-auto h-3 w-12 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-90 dark:bg-white/10" />
            <div className="h-5 w-14 animate-pulse rounded-full bg-gray-90 dark:bg-white/10" />
            <div className="h-8 w-16 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StockListSkeleton({ category }: { category: "stocks" | "rwa" }) {
  const rows = Array.from({ length: 8 });

  return (
    <div aria-label={`Loading ${category === "rwa" ? "RWA" : "stock"} opportunities`}>
      <div className="md:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-1 pb-2 text-[11px] font-semibold text-gray-30 dark:text-gray-40">
          <span>Name</span>
          <span>Price | 24h change</span>
        </div>
        <div className="space-y-1">
          {rows.map((_, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-1 py-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-gray-90 dark:bg-white/10" />
                <div className="space-y-2">
                  <div className="h-3 w-14 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
                  <div className="h-2.5 w-24 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <div className="ml-auto h-3 w-14 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
                <div className="ml-auto h-2.5 w-10 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-gray-80 dark:border-white/10 md:block">
        <div className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_5rem] gap-4 border-b border-gray-80 px-5 py-3 text-[11px] font-semibold text-gray-30 dark:border-white/10 dark:text-gray-40">
          <span>Name</span><span className="text-right">Price</span><span className="text-right">24h change</span><span>Last 24h</span><span>Provider</span><span />
        </div>
        {rows.map((_, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr_5rem] items-center gap-4 border-b border-gray-80 px-5 py-3.5 last:border-b-0 dark:border-white/10">
            <div className="flex items-center gap-3"><div className="h-9 w-9 animate-pulse rounded-full bg-gray-90 dark:bg-white/10" /><div className="space-y-2"><div className="h-3 w-16 animate-pulse rounded bg-gray-90 dark:bg-white/10" /><div className="h-2.5 w-28 animate-pulse rounded bg-gray-90 dark:bg-white/10" /></div></div>
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
            <div className="ml-auto h-3 w-12 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
            <div className="h-7 w-24 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-90 dark:bg-white/10" />
            <div className="h-8 w-14 animate-pulse rounded bg-gray-90 dark:bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

const rwaPools = [
  {
    name: "US Treasury Yield Pool",
    symbol: "USDY / TBILL",
    network: "Base",
    risk: "Conservative",
    apy: "~5.15%",
    protection: "Regulated custody",
    yieldType: "Daily yield",
  },
  {
    name: "Prime Real Estate Trust",
    symbol: "RE-YIELD",
    network: "Base",
    risk: "Moderate",
    apy: "~7.85%",
    protection: "Rental income",
    yieldType: "Asset-backed",
  },
  {
    name: "Institutional Credit Pool",
    symbol: "CREDIT-POOL",
    network: "Ethereum",
    risk: "Moderate",
    apy: "~8.40%",
    protection: "Over-collateralized",
    yieldType: "Fixed term",
  },
] as const;

function RwaComingSoon() {
  return (
    <div className="w-full">
      <section className="relative mb-7 overflow-hidden rounded-2xl border border-white/10 bg-secondary-50/65 p-5 shadow-sm shadow-primary-90/20 md:mb-9 md:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(193,92,165,0.34),transparent_48%),radial-gradient(circle_at_90%_18%,rgba(255,255,255,0.08),transparent_38%)]" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-gray-40 md:text-xs">
            Real-world asset yields
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
            Coming soon
          </h1>
          <div className="mt-6 grid max-w-2xl grid-cols-2 border-t border-white/10 pt-4 md:mt-8 md:pt-5">
            <div className="pr-4 md:pr-8">
              <p className="text-[10px] text-gray-40 md:text-xs">Asset protection</p>
              <p className="mt-1 text-sm font-bold text-primary-30 md:text-base">
                Audited & regulated
              </p>
            </div>
            <div className="border-l border-white/10 pl-4 md:pl-8">
              <p className="text-[10px] text-gray-40 md:text-xs">Target APY range</p>
              <p className="mt-1 text-sm font-bold text-emerald-400 md:text-base">
                4.5% – 8.4%
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-cryptoNight dark:text-white">
              Curated asset pools
            </h2>
            <p className="mt-1 text-xs text-gray-30 dark:text-gray-40">
              Coming soon
            </p>
          </div>
          <span className="rounded-full bg-primary-90/10 px-2.5 py-1 text-[10px] font-bold text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">
            RWA
          </span>
        </div>

        <div className="space-y-2 md:hidden">
          {rwaPools.map((pool) => (
            <article
              key={pool.name}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-gray-80 bg-white/70 px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-secondary-50/65 dark:shadow-none"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-90/10 text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-cryptoNight dark:text-white">
                    {pool.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-30 dark:text-gray-40">
                    {pool.symbol} · {pool.network}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {pool.apy}
                </p>
                <span className="mt-1 inline-flex rounded-md bg-primary-90 px-2 py-0.5 text-[10px] font-bold text-white opacity-70 dark:bg-primary-70">
                  Soon
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-gray-80 bg-white/70 dark:border-white/10 dark:bg-secondary-50/65 md:block">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="border-b border-gray-80 bg-gray-95 text-[11px] text-gray-30 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-40">
              <tr>
                <th className="px-5 py-3 font-semibold">Asset pool</th>
                <th className="px-4 py-3 text-right font-semibold">Est. APY</th>
                <th className="px-4 py-3 font-semibold">Protection</th>
                <th className="px-4 py-3 font-semibold">Yield type</th>
                <th className="px-5 py-3" aria-label="Action" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-80 dark:divide-white/10">
              {rwaPools.map((pool) => (
                <tr key={pool.name} className="transition-colors hover:bg-primary-90/[0.035] dark:hover:bg-white/[0.025]">
                  <td className="px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-90/10 text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-cryptoNight dark:text-white">{pool.name}</p>
                        <p className="mt-0.5 text-xs text-gray-30 dark:text-gray-40">{pool.symbol} · {pool.network}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-normal tabular-nums text-emerald-600 dark:text-emerald-400">{pool.apy}</td>
                  <td className="px-4 py-3.5 text-sm text-cryptoNight dark:text-white">{pool.protection}</td>
                  <td className="px-4 py-3.5"><span className="inline-flex rounded-full bg-primary-90/10 px-2 py-1 text-[10px] font-bold text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">{pool.yieldType}</span></td>
                  <td className="px-5 py-3.5 text-right"><Button type="button" variant="outline" size="sm" disabled className="h-9 px-4">Coming soon</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold text-cryptoNight dark:text-white">Compliance & protection</h2>
        <div className="rounded-2xl border border-gray-80 bg-white/70 p-4 dark:border-white/10 dark:bg-secondary-50/65 md:grid md:grid-cols-3 md:gap-4 md:p-5">
          {[
            ["Regulated institutional custody", "Direct backing held with tier-1 regulated bank trusts."],
            ["Real-time proof of reserves", "On-chain transparency and verifiable collateral."],
            ["Bankruptcy-remote SPVs", "Assets legally separated and insulated from credit risk."],
          ].map(([title, description], index) => (
            <div key={title} className={cn("py-3 first:pt-0 last:pb-0 md:py-0", index > 0 && "border-t border-gray-80 md:border-l md:border-t-0 dark:border-white/10")}>
              <p className="text-sm font-bold text-cryptoNight dark:text-white">{title}</p>
              <p className="mt-1 text-xs leading-5 text-gray-30 dark:text-gray-40">{description}</p>
            </div>
          ))}
        </div>
      </section>
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
  const mobileYieldSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopYieldSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileStockSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopStockSearchInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<EarnCategory>("yield");
  const [stockSort, setStockSort] = useState<{
    key: StockSortKey;
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });
  const [stockPage, setStockPage] = useState(1);
  const [isStockSearchOpen, setIsStockSearchOpen] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockProviderFilter, setStockProviderFilter] = useState("all");
  const [isYieldSearchOpen, setIsYieldSearchOpen] = useState(false);
  const [yieldSearchQuery, setYieldSearchQuery] = useState("");
  const [yieldChainFilter, setYieldChainFilter] = useState("all");
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
    enabled: activeTab === "stocks",
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const {
    data: stockPortfolio,
    isLoading: stockPortfolioLoading,
    error: stockPortfolioError,
    refetch: refetchStockPortfolio,
  } = useQuery({
    queryKey: ["stock-portfolio"],
    queryFn: async () => (await stocksService.getPortfolio()).data,
    enabled: activeTab === "stocks",
    staleTime: 30_000,
  });

  const {
    data: marketIndices = [],
    error: marketIndicesError,
    refetch: refetchMarketIndices,
  } = useQuery({
    queryKey: ["market-indices"],
    queryFn: async () => (await stocksService.getIndices()).data,
    enabled: activeTab === "stocks",
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
    // `provider` is also used by the buy deep link. Do not turn an active
    // purchase link into a listing filter while it is being handled below.
    if (searchParams.get("stock")) return;
    setStockProviderFilter(searchParams.get("provider")?.toLowerCase() || "all");
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
  const yieldChains = useMemo(
    () =>
      Object.entries(getActiveChains()).map(([id, chain]) => ({
        id,
        label: chain.name.replace(/\s+(network|smart chain)$/i, ""),
      })),
    [],
  );
  const filteredOpportunities = useMemo(() => {
    const query = yieldSearchQuery.trim().toLowerCase();
    const matchingChain = opportunities.filter((opportunity) => {
      const supportedChain = getSupportedYieldChainKey(opportunity.chain);
      return (
        supportedChain !== null &&
        (yieldChainFilter === "all" || supportedChain === yieldChainFilter)
      );
    });
    if (!query) return matchingChain;

    return matchingChain.filter((opportunity) =>
      [
        opportunity.symbol,
        opportunity.chain,
        opportunity.protocol,
        getProtocolName(opportunity.protocol),
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [opportunities, yieldChainFilter, yieldSearchQuery]);
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
        };
      }),
    [activePositions, opportunities],
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
  const stockProviders = useMemo(() => {
    const providers = new Map<string, { id: string; label: string; count: number }>();

    categoryStocks.forEach((stock) => {
      const id = stock.provider.trim().toLowerCase();
      const existing = providers.get(id);
      providers.set(id, {
        id,
        label: getProtocolName(stock.provider),
        count: (existing?.count || 0) + 1,
      });
    });

    return [...providers.values()].sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [categoryStocks]);
  const unifiedStocks = useMemo(() => {
    const providerListings = new Map<string, StockListing>();
    categoryStocks
      .filter(
        (stock) =>
          stockProviderFilter === "all" ||
          stock.provider.toLowerCase() === stockProviderFilter,
      )
      .forEach((stock) => {
      // The same ticker can be offered by several providers. Keep each offer
      // visible, while ignoring an accidental repeat from the same provider.
      const key = `${stock.provider.toLowerCase()}:${stock.symbol.toLowerCase()}`;
      if (!providerListings.has(key)) providerListings.set(key, stock);
      });

    return [...providerListings.values()];
  }, [categoryStocks, stockProviderFilter]);
  const searchedStocks = useMemo(() => {
    const query = stockSearchQuery.trim().toLowerCase();
    if (!query) return unifiedStocks;

    return unifiedStocks.filter((stock) =>
      [
        getUnderlyingTicker(stock.symbol),
        getDisplayStockName(stock.name),
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [stockSearchQuery, unifiedStocks]);
  const sortedStocks = useMemo(() => {
    const multiplier = stockSort.direction === "asc" ? 1 : -1;
    return [...searchedStocks].sort((left, right) => {
      if (stockSort.key === "name") {
        return multiplier * left.symbol.localeCompare(right.symbol);
      }

      const leftValue =
        stockSort.key === "price"
          ? Number(left.price) || 0
          : getListingChange(left) || 0;
      const rightValue =
        stockSort.key === "price"
          ? Number(right.price) || 0
          : getListingChange(right) || 0;
      return multiplier * (leftValue - rightValue);
    });
  }, [searchedStocks, stockSort]);
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
  const chartSymbols = useMemo(
    () =>
      activeTab !== "yield"
        ? desktopStocks.map((stock) =>
            getUnderlyingTicker(stock.symbol, stock.provider),
          )
        : [],
    [activeTab, desktopStocks],
  );
  const chartQuery = useQuery({
    queryKey: ["stock-charts", chartSymbols],
    queryFn: () => getStockCharts(chartSymbols),
    enabled: chartSymbols.length > 0,
    staleTime: 60_000,
    refetchInterval: isConnected ? 60_000 : false,
  });
  const stockCharts = chartQuery.data?.charts || {};
  const stockChartChanges = chartQuery.data?.changes || {};
  useEffect(() => {
    setStockPage(1);
  }, [activeTab, stockSearchQuery, stockSort]);
  useEffect(() => {
    if (!isStockSearchOpen) return;

    const input = window.matchMedia("(min-width: 768px)").matches
      ? desktopStockSearchInputRef.current
      : mobileStockSearchInputRef.current;
    input?.focus();
  }, [isStockSearchOpen]);
  useEffect(() => {
    if (!isYieldSearchOpen) return;

    const input = window.matchMedia("(min-width: 768px)").matches
      ? desktopYieldSearchInputRef.current
      : mobileYieldSearchInputRef.current;
    input?.focus();
  }, [isYieldSearchOpen]);
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
  const openStockDetails = (stock: StockListing) => {
    const provider = encodeURIComponent(stock.provider);
    router.push(
      `/earn/stocks/${encodeURIComponent(getUnderlyingTicker(stock.symbol, stock.provider))}?provider=${provider}`,
    );
  };
  const selectStockProvider = (provider: string) => {
    setStockProviderFilter(provider);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("stock");
    if (provider === "all") {
      nextParams.delete("provider");
    } else {
      nextParams.set("provider", provider);
    }
    nextParams.set("category", activeTab);
    router.replace(`/earn?${nextParams.toString()}`, { scroll: false });
  };
  const marketEtfs = useMemo(() => {
    if (marketIndices.length) {
      return marketIndices;
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
  const isLoading =
    activeTab === "yield"
      ? isYieldLoading
      : activeTab === "stocks"
        ? stocksLoading
        : false;
  const error =
    activeTab === "yield"
      ? opportunitiesError || positionsError
      : activeTab === "stocks"
        ? stocksError || stockPortfolioError || marketIndicesError
        : null;
  const isSecureSessionError =
    error instanceof Error &&
    error.message === "Secure session missing. Please log in again.";

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

  const selectCategory = (category: EarnCategory) => {
    setActiveTab(category);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("category", category);
    router.replace(`/earn?${nextParams.toString()}`, { scroll: false });
  };

  return (
    <main className="container mx-auto min-h-[100dvh] w-full max-w-7xl px-4 pb-32 pt-4 md:px-6 md:pb-12 md:pt-28">
      <div className="mb-5 flex items-center gap-2 md:mb-6">
        <section
          aria-label="Earn categories"
          className="grid w-full grid-cols-3 items-center gap-1 rounded-xl border border-gray-80 bg-white/60 p-1 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-secondary-50/40 md:inline-flex md:w-auto md:rounded-full"
        >
          {earnCategories.map((category) => {
            const isActive = activeTab === category.id;
            const CategoryIcon =
              category.id === "yield"
                ? TrendingUp
                : category.id === "stocks"
                  ? ChartLine
                  : Building2;

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  selectCategory(category.id);
                }}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-3 text-center transition md:rounded-full md:py-1.5 md:px-4",
                  isActive
                    ? "bg-primary-90 text-white shadow-sm dark:bg-primary-70"
                    : "text-gray-30 hover:bg-gray-90 dark:text-gray-40 dark:hover:bg-white/10",
                )}
              >
                <CategoryIcon className="h-4 w-4 shrink-0 md:hidden" aria-hidden="true" />
                <span className="block truncate text-xs font-bold min-[360px]:text-sm">
                  {category.label}
                </span>
              </button>
            );
          })}
        </section>

      </div>

      {error && !isSecureSessionError ? (
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
          {isYieldLoading ? (
            <PortfolioSummarySkeleton metricCount={2} />
          ) : (
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
              <div className="mt-8 grid max-w-xl grid-cols-2 border-t border-gray-80 pt-5 dark:border-white/10">
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
              </div>
            </div>
          </section>
            </>
          )}

        </>
      ) : null}

      <section className="w-full">
        {activeTab === "yield" ? (
          <>
            <div className="mb-4 min-h-8">
              {isYieldSearchOpen ? (
                <>
                  <div className="flex w-full items-center gap-3 border-b border-gray-80 pb-2 dark:border-white/10 md:hidden">
                    <Search
                      className="h-4 w-4 shrink-0 text-gray-30 dark:text-gray-40"
                      aria-hidden="true"
                    />
                    <input
                      ref={mobileYieldSearchInputRef}
                      value={yieldSearchQuery}
                      onChange={(event) => setYieldSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setIsYieldSearchOpen(false);
                          setYieldSearchQuery("");
                        }
                      }}
                      placeholder="Search yield"
                      aria-label="Search yield opportunities"
                      className="min-w-0 flex-1 bg-transparent text-sm text-cryptoNight outline-none caret-primary-90 placeholder:text-gray-30 dark:text-white dark:caret-primary-30 dark:placeholder:text-gray-40"
                    />
                    {yieldSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => setYieldSearchQuery("")}
                        aria-label="Clear yield search"
                        className="text-gray-30 transition hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setIsYieldSearchOpen(false);
                        setYieldSearchQuery("");
                      }}
                      className="shrink-0 text-sm text-gray-30 transition hover:text-primary-90 dark:text-gray-40 dark:hover:text-primary-30"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="hidden items-center gap-4 pb-2 md:flex">
                    <h2 className="text-base font-bold text-cryptoNight dark:text-white">
                      Yield opportunities
                    </h2>
                    <div className="ml-auto flex w-full max-w-sm items-center gap-3">
                      <Search
                        className="h-4 w-4 shrink-0 text-gray-30 dark:text-gray-40"
                        aria-hidden="true"
                      />
                      <input
                        ref={desktopYieldSearchInputRef}
                        value={yieldSearchQuery}
                        onChange={(event) => setYieldSearchQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setIsYieldSearchOpen(false);
                            setYieldSearchQuery("");
                          }
                        }}
                        placeholder="Search"
                        aria-label="Search yield opportunities"
                        className="min-w-0 flex-1 bg-transparent text-sm text-cryptoNight outline-none caret-primary-90 placeholder:text-gray-30 dark:text-white dark:caret-primary-30 dark:placeholder:text-gray-40"
                      />
                      {yieldSearchQuery ? (
                        <button
                          type="button"
                          onClick={() => setYieldSearchQuery("")}
                          aria-label="Clear yield search"
                          className="text-gray-30 transition hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setIsYieldSearchOpen(false);
                          setYieldSearchQuery("");
                        }}
                        className="shrink-0 text-sm text-gray-30 transition hover:text-primary-90 dark:text-gray-40 dark:hover:text-primary-30"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-cryptoNight dark:text-white">
                    Yield opportunities
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsYieldSearchOpen(true)}
                    aria-label="Search yield opportunities"
                    aria-expanded={isYieldSearchOpen}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-30 transition hover:bg-primary-90/[0.08] hover:text-primary-90 dark:text-gray-40 dark:hover:bg-white/[0.08] dark:hover:text-primary-30"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="mb-3 flex w-full items-center gap-1 md:hidden">
              {[
                { id: "all", label: "All chains" },
                ...yieldChains,
              ].map((chain) => {
                const isSelected = yieldChainFilter === chain.id;
                return (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => setYieldChainFilter(chain.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-sm px-0.5 py-1 text-center text-[8px] font-semibold capitalize leading-none transition",
                      isSelected
                        ? "bg-primary-90 text-white dark:bg-primary-70"
                        : "bg-secondary-60 text-gray-30 dark:bg-white/5 dark:text-gray-40",
                    )}
                  >
                    {chain.label}
                  </button>
                );
              })}
            </div>
            {opportunitiesLoading ? (
              <YieldOpportunitySkeleton />
            ) : filteredOpportunities.length ? (
              <>
                <div className="md:hidden">
                  <div className="space-y-2">
                    {filteredOpportunities.map((opportunity) => {
                      const available = getMaxUsableBalance(
                        profile,
                        opportunity.symbol,
                      );
                      return (
                        <button
                          key={opportunity.id}
                          type="button"
                          disabled={available <= 0}
                          onClick={() =>
                            setSelectedAction({ action: "supply", opportunity })
                          }
                          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-gray-80 bg-white/70 px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary-90/40 hover:bg-primary-90/[0.04] active:bg-primary-90/[0.08] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-secondary-50/65 dark:shadow-none dark:hover:border-primary-70/50 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.07]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <AssetNetworkIcon
                              symbol={opportunity.symbol}
                              network={opportunity.chain}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-cryptoNight dark:text-white">
                                {getProtocolName(opportunity.protocol)}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-gray-30 dark:text-gray-40">
                                {opportunity.symbol} · {opportunity.chain}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {formatApy(opportunity.apy)}
                            </p>
                            <span className="mt-1 inline-flex rounded-md bg-primary-90 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-primary-70">
                              {available > 0 ? "Deposit" : "Unavailable"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="hidden overflow-x-auto rounded-2xl border border-gray-80 bg-white/70 dark:border-white/10 dark:bg-secondary-50/65 md:block">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead className="border-b border-gray-80 bg-gray-95 text-[11px] text-gray-30 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-40">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Protocol</th>
                        <th className="px-4 py-3 text-right font-semibold">Est. APY</th>
                        <th className="px-4 py-3 font-semibold">Risk</th>
                        <th className="px-4 py-3 font-semibold">Network</th>
                        <th className="px-5 py-3" aria-label="Action" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-80 dark:divide-white/10">
                {filteredOpportunities.map((opportunity) => {
                  const available = getMaxUsableBalance(
                    profile,
                    opportunity.symbol,
                  );
                  const risk = Object.values(RiskLevel).includes(
                    opportunity.riskLevel,
                  )
                    ? opportunity.riskLevel
                    : null;
                  return (
                    <tr
                      key={opportunity.id}
                      className="transition-colors hover:bg-primary-90/[0.035] dark:hover:bg-white/[0.025]"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <AssetNetworkIcon
                            symbol={opportunity.symbol}
                            network={opportunity.chain}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-cryptoNight dark:text-white">
                              {getProtocolName(opportunity.protocol)}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-30 dark:text-gray-40">
                              {opportunity.symbol} · {opportunity.chain}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-normal tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatApy(opportunity.apy)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {risk ? (
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-1 text-[10px] font-bold capitalize",
                              yieldRiskStyles[risk],
                            )}
                          >
                            {risk.toLowerCase()}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-30 dark:text-gray-40">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-full bg-primary-90/10 px-2 py-1 text-[10px] font-bold text-primary-90 dark:bg-primary-70/20 dark:text-primary-30">
                          {opportunity.chain}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
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
                      </td>
                    </tr>
                  );
                })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex min-h-36 items-center justify-center rounded-lg border border-gray-80 bg-white/65 px-4 text-center dark:border-white/10 dark:bg-secondary-50/55">
                <div>
                  <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                    {yieldSearchQuery
                      ? "No yield opportunities match your search."
                      : "No opportunities available"}
                  </p>
                  <p className="mt-1 text-xs text-gray-30 dark:text-gray-40">
                    New yield options will appear here when they are enabled.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : activeTab === "rwa" ? (
          <RwaComingSoon />
        ) : (
          <div>
            {stockPortfolioLoading ? (
              <PortfolioSummarySkeleton metricCount={2} />
            ) : (
              <>
            <MobileBalanceSummary
              label="Stock portfolio value"
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
                    Stock portfolio value
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
              </>
            )}

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
                      className="flex min-h-[100px] w-[39%] min-w-[142px] shrink-0 snap-start flex-col rounded-xl border border-gray-80 bg-white/60 p-2.5 dark:border-white/10 dark:bg-secondary-50/50 md:min-h-[116px] md:w-44 md:min-w-44 md:p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cryptoNight dark:text-white">
                          {idx.symbol}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 flex-1 text-[9px] leading-[0.875rem] text-gray-30 dark:text-gray-40 md:mt-1 md:text-[11px] md:leading-4">
                        {idx.name}
                      </p>
                      <div className="mt-2 flex flex-col items-start gap-0.5 md:mt-3">
                        <p className="truncate text-xs font-bold text-cryptoNight dark:text-white min-[360px]:text-sm md:text-base">
                          ${idx.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4 min-h-8">
              {isStockSearchOpen ? (
                <>
                  <div className="flex w-full items-center gap-3 border-b border-gray-80 pb-2 dark:border-white/10 md:hidden">
                    <Search
                      className="h-4 w-4 shrink-0 text-gray-30 dark:text-gray-40"
                      aria-hidden="true"
                    />
                    <input
                      ref={mobileStockSearchInputRef}
                      value={stockSearchQuery}
                      onChange={(event) => setStockSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setIsStockSearchOpen(false);
                          setStockSearchQuery("");
                        }
                      }}
                      placeholder="Search stocks"
                      aria-label="Search stock opportunities"
                      className="min-w-0 flex-1 bg-transparent text-sm text-cryptoNight outline-none caret-primary-90 placeholder:text-gray-30 dark:text-white dark:caret-primary-30 dark:placeholder:text-gray-40"
                    />
                    {stockSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => setStockSearchQuery("")}
                        aria-label="Clear stock search"
                        className="text-gray-30 transition hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setIsStockSearchOpen(false);
                        setStockSearchQuery("");
                      }}
                      className="shrink-0 text-sm text-gray-30 transition hover:text-primary-90 dark:text-gray-40 dark:hover:text-primary-30"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="hidden items-center gap-4 pb-2 md:flex">
                    <h2 className="text-base font-bold text-cryptoNight dark:text-white">
                      Stock opportunities
                    </h2>
                    <div className="ml-auto flex w-full max-w-sm items-center gap-3">
                      <Search
                        className="h-4 w-4 shrink-0 text-gray-30 dark:text-gray-40"
                        aria-hidden="true"
                      />
                      <input
                        ref={desktopStockSearchInputRef}
                        value={stockSearchQuery}
                        onChange={(event) => setStockSearchQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setIsStockSearchOpen(false);
                            setStockSearchQuery("");
                          }
                        }}
                        placeholder="Search"
                        aria-label="Search stock opportunities"
                        className="min-w-0 flex-1 bg-transparent text-sm text-cryptoNight outline-none caret-primary-90 placeholder:text-gray-30 dark:text-white dark:caret-primary-30 dark:placeholder:text-gray-40"
                      />
                      {stockSearchQuery ? (
                        <button
                          type="button"
                          onClick={() => setStockSearchQuery("")}
                          aria-label="Clear stock search"
                          className="text-gray-30 transition hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setIsStockSearchOpen(false);
                          setStockSearchQuery("");
                        }}
                        className="shrink-0 text-sm text-gray-30 transition hover:text-primary-90 dark:text-gray-40 dark:hover:text-primary-30"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-cryptoNight dark:text-white">
                    Stock opportunities
                  </h2>
                  <div className="flex items-center gap-1">
                    {stockProviders.length > 1 ? (
                      <span className="md:hidden">
                        <StockProviderFilterMenu
                          providers={stockProviders}
                          value={stockProviderFilter}
                          onValueChange={selectStockProvider}
                          iconOnly
                        />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsStockSearchOpen(true)}
                      aria-label="Search stock opportunities"
                      aria-expanded={isStockSearchOpen}
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-30 transition hover:bg-primary-90/[0.08] hover:text-primary-60 dark:text-gray-40 dark:hover:bg-white/[0.08] dark:hover:text-primary-60"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    {stockProviders.length > 1 ? (
                      <span className="hidden md:inline-flex">
                        <StockProviderFilterMenu
                          providers={stockProviders}
                          value={stockProviderFilter}
                          onValueChange={selectStockProvider}
                        />
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {stocksLoading ? (
              <StockListSkeleton category="stocks" />
            ) : sortedStocks.length ? (
              <>
                <div className="md:hidden">
                  <div className="space-y-2">
                  {desktopStocks.map((stock) => (
                    <button
                      key={`${stock.provider}_${stock.symbol}`}
                      type="button"
                      onClick={() => openStockDetails(stock)}
                      aria-label={`View ${getUnderlyingTicker(stock.symbol)}`}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-gray-80 bg-white/70 px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary-90/40 hover:bg-primary-90/[0.04] active:bg-primary-90/[0.08] dark:border-white/10 dark:bg-secondary-50/65 dark:shadow-none dark:hover:border-primary-70/50 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.07]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <StockLogo
                          symbol={stock.symbol}
                          src={getStockLogoUrl(stock.symbol, stock.logoUrl)}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-cryptoNight dark:text-white">
                            {getUnderlyingTicker(stock.symbol)}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-gray-30 dark:text-gray-40">
                            {getDisplayStockName(stock.name)}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-normal tabular-nums text-cryptoNight dark:text-white">
                          {formatUsd(Number(stock.price) || 0)}
                        </p>
                        {(() => {
                          const change = getListingChange(
                            stock,
                            stockChartChanges[
                              getUnderlyingTicker(stock.symbol, stock.provider)
                            ],
                          );
                          return change === undefined ? null : (
                            <p
                              className={cn(
                                "mt-0.5 text-xs font-normal tabular-nums",
                                change >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {change >= 0 ? "+" : ""}
                              {change.toFixed(2)}%
                            </p>
                          );
                        })()}
                      </div>
                    </button>
                  ))}
                  </div>
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
                          stockChartChanges[
                            getUnderlyingTicker(stock.symbol, stock.provider)
                          ],
                        );
                        return (
                          <tr
                            key={`${stock.provider}_${stock.symbol}`}
                            onClick={() => openStockDetails(stock)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openStockDetails(stock);
                              }
                            }}
                            tabIndex={0}
                            role="link"
                            aria-label={`View ${getUnderlyingTicker(stock.symbol)}`}
                            className="cursor-pointer transition-colors hover:bg-primary-90/[0.035] dark:hover:bg-white/[0.025]"
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
                                values={
                                  stockCharts[
                                    getUnderlyingTicker(stock.symbol, stock.provider)
                                  ]
                                }
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
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openStockDetails(stock);
                                }}
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
                    className="mt-4 flex items-center justify-center gap-2"
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
                  {stockSearchQuery
                    ? "No stocks match your search."
                    : "No stocks are available yet."}
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
