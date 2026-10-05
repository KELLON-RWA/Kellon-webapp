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

export const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT"]);

export function isStablecoinSymbol(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.has(symbol.trim().toUpperCase());
}

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
      return "Buy";
    case "DEPOSIT":
      return "Deposit";
    case "TRANSFER_IN":
      return "Received";
    case "TRANSFER_OUT":
      return "Sent";
    case "BRIDGE":
      return "Bridge";
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

function getNestedMetadataNumberValue(
  metadata: Transaction["metadata"],
  parentKeys: string[],
  keys: string[],
): number | null {
  if (!metadata || typeof metadata !== "object") return null;

  for (const parentKey of parentKeys) {
    const parent = metadata[parentKey];
    if (!parent || typeof parent !== "object" || Array.isArray(parent)) continue;

    const amount = getMetadataNumberValue(
      parent as Transaction["metadata"],
      keys,
    );
    if (amount !== null) return amount;
  }

  return null;
}

function getDeepMetadataValue(
  metadata: Transaction["metadata"],
  keys: string[],
  maxDepth = 4,
): unknown {
  if (!metadata || typeof metadata !== "object" || maxDepth < 0) return null;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      const value = metadata[key];
      if (value !== null && value !== undefined && value !== "") return value;
    }
  }

  for (const value of Object.values(metadata)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const nestedValue = getDeepMetadataValue(
      value as Transaction["metadata"],
      keys,
      maxDepth - 1,
    );
    if (nestedValue !== null) return nestedValue;
  }

  return null;
}

function getDeepMetadataNumberValue(
  metadata: Transaction["metadata"],
  keys: string[],
  maxDepth = 4,
): number | null {
  return parseNumberValue(getDeepMetadataValue(metadata, keys, maxDepth));
}

function getProviderName(transaction: Transaction): string | null {
  const provider = getDeepMetadataValue(transaction.metadata, [
    "provider",
    "providerName",
    "paymentProvider",
    "onrampProvider",
  ]);

  return typeof provider === "string" && provider.trim()
    ? provider.trim().toLowerCase()
    : null;
}

export function getTransactionSymbol(transaction: Transaction): string {
  const metadata = transaction.metadata;
  const provider = getProviderName(transaction);

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

/**
 * Stock orders store the order's USD total in `amount`; the purchased or sold
 * share quantity lives in metadata. Keep that distinction here so every
 * activity surface reports the same asset movement.
 */
export function isStockTransaction(transaction: Transaction): boolean {
  if (!["BUY", "SELL"].includes(transaction.type)) return false;
  if (transaction.assetType === "RWA") return true;

  return (
    getDeepMetadataValue(transaction.metadata, [
      "shares",
      "stockShares",
      "stockQuantity",
      "shareQuantity",
    ]) !== null &&
    getDeepMetadataValue(transaction.metadata, [
      "price",
      "stockPrice",
      "amountFiat",
      "cost",
      "proceeds",
    ]) !== null
  );
}

export function getStockTransactionShares(
  transaction: Transaction,
): number | null {
  if (!isStockTransaction(transaction)) return null;

  const shares = getDeepMetadataNumberValue(transaction.metadata, [
    "shares",
    "stockShares",
    "stockQuantity",
    "shareQuantity",
    "quantity",
    "units",
  ]);

  return shares !== null && shares >= 0 ? shares : null;
}

export function getStockTransactionFiatAmount(
  transaction: Transaction,
): number | null {
  if (!isStockTransaction(transaction)) return null;

  const value = getDeepMetadataNumberValue(
    transaction.metadata,
    transaction.type === "SELL"
      ? ["proceeds", "amountFiat", "value", "cost"]
      : ["cost", "amountFiat", "value", "proceeds"],
  );

  return value !== null && value >= 0 ? value : null;
}

export function getStockTransactionFiatLabel(
  transaction: Transaction,
): string | null {
  const amount = getStockTransactionFiatAmount(transaction);
  if (amount === null) return null;

  const prefix = transaction.type === "SELL" ? "+" : "-";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `$${prefix}${formatted}`;
}

export function getTransactionNetworkLabel(
  transaction: Transaction,
): string | null {
  const network = getDeepMetadataValue(transaction.metadata, [
    "fundingChain",
    "settlementChain",
    "chain",
    "network",
    "fromChain",
  ]);

  return typeof network === "string" && network.trim()
    ? network.trim().toLowerCase()
    : null;
}

export function getProviderAmount(transaction: Transaction): number | null {
  const metadata = transaction.metadata;
  const provider = getProviderName(transaction);
  const providerAmountKeys = [
    "cryptoAmount",
    "estimatedCryptoAmount",
    "estimatedReceivableAmount",
    "receivableCryptoAmount",
    "deliveredAmount",
    "creditedAmount",
    "providerAmount",
    "tokenAmount",
    "receivableAmount",
  ];

  switch (provider) {
    case "paycrest": {
      const amount = getDeepMetadataNumberValue(metadata, providerAmountKeys);
      if (amount !== null) return amount;

      const legacyAmount = getNestedMetadataNumberValue(
        metadata,
        ["paycrestResponse"],
        ["amount"],
      );
      if (legacyAmount !== null) return legacyAmount;
      break;
    }
    case "centiiv": {
      const amount = getDeepMetadataNumberValue(metadata, providerAmountKeys);
      if (amount !== null) return amount;
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

function getExplicitCryptoAmount(transaction: Transaction): number | null {
  const amountKeys = [
    "cryptoAmount",
    "estimatedCryptoAmount",
    "estimatedReceivableAmount",
    "receivableCryptoAmount",
    "receivableAmount",
    "receiveAmount",
    "amountReceived",
    "amount_received",
    "deliveredAmount",
    "creditedAmount",
    "providerAmount",
    "outputAmount",
    "amountOut",
    "toAmount",
    "quoteCurrencyAmount",
    "quotedAmount",
    "sendAmount",
    "assetAmount",
    "tokenAmount",
  ];
  const directAmount = getMetadataNumberValue(transaction.metadata, amountKeys);
  if (directAmount !== null) return directAmount;

  const nestedAmount = getNestedMetadataNumberValue(
    transaction.metadata,
    [
      "quote",
      "rateDetails",
      "providerQuote",
      "centiivResponse",
      "paycrestResponse",
      "order",
    ],
    amountKeys,
  );
  if (nestedAmount !== null) return nestedAmount;

  const deepAmount = getDeepMetadataNumberValue(
    transaction.metadata,
    amountKeys,
  );
  if (deepAmount !== null) return deepAmount;

  if (isStablecoinSymbol(getTransactionSymbol(transaction))) {
    return getDeepMetadataNumberValue(transaction.metadata, ["usdValue"]);
  }

  return null;
}

function getOnrampDerivedCryptoAmount(
  transaction: Transaction,
): number | null {
  if (!["BUY", "DEPOSIT"].includes(transaction.type)) return null;

  const fiatAmount = getTransactionFiatAmount(transaction);
  const rate = getDeepMetadataNumberValue(transaction.metadata, [
    "rate",
    "rawRate",
    "exchangeRate",
  ]);

  if (fiatAmount === null || fiatAmount <= 0 || rate === null || rate <= 0) {
    return null;
  }

  // Providers expose either fiat per token (for example 1,380 NGN/USDC)
  // or token per fiat (for example 0.000724 USDC/NGN).
  const amount = rate < 1 ? fiatAmount * rate : fiatAmount / rate;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function getTransactionFiatAmount(
  transaction: Transaction,
): number | null {
  const stockFiatAmount = getStockTransactionFiatAmount(transaction);
  if (stockFiatAmount !== null) return stockFiatAmount;

  return getDeepMetadataNumberValue(transaction.metadata, [
    "fiatAmount",
    "paidAmount",
    "amountPaid",
    "purchaseAmount",
    "amountToTransfer",
  ]);
}

function hasOnrampMetadata(transaction: Transaction): boolean {
  if (getProviderName(transaction)) return true;

  return (
    getDeepMetadataValue(transaction.metadata, [
      "fiatAmount",
      "paidAmount",
      "amountPaid",
      "purchaseAmount",
      "amountToTransfer",
      "fiatCurrency",
      "paymentReference",
      "onrampProvider",
    ]) !== null
  );
}

export function getTransactionDisplayAmount(
  transaction: Transaction,
): number | null {
  const stockShares = getStockTransactionShares(transaction);
  if (stockShares !== null) return stockShares;

  const metadataAmount = getExplicitCryptoAmount(transaction);
  if (metadataAmount !== null) return metadataAmount;

  const providerAmount = getProviderAmount(transaction);
  if (providerAmount !== null) return providerAmount;

  const derivedOnrampAmount = getOnrampDerivedCryptoAmount(transaction);
  if (derivedOnrampAmount !== null) return derivedOnrampAmount;

  const transactionAmount = parseTransactionAmount(transaction.amount);
  const fiatAmount = getTransactionFiatAmount(transaction);

  // Older on-ramp records store the fiat payment in `amount`. Do not label it
  // as crypto when the delivered amount cannot be recovered safely.
  if (
    ["BUY", "DEPOSIT"].includes(transaction.type) &&
    !isYieldTransaction(transaction) &&
    hasOnrampMetadata(transaction) &&
    (fiatAmount === null || transactionAmount === fiatAmount)
  ) {
    return null;
  }

  if (
    [
      "BUY",
      "DEPOSIT",
      "SELL",
      "WITHDRAW",
      "TRANSFER_IN",
      "TRANSFER_OUT",
      "BRIDGE",
    ].includes(transaction.type)
  ) {
    return transactionAmount;
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

export type TransactionOperation =
  | "buy"
  | "deposit"
  | "sell"
  | "withdraw"
  | "send"
  | "receive"
  | "bridge"
  | "swap"
  | "stake"
  | "unstake";

const YIELD_PROVIDERS = [
  "aave",
  "beefy",
  "blend",
  "jupiterlend",
  "kamino",
  "mento",
  "moonwell",
  "morpho",
  "venus",
];

function normalizeOperationHint(value: unknown): string {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z]/g, "")
    : "";
}

export function isYieldTransaction(transaction: Transaction): boolean {
  const hint = normalizeOperationHint(
    getDeepMetadataValue(transaction.metadata, [
      "action",
      "actionType",
      "operation",
      "stepType",
      "transactionType",
      "yieldAction",
    ]),
  );
  const executionMethod = normalizeOperationHint(transaction.executionMethod);
  const provider = getProviderName(transaction) || "";

  return (
    ["stake", "unstake", "supply", "deposityield", "withdrawyield", "redeem"].includes(hint) ||
    executionMethod.includes("yield") ||
    YIELD_PROVIDERS.some((name) => provider.includes(name)) ||
    getDeepMetadataValue(transaction.metadata, [
      "opportunityId",
      "yieldOpportunityId",
      "protocol",
    ]) !== null
  );
}

export function getTransactionOperation(
  transaction: Transaction,
): TransactionOperation {
  if (isYieldTransaction(transaction)) {
    return transaction.type === "WITHDRAW" ? "unstake" : "stake";
  }

  switch (transaction.type) {
    case "BUY":
      return "buy";
    case "DEPOSIT":
      return "deposit";
    case "SELL":
      return "sell";
    case "WITHDRAW":
      return "withdraw";
    case "TRANSFER_IN":
      return "receive";
    case "TRANSFER_OUT":
      return "send";
    case "BRIDGE":
      return "bridge";
    case "SWAP":
      return "swap";
    default:
      return "deposit";
  }
}

export function getTransactionTitle(transaction: Transaction): string {
  const operation = getTransactionOperation(transaction);
  const action = getTransactionAction(transaction.type);
  const symbol = getTransactionSymbol(transaction);

  if (operation === "stake") return `Stake ${symbol}`;
  if (operation === "unstake") return `Unstake ${symbol}`;

  if (transaction.type === "WITHDRAW") {
    const fiatCurrency = getTransactionFiatCurrency(transaction);
    return `${fiatCurrency || symbol} Withdrawal`;
  }

  if (transaction.type === "BRIDGE") {
    const metadata = transaction.metadata || {};
    const fromChain =
      typeof metadata.fromChain === "string"
        ? metadata.fromChain.toUpperCase()
        : typeof metadata.chain === "string"
          ? metadata.chain.toUpperCase()
          : "";
    const toChain =
      typeof metadata.toChain === "string" ? metadata.toChain.toUpperCase() : "";
    if (fromChain && toChain) {
      return `Bridge (${fromChain} → ${toChain})`;
    }
    return `Bridge ${symbol}`;
  }

  if (isStockTransaction(transaction)) {
    return `${action} ${symbol}`;
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
