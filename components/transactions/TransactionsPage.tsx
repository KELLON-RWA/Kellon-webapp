"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import HydrationSafeRelativeTime from "@/components/HydrationSafeRelativeTime";
import { cn } from "@/lib/utils";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
import {
  getTransactionAmountLabel,
  getTransactionStatusClasses,
  getTransactionStatusLabel,
  getTransactionSymbol,
  getTransactionTitle,
  getStockTransactionFiatLabel,
  isPositiveTransaction,
  isStockTransaction,
  isYieldTransaction,
} from "@/lib/dashboard-utils";
import { transactionService } from "@/services/api/transactions";
import { getActivityRefetchInterval } from "@/lib/transaction-polling";
import type { Transaction } from "@/types/db";
import TransactionFilterModal, {
  type ActivityFilter,
} from "@/components/modals/TransactionFilterModal";

type QuickTab = "all" | "sent" | "received";

const QUICK_TABS: QuickTab[] = ["all", "sent", "received"];
const TRANSACTIONS_PER_PAGE = 25;
type PageItem = number | "ellipsis";

function getPaginationItems(
  currentPage: number,
  pageCount: number,
): PageItem[] {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 2) {
    return [1, 2, "ellipsis", pageCount];
  }

  if (currentPage === 3) {
    return [1, 2, 3, 4, "ellipsis", pageCount];
  }

  if (currentPage >= pageCount - 1) {
    return [1, "ellipsis", pageCount - 1, pageCount];
  }

  if (currentPage === pageCount - 2) {
    return [
      1,
      "ellipsis",
      pageCount - 3,
      pageCount - 2,
      pageCount - 1,
      pageCount,
    ];
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    pageCount,
  ];
}

function matchesActivityFilter(
  transaction: Transaction,
  filter: ActivityFilter,
): boolean {
  const method = (transaction.executionMethod || "").toLowerCase();
  const metadata = JSON.stringify(transaction.metadata || {}).toLowerCase();

  switch (filter) {
    case "all":
      return true;
    case "sent":
      return ["TRANSFER_OUT", "SELL"].includes(transaction.type);
    case "received":
      return ["TRANSFER_IN"].includes(transaction.type);
    case "withdraw":
      return (
        transaction.type === "WITHDRAW" && !isYieldTransaction(transaction)
      );
    case "deposit":
      return (
        ["BUY", "DEPOSIT"].includes(transaction.type) &&
        !isYieldTransaction(transaction)
      );
    case "bridge":
      return (
        transaction.type === "BRIDGE" ||
        method.includes("bridge") ||
        metadata.includes("bridge")
      );
    case "invoices":
      return method.includes("invoice") || metadata.includes("invoice");
    case "gifts":
      return method.includes("gift") || metadata.includes("gift");
    case "cards":
      return method.includes("card") || metadata.includes("card");
    case "earn":
      return (
        isYieldTransaction(transaction) ||
        method.includes("earn") ||
        method.includes("yield") ||
        metadata.includes("earn") ||
        metadata.includes("yield")
      );
    default:
      return true;
  }
}

function matchesStockFilter(
  transaction: Transaction,
  stockSymbol: string,
  provider: string | null,
): boolean {
  if (!isStockTransaction(transaction)) return false;

  const normalizedSymbol = stockSymbol.toUpperCase();
  const rawSymbol = String(transaction.symbol || "").toUpperCase();
  const metadataSymbol = getTransactionSymbol(transaction).toUpperCase();

  if (rawSymbol === normalizedSymbol) return true;
  if (metadataSymbol !== normalizedSymbol) return false;

  return (
    !provider ||
    JSON.stringify(transaction.metadata || {})
      .toLowerCase()
      .includes(provider.toLowerCase())
  );
}

function normalizeDate(value: string | null, endOfDay = false): number | null {
  if (!value) return null;

  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`,
  );
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function TransactionListSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center justify-between gap-4 border-b border-black/5 px-4 py-4 last:border-b-0 dark:border-white/10 md:px-5"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-gray-100 dark:bg-secondary-60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-28 rounded-full bg-gray-100 dark:bg-secondary-60" />
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-12 rounded-full bg-gray-100 dark:bg-secondary-60" />
                <div className="h-1 w-1 rounded-full bg-gray-200 dark:bg-secondary-60" />
                <div className="h-2.5 w-14 rounded-full bg-gray-100 dark:bg-secondary-60" />
              </div>
            </div>
          </div>
          <div className="h-3.5 w-20 shrink-0 rounded-full bg-gray-100 dark:bg-secondary-60" />
        </div>
      ))}
    </>
  );
}

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeQuickTab, setActiveQuickTab] = useState<QuickTab>("all");
  const [appliedActivityFilter, setAppliedActivityFilter] =
    useState<ActivityFilter>("all");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");
  const [draftActivityFilter, setDraftActivityFilter] =
    useState<ActivityFilter>("all");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const stockSymbol = searchParams.get("stock")?.trim().toUpperCase() || "";
  const stockProvider = searchParams.get("provider")?.trim() || null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const response = await transactionService.getTransactions();
      return response.data || [];
    },
    staleTime: 5_000,
    refetchInterval: (query) => getActivityRefetchInterval(query.state.data),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const transactions = useMemo(() => data || [], [data]);
  const filteredTransactions = useMemo(() => {
    const startTime = normalizeDate(appliedStartDate);
    const endTime = normalizeDate(appliedEndDate, true);

    return [...transactions]
      .filter((transaction) => {
        if (activeQuickTab === "sent") {
          if (!matchesActivityFilter(transaction, "sent")) return false;
        } else if (activeQuickTab === "received") {
          if (!matchesActivityFilter(transaction, "received")) return false;
        }

        if (!matchesActivityFilter(transaction, appliedActivityFilter)) {
          return false;
        }

        if (
          stockSymbol &&
          !matchesStockFilter(transaction, stockSymbol, stockProvider)
        ) {
          return false;
        }

        const timestamp = new Date(transaction.createdAt).getTime();
        if (startTime !== null && timestamp < startTime) return false;
        if (endTime !== null && timestamp > endTime) return false;

        return true;
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
  }, [
    transactions,
    activeQuickTab,
    appliedActivityFilter,
    appliedStartDate,
    appliedEndDate,
    stockProvider,
    stockSymbol,
  ]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE),
  );
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
    return filteredTransactions.slice(start, start + TRANSACTIONS_PER_PAGE);
  }, [currentPage, filteredTransactions]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeQuickTab,
    appliedActivityFilter,
    appliedStartDate,
    appliedEndDate,
    stockProvider,
    stockSymbol,
  ]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const openFilters = () => {
    setDraftActivityFilter(appliedActivityFilter);
    setDraftStartDate(appliedStartDate);
    setDraftEndDate(appliedEndDate);
    setIsFilterOpen(true);
  };

  const resetFilters = () => {
    setAppliedActivityFilter("all");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setDraftActivityFilter("all");
    setDraftStartDate("");
    setDraftEndDate("");
    setIsFilterOpen(false);
  };

  const applyFilters = () => {
    setAppliedActivityFilter(draftActivityFilter);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setIsFilterOpen(false);
  };

  return (
    <section className="container mx-auto flex h-[100dvh] max-w-4xl flex-col overflow-hidden px-4 pb-0 pt-4 md:px-6 md:pb-12 md:pt-20">
      <FlowHeader
        title="Transactions"
        onBack={() => router.back()}
        rightAction={{
          label: "Open filters",
          icon: <Filter className="h-5 w-5" />,
          onClick: openFilters,
        }}
      />

      <TransactionFilterModal
        isOpen={isFilterOpen}
        onClose={setIsFilterOpen}
        activityFilter={draftActivityFilter}
        startDate={draftStartDate}
        endDate={draftEndDate}
        onActivityFilterChange={setDraftActivityFilter}
        onStartDateChange={setDraftStartDate}
        onEndDateChange={setDraftEndDate}
        onReset={resetFilters}
        onApply={applyFilters}
      />

      {/* Quick Tabs */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {QUICK_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveQuickTab(tab)}
            className={cn(
              "cursor-pointer shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
              activeQuickTab === tab
                ? "border-primary-90 bg-primary-95 text-primary-50 dark:border-primary-70/20 dark:bg-primary-70/15 dark:text-primary-80"
                : "border-gray-80 bg-white/80 text-gray-20 hover:text-cryptoNight dark:border-white/10 dark:bg-secondary-50/70 dark:text-gray-40 dark:hover:text-white",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
          {isLoading ? (
            <TransactionListSkeleton />
          ) : error ? (
            <div className="rounded-2xl border border-black/5 bg-white p-6 text-center dark:border-white/10 dark:bg-secondary-50">
              <p className="text-xs text-red-500 dark:text-red-400">
                {error instanceof Error
                  ? error.message
                  : "Failed to load transactions."}
              </p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-3 rounded-full bg-gray-100 p-3 dark:bg-secondary-60/50">
                <ArrowUpRight className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No transactions yet
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Your transactions will appear here
              </p>
            </div>
          ) : (
            paginatedTransactions.map((transaction) => {
              const isStockOrder = isStockTransaction(transaction);
              const isSale = transaction.type === "SELL";
              const fiatLabel = getStockTransactionFiatLabel(transaction);
              const amountLabel = getTransactionAmountLabel(transaction);
              const hasKnownAmount = !amountLabel.startsWith("--");
              const isPositiveAmount = isStockOrder
                ? !isSale
                : isPositiveTransaction(transaction.type);

              return (
                <Link
                  key={transaction.id}
                  href={`/transactions/${transaction.id}`}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-black/5 px-3 py-3 transition-colors last:border-b-0 sm:gap-3 md:px-5",
                    "hover:bg-gray-95 dark:border-white/10 dark:hover:bg-secondary-60/40",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        isStockOrder
                          ? isSale
                            ? "bg-rose-500/10"
                            : "bg-emerald-500/10"
                          : isPositiveTransaction(transaction.type)
                            ? "bg-primary-95 dark:bg-primary-70/15"
                            : "bg-gray-95 dark:bg-secondary-60",
                      )}
                    >
                      {isStockOrder ? (
                        isSale ? (
                          <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                        )
                      ) : isPositiveTransaction(transaction.type) ? (
                        <ArrowDownLeft className="h-4 w-4 text-primary-60 dark:text-primary-80" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-black dark:text-white">
                        {getTransactionTitle(transaction)}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                          <HydrationSafeRelativeTime
                            value={transaction.createdAt}
                          />
                        </span>
                        <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <span
                          className={cn(
                            "whitespace-nowrap text-[10px] font-medium",
                            getTransactionStatusClasses(transaction.status),
                          )}
                        >
                          {getTransactionStatusLabel(transaction.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5 text-right sm:gap-1">
                    <div className="text-right">
                      <p
                        className={cn(
                          "whitespace-nowrap text-[11px] font-medium",
                          hasKnownAmount &&
                            (isPositiveAmount
                              ? "text-emerald-600 dark:text-emerald-300"
                              : "text-rose-600 dark:text-rose-300"),
                          !hasKnownAmount && "text-black dark:text-white",
                        )}
                      >
                        {amountLabel}
                      </p>
                      {fiatLabel ? (
                        <p
                          className={cn(
                            "mt-0.5 text-[11px] font-medium",
                            isSale
                              ? "text-emerald-600 dark:text-emerald-300"
                              : "text-gray-500 dark:text-gray-400",
                          )}
                        >
                          {fiatLabel}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
      {filteredTransactions.length > TRANSACTIONS_PER_PAGE ? (
        <nav
          aria-label="Transaction pages"
          className="flex shrink-0 items-center justify-center px-1 py-4 sm:justify-between"
        >
          <span className="hidden text-xs text-gray-500 dark:text-gray-40 sm:block">
            Page {currentPage} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              aria-label="Previous transaction page"
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-gray-80 text-gray-500 transition-colors hover:border-primary-70 hover:text-primary-60 disabled:cursor-default disabled:opacity-40 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-70 dark:hover:text-primary-80"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {getPaginationItems(currentPage, pageCount).map((item, index) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="grid h-8 w-5 shrink-0 place-items-center text-xs text-gray-500 dark:text-gray-40"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  aria-current={item === currentPage ? "page" : undefined}
                  className={cn(
                    "grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-xs font-semibold transition-colors",
                    item === currentPage
                      ? "bg-primary-70 text-white"
                      : "border border-gray-80 text-gray-500 hover:border-primary-70 hover:text-primary-60 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-70 dark:hover:text-primary-80",
                  )}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.min(pageCount, page + 1))
              }
              disabled={currentPage === pageCount}
              aria-label="Next transaction page"
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-gray-80 text-gray-500 transition-colors hover:border-primary-70 hover:text-primary-60 disabled:cursor-default disabled:opacity-40 dark:border-white/10 dark:text-gray-40 dark:hover:border-primary-70 dark:hover:text-primary-80"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
