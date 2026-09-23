import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Clock,
} from "lucide-react";
import HydrationSafeRelativeTime from "@/components/HydrationSafeRelativeTime";
import FlowEmptyState from "@/components/wallet/shared/FlowEmptyState";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/db";
import { ActivityListSkeleton } from "./DashboardSkeletons";
import {
  getTransactionAmountLabel,
  getTransactionStatusClasses,
  getTransactionStatusLabel,
  getTransactionTitle,
  isPositiveTransaction,
} from "@/lib/dashboard-utils";

interface ActivityPanelProps {
  isBalanceVisible: boolean;
  isTransactionsLoading: boolean;
  recentTransactions: Transaction[];
  transactionsError: string | null;
}

export default function ActivityPanel({
  isBalanceVisible,
  isTransactionsLoading,
  recentTransactions,
  transactionsError,
}: ActivityPanelProps) {
  return (
    <div className="order-7 flex max-h-[420px] w-full flex-col space-y-4 overflow-hidden min-[1024px]:order-none min-[1024px]:col-span-full min-[1024px]:max-h-[240px] min-[1024px]:space-y-2 min-[1024px]:!border-0 min-[1024px]:!bg-white/80 min-[1024px]:!shadow-none min-[1024px]:dark:!bg-secondary-50 lg:h-[240px] lg:max-h-[240px] lg:space-y-2 lg:rounded-xl lg:border lg:border-white/70 lg:bg-white/60 lg:p-4 lg:shadow-sm lg:shadow-primary-90/20 lg:backdrop-blur-xl lg:dark:border-white/10 lg:dark:bg-transparent lg:dark:shadow-none">
      <div className="lg:hidden">
        <Link
          href="/transactions"
          className="group inline-flex items-center gap-1 text-black dark:text-white"
        >
          <h3 className="text-[15px] font-semibold leading-tight tracking-normal text-black dark:text-white md:text-base">
            Recent Activity
          </h3>
          <ChevronRight
            aria-hidden="true"
            className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      <div className="hidden items-end justify-between lg:flex">
        <h3 className="text-base font-semibold leading-tight tracking-normal text-black dark:text-white">
          Recent Activity
        </h3>
        <Link
          href="/transactions"
          className="cursor-pointer text-sm text-primary-50 hover:opacity-80 dark:min-[1024px]:text-white dark:min-[1024px]:hover:text-white/70"
        >
          See All
        </Link>
      </div>

      {isTransactionsLoading ? (
        <ActivityListSkeleton />
      ) : transactionsError ? (
        <ActivityEmptyState
          title="Activity unavailable"
          text={transactionsError}
        />
      ) : recentTransactions.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="overflow-hidden rounded-xl border border-black/10 bg-white/80 shadow-sm shadow-primary-90/10 dark:border-white/10 dark:bg-secondary-50 dark:shadow-none">
            {recentTransactions.map((transaction) => (
              <Link
                key={transaction.id}
                href={`/transactions/${transaction.id}`}
                className="flex cursor-pointer items-center justify-between gap-2 border-b border-black/10 px-2.5 py-3 transition-colors last:border-b-0 hover:bg-primary-99/80 dark:border-white/10 dark:hover:bg-secondary-60/40 xs:gap-3 xs:px-3 min-[1024px]:gap-2 min-[1024px]:px-2.5 min-[1024px]:py-1.5 lg:gap-3 lg:px-3 lg:py-1.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 xs:gap-3 min-[1024px]:gap-2 lg:gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full min-[1024px]:h-7 min-[1024px]:w-7 lg:h-8 lg:w-8",
                      isPositiveTransaction(transaction.type)
                        ? "bg-primary-95 dark:bg-primary-70/15"
                        : "bg-white dark:bg-secondary-60",
                    )}
                  >
                    {isPositiveTransaction(transaction.type) ? (
                      <ArrowDownLeft className="h-3.5 w-3.5 text-primary-50 dark:text-primary-80 min-[1024px]:h-3 min-[1024px]:w-3 lg:h-3.5 lg:w-3.5" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 text-gray-20 dark:text-gray-40 min-[1024px]:h-3 min-[1024px]:w-3 lg:h-3.5 lg:w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-black dark:text-white min-[1024px]:text-[11px] lg:text-sm">
                      {getTransactionTitle(transaction)}
                    </p>
                    <div className="mt-1 flex items-center gap-2 min-[1024px]:gap-1.5">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 min-[1024px]:text-[10px] lg:text-[11px]">
                        <HydrationSafeRelativeTime
                          value={transaction.createdAt}
                        />
                      </span>
                      <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                      <span
                        className={cn(
                          "text-[10px] font-medium min-[1024px]:text-[9px] lg:text-[10px]",
                          getTransactionStatusClasses(transaction.status),
                        )}
                      >
                        {getTransactionStatusLabel(transaction.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ml-2 min-w-[50px] shrink-0 text-right xs:min-w-[56px] min-[1024px]:ml-2 min-[1024px]:min-w-[48px] lg:ml-3 lg:min-w-[56px]">
                  <p className="break-words text-[11px] font-medium leading-tight text-black dark:text-white xs:text-xs min-[1024px]:text-[11px] lg:text-sm">
                    {isBalanceVisible
                      ? getTransactionAmountLabel(transaction)
                      : "••••"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <ActivityEmptyState
          title="No transactions yet"
          text="Your financial journey starts with your first deposit."
        />
      )}
    </div>
  );
}

function ActivityEmptyState({ title, text }: { title: string; text: string }) {
  return (
    <FlowEmptyState
      className="min-h-[250px] flex-1 rounded-xl border-black/10 bg-white/70 shadow-sm shadow-primary-90/10 min-[1024px]:min-h-0 min-[1024px]:p-4 dark:border-white/10 dark:bg-secondary-50 dark:shadow-none md:rounded-lg"
      icon={
        <Clock
          size={24}
          className="text-primary-50 dark:text-gray-600 md:h-7 md:w-7"
        />
      }
      title={title}
      text={text}
      textClassName="max-w-[220px]"
    />
  );
}
