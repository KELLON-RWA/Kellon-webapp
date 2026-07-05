"use client";

import { useState } from "react";
import { ArrowLeft, Bell, Paintbrush } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import HydrationSafeRelativeTime from "@/components/HydrationSafeRelativeTime";
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { toast } from "sonner";
import { ActionToolTip } from "@/components/ActionTooltip";
import MarkNotificationsReadModal from "@/components/modals/MarkNotificationsReadModal";
import NotificationDetailModal, {
  type NotificationDetailDisplay,
} from "@/components/modals/NotificationDetailModal";
import { transactionService } from "@/services/api/transactions";
import { AssetType, TransactionStatus, TransactionType } from "@/types/db";
import type { Notification, Transaction } from "@/types/db";
import {
  formatAssetAmount,
  getTransactionAmountLabel,
  getTransactionStatusClasses,
  getTransactionStatusLabel,
  getTransactionTitle,
  isPositiveTransaction,
} from "@/lib/dashboard-utils";

type NotificationCategory = "Announcement" | "Transactions" | "System";
type NotificationCategoryFilter = "All" | NotificationCategory;

type NotificationDisplay = NotificationDetailDisplay & {
  category: NotificationCategory;
};

const TRANSACTION_TYPES = [
  TransactionType.DEPOSIT,
  TransactionType.WITHDRAW,
  TransactionType.BUY,
  TransactionType.SELL,
  TransactionType.SWAP,
  TransactionType.TRANSFER_IN,
  TransactionType.TRANSFER_OUT,
] as const;

const TRANSACTION_STATUSES = [
  TransactionStatus.PENDING,
  TransactionStatus.PAID,
  TransactionStatus.COMPLETED,
  TransactionStatus.FAILED,
  TransactionStatus.CANCELLED,
  TransactionStatus.REFUNDED,
] as const;

const CATEGORY_FILTERS: NotificationCategoryFilter[] = [
  "All",
  "Transactions",
  "System",
  "Announcement",
];

function getNotificationSearchText(notification: Notification): string {
  return [
    notification.type,
    notification.subject,
    notification.content,
    JSON.stringify(notification.metadata || {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getMetadataValue(
  notification: Notification,
  keys: string[],
): string | null {
  const metadata = notification.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function getRecordValue(
  record: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }

  return null;
}

function getNumericMetadataValue(
  notification: Notification,
  keys: string[],
): number | null {
  const value = getMetadataValue(notification, keys);
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTransactionIdFromNotification(
  notification: Notification,
): string | null {
  return getMetadataValue(notification, [
    "transactionId",
    "transaction_id",
    "txId",
    "tx_id",
    "id",
  ]);
}

function normalizeTransactionType(notification: Notification): string {
  return (
    getMetadataValue(notification, [
      "transactionType",
      "type",
      "activityType",
      "eventType",
    ]) ||
    notification.type ||
    ""
  ).toUpperCase();
}

function normalizeTransactionEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase();
  return allowed.includes(normalized as T) ? (normalized as T) : null;
}

function buildTransactionFromRecord(
  record: Record<string, unknown> | null,
  notification: Notification,
): Transaction | null {
  if (!record) return null;

  const type = normalizeTransactionEnum(
    getRecordValue(record, ["type", "transactionType", "activityType"]),
    TRANSACTION_TYPES,
  );
  const status = normalizeTransactionEnum(
    getRecordValue(record, ["status", "transactionStatus"]),
    TRANSACTION_STATUSES,
  );
  const symbol = getRecordValue(record, [
    "symbol",
    "asset",
    "token",
    "toAsset",
    "assetSymbol",
    "crypto",
  ]);
  const amount = getRecordValue(record, [
    "amount",
    "assetAmount",
    "tokenAmount",
    "providerAmount",
    "receivableAmount",
  ]);

  if (!type || !status || typeof symbol !== "string") return null;

  return {
    id: String(
      getRecordValue(record, ["id", "transactionId", "txId"]) ||
        notification.id,
    ),
    userId: notification.userId,
    type,
    amount:
      typeof amount === "string" || typeof amount === "number" ? amount : 0,
    symbol: symbol.toUpperCase(),
    assetType: AssetType.CRYPTO,
    status,
    metadata: record as Transaction["metadata"],
    createdAt: notification.createdAt,
    providerReference:
      typeof record.providerReference === "string"
        ? record.providerReference
        : null,
    userOpHash:
      typeof record.userOpHash === "string" ? record.userOpHash : null,
    executionMethod:
      typeof record.executionMethod === "string"
        ? record.executionMethod
        : null,
  };
}

function getEmbeddedTransactionRecord(
  notification: Notification,
): Record<string, unknown> | null {
  const metadata = notification.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const transaction = metadata.transaction;
  if (
    transaction &&
    typeof transaction === "object" &&
    !Array.isArray(transaction)
  ) {
    return transaction as Record<string, unknown>;
  }

  const data = metadata.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dataRecord = data as Record<string, unknown>;
    const nestedTransaction = dataRecord.transaction;

    if (
      nestedTransaction &&
      typeof nestedTransaction === "object" &&
      !Array.isArray(nestedTransaction)
    ) {
      return nestedTransaction as Record<string, unknown>;
    }
  }

  return metadata as Record<string, unknown>;
}

function getNotificationTransaction(
  notification: Notification,
  transactionById: Map<string, Transaction>,
): Transaction | null {
  const transactionId = getTransactionIdFromNotification(notification);
  if (transactionId) {
    const transaction = transactionById.get(transactionId);
    if (transaction) return transaction;
  }

  return buildTransactionFromRecord(
    getEmbeddedTransactionRecord(notification),
    notification,
  );
}

function getNotificationStatusDisplay(
  notification: Notification,
): Pick<NotificationDisplay, "statusClassName" | "statusLabel"> {
  const status = (
    getMetadataValue(notification, ["transactionStatus", "status"]) ||
    notification.status ||
    ""
  ).toUpperCase();

  if (!status) return {};

  return {
    statusLabel: getTransactionStatusLabel(status as never),
    statusClassName: getTransactionStatusClasses(status as never),
  };
}

function getNotificationAmountLabel(
  notification: Notification,
  symbol: string | null,
  isPositive: boolean,
): string | null {
  const amount = getNumericMetadataValue(notification, [
    "amount",
    "assetAmount",
    "tokenAmount",
    "providerAmount",
    "receivableAmount",
  ]);

  if (amount === null || !symbol) return null;

  return `${isPositive ? "+" : "-"}${formatAssetAmount(amount)} ${symbol}`;
}

function getNotificationCategory(
  notification: Notification,
): NotificationCategory {
  const text = getNotificationSearchText(notification);

  if (
    text.includes("announcement") ||
    text.includes("news") ||
    text.includes("update") ||
    text.includes("campaign")
  ) {
    return "Announcement";
  }

  if (
    text.includes("security") ||
    text.includes("login") ||
    text.includes("kyc") ||
    text.includes("verification") ||
    text.includes("device") ||
    text.includes("system")
  ) {
    return "System";
  }

  return "Transactions";
}

function getNotificationDisplay(
  notification: Notification,
  transactionById: Map<string, Transaction>,
): NotificationDisplay {
  const text = getNotificationSearchText(notification);
  const category = getNotificationCategory(notification);
  const rawTitle = notification.subject || notification.type || "Notification";
  const rawContent = notification.content || null;
  const transaction = getNotificationTransaction(notification, transactionById);

  if (transaction) {
    const isPositive = isPositiveTransaction(transaction.type);

    return {
      category: "Transactions",
      icon: isPositive ? "↙" : "↗",
      title: getTransactionTitle(transaction),
      content: rawContent,
      amountLabel: getTransactionAmountLabel(transaction),
      statusLabel: getTransactionStatusLabel(transaction.status),
      statusClassName: getTransactionStatusClasses(transaction.status),
      transactionId: transaction.id,
    };
  }

  const transactionType = normalizeTransactionType(notification);
  const symbol =
    getMetadataValue(notification, [
      "symbol",
      "asset",
      "token",
      "toAsset",
      "assetSymbol",
      "crypto",
    ])?.toUpperCase() || null;
  const isTransactionNotification =
    text.includes("transaction") ||
    text.includes("transfer") ||
    text.includes("send") ||
    text.includes("receive") ||
    text.includes("received") ||
    text.includes("deposit") ||
    text.includes("withdraw") ||
    text.includes("buy") ||
    text.includes("onramp") ||
    text.includes("offramp") ||
    Boolean(symbol);
  const isPositiveNotification =
    transactionType === "BUY" ||
    transactionType === "DEPOSIT" ||
    transactionType === "TRANSFER_IN" ||
    text.includes("receive") ||
    text.includes("received") ||
    text.includes("buy") ||
    text.includes("onramp");
  const amountLabel = getNotificationAmountLabel(
    notification,
    symbol,
    isPositiveNotification,
  );
  const statusDisplay = getNotificationStatusDisplay(notification);
  const transactionId = getTransactionIdFromNotification(notification);

  if (isTransactionNotification) {
    const asset = symbol || "stablecoin";
    const isBuy =
      transactionType === "BUY" ||
      text.includes("buy") ||
      text.includes("onramp") ||
      text.includes("stable") ||
      (text.includes("ngn") && text.includes("deposit"));

    if (isBuy) {
      return {
        category: "Transactions",
        icon: "₦",
        title: asset === "stablecoin" ? "Stablecoin purchase" : `Buy ${asset}`,
        content:
          rawContent && !rawContent.toLowerCase().includes("ngn deposit")
            ? rawContent
            : `Your NGN payment is being used to buy ${asset}.`,
        amountLabel,
        transactionId,
        ...statusDisplay,
      };
    }

    if (
      transactionType === "TRANSFER_OUT" ||
      transactionType === "SELL" ||
      transactionType === "WITHDRAW" ||
      text.includes("transfer") ||
      text.includes("send") ||
      text.includes("withdraw")
    ) {
      return {
        category: "Transactions",
        icon: "↗",
        title: symbol ? `${symbol} sent` : "Transfer sent",
        content: rawContent,
        amountLabel,
        transactionId,
        ...statusDisplay,
      };
    }

    return {
      category: "Transactions",
      icon: "↙",
      title: symbol ? `${symbol} received` : "Transfer received",
      content: rawContent,
      amountLabel,
      transactionId,
      ...statusDisplay,
    };
  }

  if (category === "System") {
    return {
      category,
      icon: "✓",
      title: rawTitle,
      content: rawContent,
    };
  }

  if (category === "Announcement") {
    return {
      category,
      icon: "!",
      title: rawTitle,
      content: rawContent,
    };
  }

  return {
    category,
    icon: "•",
    title: rawTitle,
    content: rawContent,
  };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-4 dark:border-white/10 dark:bg-secondary-50"
        >
          <div className="h-9 w-9 shrink-0 rounded-full bg-primary-95 dark:bg-primary-70/15" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3.5 w-3/4 rounded-full bg-primary-95 dark:bg-secondary-60" />
            <div className="h-2.5 w-full rounded-full bg-gray-95 dark:bg-secondary-60" />
            <div className="h-2.5 w-1/3 rounded-full bg-primary-95 dark:bg-secondary-60" />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Notification Item ────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  display: NotificationDisplay;
  onOpen: (notification: Notification, display: NotificationDisplay) => void;
}

function NotificationItem({
  notification,
  display,
  onOpen,
}: NotificationItemProps) {
  const isUnread = !notification.readAt;

  return (
    <button
      type="button"
      onClick={() => onOpen(notification, display)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all",
        isUnread
          ? "border-primary-90/80 bg-primary-99/80 dark:border-primary-70/20 dark:bg-primary-70/10"
          : "border-black/5 bg-white hover:border-primary-90 hover:bg-primary-99/60 dark:border-white/10 dark:bg-secondary-50 dark:hover:border-primary-80/30 dark:hover:bg-secondary-60/50",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          isUnread
            ? "bg-primary-95 text-primary-50 dark:bg-primary-70/20 dark:text-primary-80"
            : "bg-gray-90 text-gray-20 dark:bg-secondary-60 dark:text-gray-40",
        )}
      >
        {display.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              "min-w-0 truncate text-sm leading-snug",
              isUnread
                ? "font-semibold text-black dark:text-white"
                : "font-medium text-gray-10 dark:text-gray-40",
            )}
          >
            {display.title}
          </p>

          <span className="shrink-0 text-xs font-medium text-gray-30 dark:text-gray-40">
            <HydrationSafeRelativeTime value={notification.createdAt} />
          </span>
        </div>

        {display.content && (
          <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-gray-20 dark:text-gray-40">
            {display.content}
          </p>
        )}
      </div>

      {isUnread && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary-60 dark:bg-primary-80" />
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const [isMarkAllModalOpen, setIsMarkAllModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<{
    notification: Notification;
    display: NotificationDisplay;
  } | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<NotificationCategoryFilter>("All");
  const { data: notifications = [], isLoading, error } = useNotifications();
  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const response = await transactionService.getTransactions();
      return response.data || [];
    },
    staleTime: 1000 * 60,
  });
  const { mutate: markAsRead } = useMarkAsRead();
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllAsRead();

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const hasUnread = unreadCount > 0;
  const transactionById = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );
  const notificationItems = notifications.map((notification) => ({
    notification,
    display: getNotificationDisplay(notification, transactionById),
  }));
  const filteredNotificationItems =
    activeCategory === "All"
      ? notificationItems
      : notificationItems.filter(
          ({ display }) => display.category === activeCategory,
        );

  const handleMarkAsRead = (id: string) => {
    markAsRead(id, {
      onError: () => toast.error("Failed to mark notification as read"),
    });
  };

  const handleOpenNotification = (
    notification: Notification,
    display: NotificationDisplay,
  ) => {
    setSelectedNotification({ notification, display });

    if (!notification.readAt) {
      handleMarkAsRead(notification.id);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead(undefined, {
      onSuccess: () => {
        setIsMarkAllModalOpen(false);
        toast.success("Marked as read");
      },
      onError: () => toast.error("Failed to mark all as read"),
    });
  };

  return (
    <section className="container mx-auto flex h-[100dvh] max-w-4xl flex-col overflow-hidden px-4 pb-0 pt-4 md:px-6 md:pb-12 md:pt-20">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="cursor-pointer rounded-full border border-gray-80 bg-white/85 p-2 shadow-sm backdrop-blur transition-all hover:bg-white dark:border-white/10 dark:bg-secondary-50/70 dark:hover:bg-secondary-60/50"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-lg font-semibold text-black dark:text-white md:text-2xl">
            Notifications{!isLoading ? ` (${notifications.length})` : ""}
          </h1>
          {hasUnread && !isLoading && (
            <span className="text-[10px] font-medium text-primary-60 dark:text-primary-80">
              {unreadCount} unread
            </span>
          )}
        </div>

        <ActionToolTip
          label="Mark all as read"
          side="left"
          disabled={!hasUnread || isMarkingAll}
        >
          <button
            type="button"
            onClick={() => setIsMarkAllModalOpen(true)}
            disabled={!hasUnread || isMarkingAll}
            aria-label="Mark all as read"
            className={cn(
              "cursor-pointer rounded-full border border-gray-80 bg-white/85 p-2 shadow-sm backdrop-blur transition-all dark:border-white/10 dark:bg-secondary-50/70",
              hasUnread && !isMarkingAll
                ? "text-primary-50 hover:bg-white dark:text-primary-80 dark:hover:bg-secondary-60/50"
                : "cursor-not-allowed text-primary-90 opacity-50 dark:text-primary-80/40",
            )}
          >
            <Paintbrush className="h-5 w-5" />
          </button>
        </ActionToolTip>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_FILTERS.map((category) => {
          const isActive = activeCategory === category;

          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={cn(
                "cursor-pointer",
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                isActive
                  ? "border-primary-90 bg-primary-95 text-primary-50 dark:border-primary-70/20 dark:bg-primary-70/15 dark:text-primary-80"
                  : "border-gray-80 bg-white/80 text-gray-20 hover:text-cryptoNight dark:border-white/10 dark:bg-secondary-50/70 dark:text-gray-40 dark:hover:text-white",
              )}
            >
              {category}
            </button>
          );
        })}
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-3">
          {isLoading ? (
            <NotificationSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-black/5 bg-white py-12 dark:border-white/10 dark:bg-secondary-50">
              <div className="mb-3 rounded-full bg-primary-95 p-3 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
                <Bell className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-cryptoNight dark:text-white">
                Failed to load notifications
              </p>
              <p className="mt-1 text-xs text-gray-20 dark:text-gray-40">
                {error instanceof Error
                  ? error.message
                  : "Something went wrong"}
              </p>
            </div>
          ) : filteredNotificationItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-black/5 bg-white py-16 dark:border-white/10 dark:bg-secondary-50">
              <div className="mb-3 rounded-full bg-primary-95 p-4 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
                <Bell className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-cryptoNight dark:text-white">
                {notifications.length === 0
                  ? "No notifications yet"
                  : `No ${activeCategory.toLowerCase()} notifications`}
              </p>
              <p className="mt-1 text-xs text-gray-20 dark:text-gray-40">
                {notifications.length === 0
                  ? "We'll notify you about important activity"
                  : "Try another category."}
              </p>
            </div>
          ) : (
            filteredNotificationItems.map(({ notification, display }) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                display={display}
                onOpen={handleOpenNotification}
              />
            ))
          )}
        </div>
      </div>

      <MarkNotificationsReadModal
        isOpen={isMarkAllModalOpen}
        isConfirming={isMarkingAll}
        onClose={setIsMarkAllModalOpen}
        onConfirm={handleMarkAllAsRead}
      />

      <NotificationDetailModal
        isOpen={Boolean(selectedNotification)}
        notification={selectedNotification?.notification ?? null}
        display={selectedNotification?.display ?? null}
        onClose={(open) => {
          if (!open) setSelectedNotification(null);
        }}
      />
    </section>
  );
}
