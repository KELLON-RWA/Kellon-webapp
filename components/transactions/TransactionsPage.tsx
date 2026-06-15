"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import HydrationSafeRelativeTime from "@/components/HydrationSafeRelativeTime";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getTransactionAmountLabel,
  getTransactionStatusClasses,
  getTransactionStatusLabel,
  getTransactionTitle,
  isPositiveTransaction,
} from "@/lib/dashboard-utils";
import { transactionService } from "@/services/api/transactions";
import type { Transaction } from "@/types/db";
import TransactionFilterModal, {
  type ActivityFilter,
} from "@/components/modals/TransactionFilterModal";

type QuickTab = "all" | "sent" | "received";

const QUICK_TABS: QuickTab[] = ["all", "sent", "received"];

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
      return transaction.type === "WITHDRAW";
    case "deposit":
      return ["BUY", "DEPOSIT"].includes(transaction.type);
    case "invoices":
      return method.includes("invoice") || metadata.includes("invoice");
    case "gifts":
      return method.includes("gift") || metadata.includes("gift");
    case "cards":
      return method.includes("card") || metadata.includes("card");
    case "earn":
      return (
        method.includes("earn") ||
        method.includes("yield") ||
        metadata.includes("earn") ||
        metadata.includes("yield")
      );
    default:
      return true;
  }
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const response = await transactionService.getTransactions();
      return response.data || [];
    },
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
  ]);

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
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="iconCircle"
          size="icon"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </Button>

        <h1 className="text-lg font-semibold text-black dark:text-white md:text-2xl">
          Transactions
        </h1>

        <Button
          type="button"
          variant="iconCircle"
          size="icon"
          onClick={openFilters}
          aria-label="Open filters"
        >
          <Filter className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </Button>
      </div>

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
            filteredTransactions.map((transaction) => (
              <Link
                key={transaction.id}
                href={`/transactions/${transaction.id}`}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-4 border-b border-black/5 px-4 py-4 transition-colors last:border-b-0 md:px-5",
                  "hover:bg-gray-95 dark:border-white/10 dark:hover:bg-secondary-60/40",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      isPositiveTransaction(transaction.type)
                        ? "bg-primary-95 dark:bg-primary-70/15"
                        : "bg-gray-95 dark:bg-secondary-60",
                    )}
                  >
                    {isPositiveTransaction(transaction.type) ? (
                      <ArrowDownLeft className="h-4 w-4 text-primary-60 dark:text-primary-80" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-black dark:text-white">
                      {getTransactionTitle(transaction)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        <HydrationSafeRelativeTime
                          value={transaction.createdAt}
                        />
                      </span>
                      <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          getTransactionStatusClasses(transaction.status),
                        )}
                      >
                        {getTransactionStatusLabel(transaction.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-medium text-black dark:text-white">
                      {getTransactionAmountLabel(transaction)}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
