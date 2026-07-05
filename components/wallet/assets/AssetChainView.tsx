"use client";

import {
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { formatCurrencyAmount } from "@/lib/dashboard-utils";
import {
  getTransactionAmountLabel,
  getTransactionStatusClasses,
  getTransactionStatusLabel,
  getTransactionTitle,
  isPositiveTransaction,
} from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/db";
import type { ChainBalance } from "./asset-details-utils";
import {
  formatShortDate,
  formatTokenAmount,
  getTransactionNumericAmount,
} from "./asset-details-utils";

interface AssetChainViewProps {
  symbol: string;
  activeChainBalance: ChainBalance;
  displayAmount: number;
  displayValue: number;
  localCurrency: string;
  tokenPrice: number;
  exchangeRate: number;
  activeChainAddress: string | null;
  copiedAddressChain: string | null;
  transactions: Transaction[];
  isTransactionsLoading: boolean;
  isBalanceVisible: boolean;
  isValueLoading: boolean;
  onCopyAddress: () => void;
  onAction: (action: "send" | "buy" | "withdraw") => void;
  onViewTransaction: (transactionId: string) => void;
}

export function AssetChainView({
  symbol,
  activeChainBalance,
  displayAmount,
  displayValue,
  localCurrency,
  tokenPrice,
  exchangeRate,
  activeChainAddress,
  copiedAddressChain,
  transactions,
  isTransactionsLoading,
  isBalanceVisible,
  isValueLoading,
  onCopyAddress,
  onAction,
  onViewTransaction,
}: AssetChainViewProps) {
  return (
    <main className="mx-auto flex w-full flex-1 flex-col gap-6 pt-8">
      <section className="flex flex-col items-center text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          {activeChainBalance.label} balance
        </p>
        <h2 className="mt-3 text-3xl font-bold leading-none text-black dark:text-white md:text-5xl">
          {isBalanceVisible ? formatTokenAmount(displayAmount) : "••••••"}{" "}
          <span className="text-xl text-gray-400 dark:text-gray-500 md:text-3xl">
            {symbol}
          </span>
        </h2>
        {isValueLoading ? (
          <div className="mt-2 h-5 w-24 animate-pulse rounded-full bg-gray-100 dark:bg-secondary-60" />
        ) : (
          <p className="mt-2 text-base font-semibold text-primary-60 dark:text-primary-80">
            {isBalanceVisible
              ? formatCurrencyAmount(displayValue, localCurrency)
              : "••••••"}
          </p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3">
        {[
          { id: "send" as const, label: "Send", icon: ArrowUpRight },
          { id: "buy" as const, label: "Buy", icon: Plus },
          { id: "withdraw" as const, label: "Withdraw", icon: ArrowUp },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.id)}
              className="flex cursor-pointer flex-col items-center gap-2 text-gray-600 transition hover:text-primary-60 dark:text-gray-400 dark:hover:text-primary-80"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-secondary-50">
                <Icon className="h-5 w-5 text-black dark:text-white" />
              </span>
              <span className="text-xs font-semibold">{action.label}</span>
            </button>
          );
        })}
      </section>

      <section className="space-y-2">
        <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          Your {activeChainBalance.label} address
        </p>

        <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-secondary-50">
          <p className="flex-1 break-all font-mono text-xs text-black dark:text-white">
            {activeChainAddress ||
              `No ${activeChainBalance.label} address found`}
          </p>
          {activeChainAddress && (
            <button
              type="button"
              onClick={onCopyAddress}
              aria-label="Copy address"
              className="flex-shrink-0 cursor-copy rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-secondary-60"
            >
              {copiedAddressChain === activeChainBalance.chain ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              )}
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-gray-400 dark:text-gray-500">
          Only send {activeChainBalance.label} assets to this address.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold leading-tight text-black dark:text-white md:text-base">
            Recent History
          </h3>
          {transactions.length > 0 && (
            <Link
              href={`/transactions?network=${activeChainBalance.chain}&asset=${symbol}`}
              className="text-xs font-semibold text-primary-60 transition-colors hover:text-primary-50 dark:text-primary-80 dark:hover:text-primary-70"
            >
              See all
            </Link>
          )}
        </div>

        {isTransactionsLoading ? (
          <div className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center justify-between gap-3 border-b border-black/5 px-4 py-3 last:border-b-0 dark:border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-secondary-60" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 rounded-full bg-gray-100 dark:bg-secondary-60" />
                    <div className="h-2.5 w-20 rounded-full bg-gray-100 dark:bg-secondary-60" />
                  </div>
                </div>
                <div className="h-3 w-16 rounded-full bg-gray-100 dark:bg-secondary-60" />
              </div>
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <div className="max-h-[420px] overflow-y-auto overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
            {transactions.slice(0, 8).map((transaction) => {
              const isPositive = isPositiveTransaction(transaction.type);
              const transactionAmount =
                getTransactionNumericAmount(transaction);
              const transactionValue =
                transactionAmount !== null
                  ? transactionAmount * tokenPrice * exchangeRate
                  : null;
              const DirectionIcon = isPositive ? ArrowDownLeft : ArrowUpRight;

              return (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => onViewTransaction(transaction.id)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-black/5 px-4 py-3 text-left transition last:border-b-0 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-secondary-60/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        isPositive
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-primary-70/10 text-primary-60 dark:text-primary-80",
                      )}
                    >
                      <DirectionIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-black dark:text-white">
                        {getTransactionTitle(transaction)}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400">
                        {formatShortDate(transaction.createdAt)}
                        <span className="mx-1">•</span>
                        <span
                          className={getTransactionStatusClasses(
                            transaction.status,
                          )}
                        >
                          {getTransactionStatusLabel(transaction.status)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-bold text-black dark:text-white">
                        {isBalanceVisible
                          ? getTransactionAmountLabel(transaction)
                          : "••••"}
                      </p>
                      {transactionValue !== null ? (
                        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          {isBalanceVisible
                            ? formatCurrencyAmount(
                                transactionValue,
                                localCurrency,
                              )
                            : "••••"}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                </button>
              );
            })}

            {transactions.length > 8 && (
              <Link
                href={`/transactions?network=${activeChainBalance.chain}&asset=${symbol}`}
                className="flex w-full items-center justify-center gap-1 px-4 py-3 text-xs font-semibold text-primary-60 transition hover:bg-gray-50 dark:text-primary-80 dark:hover:bg-secondary-60/40"
              >
                View all {transactions.length} transactions
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-black/5 bg-white p-5 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-400">
            No recent {symbol} activity on {activeChainBalance.label} yet.
          </div>
        )}
      </section>
    </main>
  );
}
