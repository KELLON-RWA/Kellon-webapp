import {
  getCurrencyDecimals,
  getCurrencySymbol,
} from "@/lib/country-currency-map";
import { formatNumber } from "@/lib/format-number";
import type { Asset, Transaction } from "@/types/db";

export const ASSET_LABELS: Record<string, string> = {
  USDC: "USD Coin",
  USDT: "Tether USD",
};

export const DEFAULT_TOKEN_PRICE = 1;

export function parseAssetAmount(amount: Asset["amount"]): number {
  const parsed = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrencyAmount(value: number, currency: string): string {
  const decimals = getCurrencyDecimals(currency);
  const symbol = getCurrencySymbol(currency);
  const absoluteValue = Math.abs(value);
  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(absoluteValue);

  return `${value < 0 ? "-" : ""}${symbol}${formattedNumber}`;
}

export function formatAssetAmount(value: number): string {
  return formatNumber(value, {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: 6,
  });
}

export function getAssetName(symbol: string): string {
  return ASSET_LABELS[symbol] || symbol;
}

export function formatRelativeDate(value: Date | string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getTransactionAction(type: Transaction["type"]): string {
  switch (type) {
    case "BUY":
    case "DEPOSIT":
      return "Buy";
    case "TRANSFER_IN":
      return "Received";
    case "TRANSFER_OUT":
      return "Sent";
    default:
      return type.charAt(0) + type.slice(1).toLowerCase();
  }
}

export function isPositiveTransaction(type: Transaction["type"]): boolean {
  return ["DEPOSIT", "BUY", "TRANSFER_IN"].includes(type);
}

function getMetadataSymbol(metadata: Transaction["metadata"]): string | null {
  const symbol =
    metadata?.cryptoCurrencyCode ||
    metadata?.cryptoCurrency ||
    metadata?.token ||
    metadata?.asset ||
    metadata?.toAsset ||
    metadata?.targetAsset;

  return typeof symbol === "string" && symbol.trim()
    ? symbol.toUpperCase()
    : null;
}

function getMetadataStringValue(
  metadata: Transaction["metadata"],
  keys: string[],
): string | null {
  if (!metadata || typeof metadata !== "object") return null;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function parseNumberValue(value: unknown): number | null {
  const parsed =
    typeof value === "string" || typeof value === "number" ? Number(value) : NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function getMetadataNumberValue(
  metadata: Transaction["metadata"],
  keys: string[],
): number | null {
  if (!metadata || typeof metadata !== "object") return null;

  for (const key of keys) {
    const parsed = parseNumberValue(metadata[key]);
    if (parsed !== null) return parsed;
  }

  return null;
}

export function getTransactionSymbol(transaction: Transaction): string {
  const metadata = transaction.metadata;
  const provider = metadata?.provider?.toLowerCase();

  if (transaction.type === "BUY") {
    return getMetadataSymbol(metadata) || transaction.symbol;
  }

  switch (provider) {
    case "paycrest":
      return getMetadataSymbol(metadata) || transaction.symbol;
    case "centiiv":
      return getMetadataSymbol(metadata) || transaction.symbol;
    default:
      return transaction.symbol;
  }
}

export function getProviderAmount(transaction: Transaction): number | null {
  const metadata = transaction.metadata;
  const provider = metadata?.provider?.toLowerCase();

  switch (provider) {
    case "paycrest": {
      const paycrestAmount = metadata?.paycrestResponse?.amount;
      const parsedAmount = parseNumberValue(paycrestAmount);
      if (parsedAmount !== null) return parsedAmount;
      break;
    }
    case "centiiv": {
      const centiivAmount = metadata?.centiivResponse?.receivableAmount;
      const parsedAmount = parseNumberValue(centiivAmount);
      if (parsedAmount !== null) return parsedAmount;
      break;
    }
    default:
      return null;
  }

  return null;
}

function parseTransactionAmount(amount: Transaction["amount"]): number | null {
  return parseNumberValue(amount);
}

function getTransactionMetadataAmount(transaction: Transaction): number | null {
  return getMetadataNumberValue(transaction.metadata, [
    "cryptoAmount",
    "sendAmount",
    "assetAmount",
    "tokenAmount",
  ]);
}

function getTransactionDisplayAmount(transaction: Transaction): number | null {
  const metadataAmount = getTransactionMetadataAmount(transaction);
  if (metadataAmount !== null) return metadataAmount;

  const providerAmount = getProviderAmount(transaction);
  if (providerAmount !== null) return providerAmount;

  if (
    [
      "BUY",
      "DEPOSIT",
      "SELL",
      "WITHDRAW",
      "TRANSFER_IN",
      "TRANSFER_OUT",
    ].includes(transaction.type)
  ) {
    return parseTransactionAmount(transaction.amount);
  }

  return null;
}

function getTransactionFiatCurrency(transaction: Transaction): string | null {
  return getMetadataStringValue(transaction.metadata, [
    "receiveCurrency",
    "fiatCurrency",
    "currency",
  ])?.toUpperCase() || null;
}

export function getTransactionTitle(transaction: Transaction): string {
  const action = getTransactionAction(transaction.type);
  const symbol = getTransactionSymbol(transaction);

  if (transaction.type === "WITHDRAW") {
    const fiatCurrency = getTransactionFiatCurrency(transaction);
    return `${fiatCurrency || symbol} Withdrawal`;
  }

  if (action === "Buy") {
    return `Buy ${symbol}`;
  }

  return `${symbol} ${action}`;
}

export function getTransactionAmountLabel(transaction: Transaction): string {
  const amount = getTransactionDisplayAmount(transaction);
  const symbol = getTransactionSymbol(transaction);

  if (amount === null) {
    return `-- ${symbol}`;
  }

  const prefix = isPositiveTransaction(transaction.type) ? "+" : "-";
  return `${prefix}${formatAssetAmount(amount)} ${symbol}`;
}

export function getTransactionStatusLabel(
  status: Transaction["status"],
): string {
  switch (status) {
    case "COMPLETED":
    case "PAID":
      return "Successful";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    case "PENDING":
      return "Pending";
    case "REFUNDED":
      return "Refunded";
    default:
      return status.charAt(0) + status.slice(1).toLowerCase();
  }
}

export function getTransactionStatusClasses(
  status: Transaction["status"],
): string {
  switch (status) {
    case "COMPLETED":
    case "PAID":
      return "text-emerald-600 dark:text-emerald-400";
    case "FAILED":
      return "text-red-500 dark:text-red-400";
    case "CANCELLED":
    case "REFUNDED":
      return "text-gray-500 dark:text-gray-400";
    case "PENDING":
      return "text-primary-60 dark:text-primary-80";
    default:
      return "text-primary-60 dark:text-primary-80";
  }
}
