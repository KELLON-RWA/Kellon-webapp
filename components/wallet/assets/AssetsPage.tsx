"use client";

import { useState } from "react";
import { Search, Settings2, X } from "lucide-react";
import AssetCard from "@/components/wallet/dashboard/AssetCard";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { MAINNET_CHAINS } from "@/lib/chains";
import { useDashboardData } from "@/lib/use-dashboard-data";
import { formatAssetAmount, formatCurrencyAmount } from "@/lib/dashboard-utils";
import type { User } from "@/types/db";

interface AssetsPageProps {
  profile: User;
}

export default function AssetsPage({ profile }: AssetsPageProps) {
  const dashboard = useDashboardData(profile);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [hideLowBalanceAssets, setHideLowBalanceAssets] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const nativeSymbols = new Set(
    Object.values(MAINNET_CHAINS).map((chain) =>
      chain.nativeCurrency.symbol.toUpperCase(),
    ),
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const assets = dashboard.groupedAssets.filter((asset) => {
    if (nativeSymbols.has(asset.symbol.trim().toUpperCase())) return false;
    if (hideLowBalanceAssets && asset.usdValue < 0.01) return false;
    return (
      !normalizedQuery ||
      asset.name.toLowerCase().includes(normalizedQuery) ||
      asset.symbol.toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="min-h-screen bg-transparent px-4 pb-28 pt-5 md:px-6 md:py-8">
      <main className="mx-auto w-full max-w-3xl">
        <FlowHeader
          title="Assets"
          backHref="/"
          backLabel="Back to wallet"
          rightAction={{
            label: "Manage assets",
            icon: <Settings2 className="h-5 w-5" />,
            onClick: () => setIsManageOpen(true),
          }}
        />

        <label className="mt-6 flex h-12 items-center gap-3 rounded-xl border border-black/10 bg-white/70 px-4 text-gray-500 shadow-sm shadow-primary-90/10 dark:border-white/10 dark:bg-secondary-50/70 dark:text-gray-40 dark:shadow-none">
          <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search assets"
            className="min-w-0 flex-1 bg-transparent text-sm text-cryptoNight outline-none caret-primary-90 placeholder:text-gray-500 dark:text-white dark:caret-primary-30 dark:placeholder:text-gray-40"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear asset search"
              className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>

        <div className="mt-6 grid gap-3">
          {assets.length ? (
            assets.map((asset) => {
              const value =
                dashboard.displayCurrency === "LOCAL"
                  ? asset.localValue
                  : asset.usdValue;

              return (
                <AssetCard
                  key={asset.symbol}
                  name={asset.name}
                  symbol={asset.symbol}
                  amount={formatAssetAmount(asset.amount)}
                  value={formatCurrencyAmount(value, dashboard.activeCurrency)}
                  hideBalances={!dashboard.isBalanceVisible}
                  isValueLoading={dashboard.isAssetValueLoading}
                  compact
                />
              );
            })
          ) : (
            <p className="rounded-xl border border-black/10 bg-white/70 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-40">
              No assets to show.
            </p>
          )}
        </div>
      </main>

      <Drawer open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DrawerContent className="rounded-t-[32px] border-none bg-gray-70 outline-none dark:bg-black2 [&>button]:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Manage assets</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-bold text-black dark:text-white">Manage assets</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-secondary-90">Choose what appears in your asset list.</p>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[24px] border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-secondary-60">
              <span>
                <span className="block text-sm font-bold text-black dark:text-white">Hide low-balance assets</span>
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">Hide assets worth less than $0.01.</span>
              </span>
              <input
                type="checkbox"
                checked={hideLowBalanceAssets}
                onChange={(event) => setHideLowBalanceAssets(event.target.checked)}
                className="h-5 w-9 cursor-pointer accent-primary-70"
              />
            </label>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
