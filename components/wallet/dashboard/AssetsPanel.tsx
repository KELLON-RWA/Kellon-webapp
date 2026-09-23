"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Coins, MoreHorizontal, Search, X } from "lucide-react";
import AssetCard from "@/components/wallet/dashboard/AssetCard";
import FlowEmptyState from "@/components/wallet/shared/FlowEmptyState";
import { MAINNET_CHAINS } from "@/lib/chains";
import type {
  GroupedAssetSummary,
  InvestmentAssetSummary,
} from "@/lib/dashboard-types";
import { formatAssetAmount, formatCurrencyAmount } from "@/lib/dashboard-utils";
import {
  formatApy,
  formatTokenAmount,
  getPositionOpportunity,
  getPositionValue,
  getProtocolName,
} from "@/components/earn/earn-utils";
import type { YieldOpportunity, YieldPosition } from "@/types/db";

const NATIVE_ASSET_SYMBOLS = new Set(
  Object.values(MAINNET_CHAINS).map((chain) =>
    chain.nativeCurrency.symbol.toUpperCase(),
  ),
);

interface AssetsPanelProps {
  activeCurrency: string;
  displayCurrency: "LOCAL" | "USD";
  groupedAssets: GroupedAssetSummary[];
  investmentAssets?: InvestmentAssetSummary[];
  isInvestmentsLoading?: boolean;
  isAssetValueLoading: boolean;
  isBalanceVisible: boolean;
  yieldOpportunities?: YieldOpportunity[];
  yieldPositions?: YieldPosition[];
  isYieldPositionsLoading?: boolean;
}

export default function AssetsPanel({
  activeCurrency,
  displayCurrency,
  groupedAssets,
  investmentAssets = [],
  isInvestmentsLoading = false,
  isAssetValueLoading,
  isBalanceVisible,
  yieldOpportunities = [],
  yieldPositions = [],
  isYieldPositionsLoading = false,
}: AssetsPanelProps) {
  const [activeTable, setActiveTable] = useState<"assets" | "yield">("assets");
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const visibleAssets = groupedAssets.filter(
    (asset) => !NATIVE_ASSET_SYMBOLS.has(asset.symbol.trim().toUpperCase()),
  );
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchesSearch = (name: string, symbol: string) =>
    !normalizedSearch ||
    name.toLowerCase().includes(normalizedSearch) ||
    symbol.toLowerCase().includes(normalizedSearch);
  const filteredVisibleAssets = visibleAssets.filter((asset) =>
    matchesSearch(asset.name, asset.symbol),
  );
  const filteredInvestmentAssets = investmentAssets.filter((asset) =>
    matchesSearch(asset.name, asset.symbol),
  );
  const filteredYieldPositions = yieldPositions.filter((position) => {
    const opportunity = getPositionOpportunity(position, yieldOpportunities);
    return opportunity && matchesSearch(opportunity.protocol, opportunity.symbol);
  });
  const hasAssets = visibleAssets.length + investmentAssets.length > 0;
  const hasYieldPositions = yieldPositions.length > 0;
  const mobileVisibleAssets = visibleAssets.slice(0, 5);
  const mobileInvestmentAssets = investmentAssets.slice(
    0,
    Math.max(0, 5 - mobileVisibleAssets.length),
  );
  const mobileYieldPositions = filteredYieldPositions.slice(0, 10);

  useEffect(() => {
    if (!hasYieldPositions && activeTable === "yield") {
      setActiveTable("assets");
      setSearchQuery("");
    }
  }, [activeTable, hasYieldPositions]);

  return (
    <div className="order-3 flex w-full flex-col gap-4 min-[1024px]:col-span-full min-[1024px]:flex-1 min-[1024px]:rounded-xl min-[1024px]:border-0 min-[1024px]:!bg-white/80 min-[1024px]:gap-3 min-[1024px]:p-4 min-[1024px]:shadow-none min-[1024px]:dark:!bg-secondary-50">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          {([
            ["assets", "Assets"],
            ...(hasYieldPositions
              ? [["yield", `Yield (${yieldPositions.length})`] as const]
              : []),
          ] as const).map(([table, label]) => (
            <button
              key={table}
              type="button"
              onClick={() => {
                setActiveTable(table);
                setSearchQuery("");
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                activeTable === table
                  ? "bg-white text-cryptoNight shadow-sm dark:bg-secondary-60 dark:text-white"
                  : "text-gray-500 hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
              }`}
              aria-pressed={activeTable === table}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="hidden min-[1024px]:flex min-[1024px]:items-center min-[1024px]:gap-3">
          {isDesktopSearchOpen ? (
            <div className="ml-auto flex w-full max-w-sm items-center gap-3 pb-2">
              <Search className="h-4 w-4 shrink-0 text-gray-30 dark:text-gray-40" aria-hidden="true" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchQuery("");
                    setIsDesktopSearchOpen(false);
                  }
                }}
                placeholder="Search"
                aria-label={`Search ${activeTable}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-cryptoNight outline-none caret-primary-90 placeholder:text-gray-30 dark:text-white dark:caret-primary-30 dark:placeholder:text-gray-40"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear asset search"
                  className="text-gray-30 transition hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsDesktopSearchOpen(false);
                }}
                className="shrink-0 text-sm text-gray-30 transition hover:text-primary-90 dark:text-gray-40 dark:hover:text-primary-30"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsDesktopSearchOpen(true)}
              aria-label={`Search ${activeTable}`}
              aria-expanded={isDesktopSearchOpen}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-30 transition hover:bg-primary-90/[0.08] hover:text-primary-90 dark:text-gray-40 dark:hover:bg-white/[0.08] dark:hover:text-primary-30"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {activeTable === "assets" && hasAssets ? (
        <>
          <div className="grid min-h-0 content-start gap-3 min-[1024px]:hidden">
          {mobileVisibleAssets.map((asset) => {
            const cardValue =
              displayCurrency === "LOCAL" ? asset.localValue : asset.usdValue;

            return (
              <AssetCard
                key={asset.symbol}
                name={asset.name}
                symbol={asset.symbol}
                amount={formatAssetAmount(asset.amount)}
                value={formatCurrencyAmount(cardValue, activeCurrency)}
                hideBalances={!isBalanceVisible}
                isValueLoading={isAssetValueLoading}
                compact
              />
            );
          })}
          {mobileInvestmentAssets.map((asset) => {
            const cardValue =
              displayCurrency === "LOCAL" ? asset.localValue : asset.usdValue;

            return (
              <AssetCard
                key={asset.id}
                name={asset.name}
                symbol={asset.symbol}
                amount={`${formatAssetAmount(asset.shares)} shares`}
                value={formatCurrencyAmount(cardValue, activeCurrency)}
                hideBalances={!isBalanceVisible}
                href={asset.href}
                iconUrl={asset.logoUrl}
                subtitle={`${asset.kind === "rwa" ? "RWA" : "Tokenized stock"} · ${asset.provider}`}
                compact
              />
            );
          })}
          </div>
          <Link
            href="/assets"
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/[0.04] px-4 py-2 text-sm font-semibold text-cryptoNight transition hover:bg-black/[0.08] dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.12] min-[1024px]:hidden"
          >
            View all
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <DesktopAssetTable
            activeCurrency={activeCurrency}
            displayCurrency={displayCurrency}
            isBalanceVisible={isBalanceVisible}
            investmentAssets={filteredInvestmentAssets}
            visibleAssets={filteredVisibleAssets}
          />
        </>
      ) : activeTable === "yield" && hasYieldPositions ? (
        <>
          <div className="grid min-h-0 content-start gap-3 min-[1024px]:hidden">
            {mobileYieldPositions.map((position) => {
              const opportunity = getPositionOpportunity(position, yieldOpportunities);
              if (!opportunity) return null;
              return (
                <Link
                  key={position.id}
                  href={`/earn/positions/${encodeURIComponent(position.id)}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-secondary-50"
                >
                  <AssetIdentity
                    name={getProtocolName(opportunity.protocol)}
                    symbol={opportunity.symbol}
                    subtitle={`${getProtocolName(opportunity.protocol)} · ${opportunity.chain}`}
                  />
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatApy(opportunity.apy)}
                    </span>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-40">
                      {formatTokenAmount(getPositionValue(position))} {opportunity.symbol}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          <DesktopYieldTable
            positions={filteredYieldPositions}
            opportunities={yieldOpportunities}
            isLoading={isYieldPositionsLoading}
          />
        </>
      ) : isInvestmentsLoading ? (
        <div className="flex min-h-[160px] flex-1 flex-col justify-center gap-3 rounded-xl border border-black/10 bg-white/70 p-5 dark:border-white/10 dark:bg-secondary-50">
          <div className="h-4 w-28 animate-pulse rounded-full bg-gray-90 dark:bg-white/10" />
          <div className="h-12 animate-pulse rounded-lg bg-gray-90 dark:bg-white/5" />
        </div>
      ) : (
        <FlowEmptyState
          className="min-h-[220px] flex-1 rounded-xl border-black/10 bg-white/70 shadow-sm shadow-primary-90/10 dark:border-white/10 dark:bg-secondary-50 dark:shadow-none md:min-h-0 md:rounded-lg lg:items-start lg:text-left"
          icon={
            <Coins
              size={24}
              className="text-primary-50 dark:text-gray-600 md:h-7 md:w-7"
            />
          }
          title="No assets yet"
          text="Your holdings will appear here after your first deposit or crypto purchase."
          textClassName="max-w-[220px]"
        />
      )}
    </div>
  );
}

function DesktopYieldTable({
  isLoading,
  opportunities,
  positions,
}: {
  isLoading: boolean;
  opportunities: YieldOpportunity[];
  positions: YieldPosition[];
}) {
  const displayedPositions = positions.slice(0, 10);

  return (
    <div className="hidden overflow-x-auto rounded-xl border border-black/10 min-[1024px]:block min-[1280px]:flex min-[1280px]:h-full min-[1280px]:flex-1 min-[1280px]:flex-col dark:border-white/10">
      <div className="grid min-w-[820px] grid-cols-[minmax(150px,1.7fr)_minmax(80px,.8fr)_80px_90px_70px] items-center gap-2 border-b border-black/10 px-5 py-3 text-[11px] font-semibold text-gray-500 dark:border-white/10 dark:text-gray-40 min-[1280px]:grid-cols-[minmax(180px,1.7fr)_minmax(105px,.9fr)_minmax(100px,.8fr)_minmax(115px,.9fr)_90px] min-[1280px]:gap-3">
        <span>Position</span>
        <span className="text-right">Supplied</span>
        <span className="text-right">APY</span>
        <span className="text-right">Est. annual yield</span>
        <span className="text-right">Status</span>
      </div>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500 dark:text-gray-40">Loading yield positions…</div>
      ) : displayedPositions.length ? (
        displayedPositions.map((position) => {
          const opportunity = getPositionOpportunity(position, opportunities);
          if (!opportunity) return null;
          const amount = getPositionValue(position);
          const annualYield = (amount * Number(position.entryApy || 0)) / 100;
          return (
            <Link
              key={position.id}
              href={`/earn/positions/${encodeURIComponent(position.id)}`}
              className="grid min-w-[820px] grid-cols-[minmax(150px,1.7fr)_minmax(80px,.8fr)_80px_90px_70px] items-center gap-2 border-b border-black/10 px-4 py-2 transition-colors hover:bg-primary-99 dark:border-white/10 dark:hover:bg-white/[0.04] min-[1280px]:grid-cols-[minmax(180px,1.7fr)_minmax(105px,.9fr)_minmax(100px,.8fr)_minmax(115px,.9fr)_90px] min-[1280px]:gap-3"
            >
              <AssetIdentity
                name={getProtocolName(opportunity.protocol)}
                symbol={opportunity.symbol}
                subtitle={`${getProtocolName(opportunity.protocol)} · ${opportunity.chain}`}
              />
              <span className="text-right text-sm text-cryptoNight dark:text-white">
                {formatTokenAmount(amount)} {opportunity.symbol}
              </span>
              <span className="text-right text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {formatApy(position.entryApy)}
              </span>
              <span className="text-right text-sm text-cryptoNight dark:text-white">
                {annualYield.toFixed(2)} {opportunity.symbol}
              </span>
              <span className="justify-self-end rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                {position.status}
              </span>
            </Link>
          );
        })
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-semibold text-cryptoNight dark:text-white">No active yield positions</p>
          <Link href="/earn?category=yield" className="text-sm font-medium text-primary-50 hover:underline dark:text-primary-70">
            Explore earning opportunities
          </Link>
        </div>
      )}
    </div>
  );
}

function DesktopAssetTable({
  activeCurrency,
  displayCurrency,
  investmentAssets,
  isBalanceVisible,
  visibleAssets,
}: {
  activeCurrency: string;
  displayCurrency: "LOCAL" | "USD";
  investmentAssets: InvestmentAssetSummary[];
  isBalanceVisible: boolean;
  visibleAssets: GroupedAssetSummary[];
}) {
  const displayedVisibleAssets = visibleAssets.slice(0, 10);
  const remainingAssetSlots = 10 - displayedVisibleAssets.length;
  const displayedInvestmentAssets = investmentAssets.slice(0, Math.max(0, remainingAssetSlots));
  const valueFor = (asset: { localValue: number; usdValue: number }) =>
    displayCurrency === "LOCAL" ? asset.localValue : asset.usdValue;

  return (
    <div className="hidden overflow-x-auto rounded-xl border border-black/10 min-[1024px]:block min-[1280px]:flex min-[1280px]:h-full min-[1280px]:flex-1 min-[1280px]:flex-col dark:border-white/10">
      <div className="grid min-w-[820px] grid-cols-[minmax(150px,1.6fr)_80px_80px_90px_58px_28px] items-center gap-2 border-b border-black/10 px-5 py-3 text-[11px] font-semibold text-gray-500 dark:border-white/10 dark:text-gray-40 min-[1280px]:grid-cols-[minmax(180px,1.7fr)_minmax(105px,.8fr)_minmax(110px,.9fr)_minmax(115px,.9fr)_minmax(95px,.7fr)_42px] min-[1280px]:gap-3">
        <span>Asset</span>
        <span className="text-right">Balance</span>
        <span className="text-right">Price</span>
        <span className="text-right">Value</span>
        <span className="text-right">24h</span>
        <span aria-label="Actions" />
      </div>

      {displayedVisibleAssets.map((asset) => (
        <Link
          key={asset.symbol}
          href={`/assets/${asset.symbol.toLowerCase()}`}
          className="grid min-w-[820px] grid-cols-[minmax(150px,1.6fr)_80px_80px_90px_58px_28px] items-center gap-2 border-b border-black/10 px-4 py-2 transition-colors hover:bg-primary-99 dark:border-white/10 dark:hover:bg-white/[0.04] min-[1280px]:grid-cols-[minmax(180px,1.7fr)_minmax(105px,.8fr)_minmax(110px,.9fr)_minmax(115px,.9fr)_minmax(95px,.7fr)_42px] min-[1280px]:gap-3"
        >
          <AssetIdentity name={asset.name} symbol={asset.symbol} />
          <span className="text-right text-sm text-cryptoNight dark:text-white">
            {isBalanceVisible ? formatAssetAmount(asset.amount) : "••••"}
          </span>
          <span className="text-right text-sm text-cryptoNight dark:text-white">$1.00</span>
          <span className="text-right text-sm font-medium text-cryptoNight dark:text-white">
            {isBalanceVisible
              ? formatCurrencyAmount(valueFor(asset), activeCurrency)
              : "••••"}
          </span>
          <span className="text-right text-sm text-gray-500 dark:text-gray-40">—</span>
          <MoreHorizontal className="justify-self-end text-gray-500 dark:text-gray-40" size={18} />
        </Link>
      ))}

      {displayedInvestmentAssets.map((asset) => {
        const change = asset.change24hPercentage;
        return (
          <Link
            key={asset.id}
            href={asset.href}
            className="grid min-w-[820px] grid-cols-[minmax(150px,1.6fr)_80px_80px_90px_58px_28px] items-center gap-2 border-b border-black/10 px-4 py-2 transition-colors hover:bg-primary-99 dark:border-white/10 dark:hover:bg-white/[0.04] min-[1280px]:grid-cols-[minmax(180px,1.7fr)_minmax(105px,.8fr)_minmax(110px,.9fr)_minmax(115px,.9fr)_minmax(95px,.7fr)_42px] min-[1280px]:gap-3"
          >
            <AssetIdentity
              iconUrl={asset.logoUrl}
              name={asset.name}
              symbol={asset.symbol}
              subtitle="Tokenized stock"
            />
            <span className="text-right text-sm text-cryptoNight dark:text-white">
              {isBalanceVisible ? formatAssetAmount(asset.shares) : "••••"}
            </span>
            <span className="text-right text-sm text-cryptoNight dark:text-white">
              {asset.price ? `$${asset.price.toFixed(2)}` : "—"}
            </span>
            <span className="text-right text-sm font-medium text-cryptoNight dark:text-white">
              {isBalanceVisible
                ? formatCurrencyAmount(valueFor(asset), activeCurrency)
                : "••••"}
            </span>
            <span
              className={`text-right text-sm font-medium ${
                change === undefined || change === 0
                  ? "text-gray-40"
                  : change > 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-700 dark:text-rose-300"
              }`}
            >
              {change === undefined || change === 0
                ? "—"
                : `${change > 0 ? "+" : ""}${change.toFixed(2)}%`}
            </span>
            <MoreHorizontal className="justify-self-end text-gray-40" size={18} />
          </Link>
        );
      })}
    </div>
  );
}

function AssetIdentity({
  iconUrl,
  name,
  subtitle,
  symbol,
}: {
  iconUrl?: string;
  name: string;
  subtitle?: string;
  symbol: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-black/10 bg-white text-[11px] font-bold text-primary-70 dark:border-white/10 dark:bg-secondary-60">
        {symbol.slice(0, 2)}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            iconUrl ||
            `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`
          }
          alt=""
          className="absolute inset-0 h-full w-full bg-white object-contain p-0.5"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-cryptoNight dark:text-white">{symbol}</span>
        <span className="block truncate text-xs text-gray-500 dark:text-gray-40">{subtitle || name}</span>
      </span>
    </span>
  );
}
