"use client";

import { CHAIN_UI_DATA } from "@/lib/chains";
import { formatCurrencyAmount } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import type { ChainBalance } from "./asset-details-utils";
import { formatTokenAmount } from "./asset-details-utils";

interface AssetOverviewViewProps {
  symbol: string;
  chainBalances: ChainBalance[];
  activeTab: string;
  displayAmount: number;
  displayValue: number;
  localCurrency: string;
  ringColor?: string;
  isBalanceVisible: boolean;
  isValueLoading: boolean;
  onSelectChain: (chain: string) => void;
}

export function AssetOverviewView({
  symbol,
  chainBalances,
  activeTab,
  displayAmount,
  displayValue,
  localCurrency,
  ringColor = CHAIN_UI_DATA.base.color,
  isBalanceVisible,
  isValueLoading,
  onSelectChain,
}: AssetOverviewViewProps) {
  return (
    <main className="flex flex-1 flex-col gap-4 pt-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
        <section className="flex flex-col items-center rounded-2xl border border-black/5 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-secondary-50">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            Total multi-chain balance
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-none text-black dark:text-white md:text-4xl">
            {isBalanceVisible ? formatTokenAmount(displayAmount) : "••••••"}{" "}
            <span className="text-xl text-gray-400 dark:text-gray-500 md:text-2xl">
              {symbol}
            </span>
          </h2>

          <div
            className="relative mt-6 flex h-40 w-40 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${ringColor} 0deg 360deg)`,
            }}
          >
            <div className="absolute inset-4 rounded-full bg-white dark:bg-secondary-50" />
            <div className="relative z-10 px-4 text-center">
              {isValueLoading ? (
                <div className="mx-auto h-5 w-20 animate-pulse rounded-full bg-gray-100 dark:bg-secondary-60" />
              ) : (
                <p className="text-base font-bold text-black dark:text-white">
                  {isBalanceVisible
                    ? formatCurrencyAmount(displayValue, localCurrency)
                    : "••••••"}
                </p>
              )}
              <p className="mt-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                Total Value
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/70 bg-white/55 p-4 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50/20">
          <div className="mb-3">
            <h3 className="text-[15px] font-semibold leading-tight text-black dark:text-white md:text-base">
              Balance Distribution
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Across supported networks
            </p>
          </div>

          <div className="space-y-2">
            {chainBalances.map((item) => (
              <button
                key={item.chain}
                type="button"
                onClick={() => onSelectChain(item.chain)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-left transition",
                  activeTab === item.chain
                    ? "border-primary-60/40 bg-primary-70/5"
                    : "border-black/5 bg-white hover:bg-gray-100 dark:border-white/5 dark:bg-secondary-50 dark:hover:bg-secondary-60/60",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold uppercase tracking-normal text-black dark:text-white">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {isBalanceVisible
                        ? formatCurrencyAmount(item.value, localCurrency)
                        : "••••"}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-black dark:text-white">
                    {isBalanceVisible ? formatTokenAmount(item.amount) : "••••"}{" "}
                    <span className="font-medium text-gray-400">{symbol}</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                    {item.percentage.toFixed(1)}%
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
