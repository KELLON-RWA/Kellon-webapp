import type { Transaction } from "@/types/db";
import { getChainLabel } from "@/lib/chains";
import {
  getCurrencyDecimals,
  getCurrencySymbol,
} from "@/lib/country-currency-map";
import {
  getStockTransactionFiatAmount,
  getStockTransactionShares,
  getTransactionDisplayAmount,
  getTransactionFiatAmount,
  getTransactionHash,
  getTransactionOperation,
  getTransactionSymbol,
  getTransactionTitle,
  isStockTransaction,
} from "@/lib/dashboard-utils";
import {
  extractTransactionBankDetails,
  getNestedProviderNumber,
} from "@/lib/transaction-detail-metadata";

export function formatAssetAmount(value: number): string {
  value = Math.abs(value);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: 6,
  }).format(value);
}

export function formatFiatAmount(value: number, currency: string): string {
  const decimals = getCurrencyDecimals(currency);
  const symbol = getCurrencySymbol(currency);

  return `${symbol}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value))}`;
}

export function formatPaidAmount(transaction: Transaction): string | null {
  const fiatAmount = getTransactionFiatAmount(transaction);

  if (fiatAmount === null) return null;

  return formatFiatAmount(fiatAmount, getFiatCurrency(transaction));
}

export function getFiatCurrency(transaction: Transaction): string {
  if (isStockTransaction(transaction)) return "USD";
  const metadata = getTransactionMetadata(transaction);

  return (
    getStringMetadataValue(metadata, [
      "fiatCurrency",
      "receiveCurrency",
      "currency",
      "localCurrency",
    ]) || "NGN"
  ).toUpperCase();
}

export function getFiatReceivedAmount(transaction: Transaction): number | null {
  const metadata = getTransactionMetadata(transaction);

  const directAmount = getNumericMetadataValue(metadata, [
    "settledFiat",
    "orderNetFiat",
    "receiveAmount",
    "estimatedFiatAmount",
    "fiatPayoutAmount",
    "amountReceived",
    "fiatAmount",
  ]);
  if (directAmount !== null) return directAmount;

  if (transaction.type === "WITHDRAW" || transaction.type === "SELL") {
    return getNestedProviderNumber(metadata, "centiivResponse", [
      "receivableAmount",
      "nairaValue",
    ]);
  }

  return null;
}

function getTransactionRate(transaction: Transaction): number | null {
  const metadata = getTransactionMetadata(transaction);

  return (
    getNumericMetadataValue(metadata, ["rate", "rawRate", "exchangeRate"]) ??
    getNestedProviderNumber(metadata, "centiivResponse", ["rate"])
  );
}

function getTransactionFee(transaction: Transaction): number | null {
  const metadata = getTransactionMetadata(transaction);

  return (
    getNumericMetadataValue(metadata, [
      "fee",
      "fees",
      "feeAmount",
      "providerFee",
    ]) ?? getNestedProviderNumber(metadata, "centiivResponse", ["fee"])
  );
}

export function getTransactionNetwork(transaction: Transaction): string {
  const transactionWithChain = transaction as Transaction & {
    chain?: string | null;
    network?: string | null;
  };
  const metadata = getTransactionMetadata(transaction);
  const provider =
    typeof metadata.provider === "string"
      ? metadata.provider.toLowerCase()
      : null;
  const chain =
    transactionWithChain.chain ||
    transactionWithChain.network ||
    getStringMetadataValue(metadata, [
      "chain",
      "network",
      "networkName",
      "selectedChain",
      "fundingChain",
      "settlementChain",
      "fromChain",
    ]);

  switch (provider) {
    case "paycrest":
      return getChainLabel(
        getStringMetadataValue(metadata, ["network"]) || chain,
      );
    case "centiiv":
      return getChainLabel(
        getStringMetadataValue(metadata, ["chain"]) || chain,
      );
    default:
      return chain ? getChainLabel(chain) : "Unknown";
  }
}

export function getTransactionMetadata(
  transaction: Transaction,
): Record<string, unknown> {
  return transaction.metadata && typeof transaction.metadata === "object"
    ? (transaction.metadata as Record<string, unknown>)
    : {};
}

function getStringMetadataValue(
  metadata: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function getNumericMetadataValue(
  metadata: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = metadata[key];
    if (value === "" || (typeof value === "string" && !value.trim())) continue;
    const parsed =
      typeof value === "string" || typeof value === "number"
        ? Number(value)
        : NaN;

    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function getBankDetailRows(
  transaction: Transaction,
  resolvedBankName?: string | null,
): DetailRow[] {
  const metadata = getTransactionMetadata(transaction);
  const { bankName, bankCode, accountName, accountNumber } =
    extractTransactionBankDetails(metadata);
  const displayBankName = bankName || resolvedBankName;

  return [
    displayBankName
      ? { label: "Bank Name", value: displayBankName }
      : bankCode
        ? { label: "Bank Code", value: bankCode }
        : null,
    accountName ? { label: "Account Name", value: accountName } : null,
    accountNumber ? { label: "Account Number", value: accountNumber } : null,
  ].filter(Boolean) as DetailRow[];
}

function getRecipientDetailRows(transaction: Transaction): DetailRow[] {
  const metadata = getTransactionMetadata(transaction);
  const tag = getStringMetadataValue(metadata, ["recipientTag"]);
  const email = getStringMetadataValue(metadata, ["recipientEmail"]);
  const address = getStringMetadataValue(metadata, [
    "recipientAddress",
    "address",
  ]);
  const method = getStringMetadataValue(metadata, ["recipientMethod"]);
  const addressType = getStringMetadataValue(metadata, [
    "recipientAddressType",
  ]);

  const rows: DetailRow[] = [];

  if (method === "tag" && tag) {
    rows.push({ label: "Tag", value: tag });
  } else if (method === "email" && email) {
    rows.push({ label: "Email", value: email });
  } else if ((addressType === "evm" || addressType === "stellar") && address) {
    rows.push({ label: "Address", value: address, copyable: true, mono: true });
  } else {
    // Fallback for older transactions that might not have method/addressType
    if (tag) {
      rows.push({ label: "Tag", value: tag });
    } else if (email) {
      rows.push({ label: "Email", value: email });
    } else if (address) {
      rows.push({
        label: "Address",
        value: address,
        copyable: true,
        mono: true,
      });
    }
  }

  return rows;
}

export interface DetailRow {
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
}

export interface DetailSection {
  title?: string;
  rows: DetailRow[];
}

export function buildTransactionDetailSections(
  transaction: Transaction,
  amountValue: number | null,
  symbol: string,
  transactionNetwork: string,
  resolvedBankName?: string | null,
): DetailSection[] {
  if (isStockTransaction(transaction))
    amountValue = getStockTransactionShares(transaction);
  const metadata = getTransactionMetadata(transaction);
  const fiatCurrency = getFiatCurrency(transaction);
  const rate = getTransactionRate(transaction);
  const fee = getTransactionFee(transaction);
  const fiatReceived = getFiatReceivedAmount(transaction);
  const amountText =
    amountValue === null
      ? `Unavailable ${symbol}`
      : `${formatAssetAmount(amountValue)} ${symbol}`;
  const operation = getTransactionOperation(transaction);
  const isStock = isStockTransaction(transaction);
  const methodLabel = getTransactionTitle(transaction);
  const paidAmount = formatPaidAmount(transaction);

  const baseRows: DetailRow[] = [{ label: "Method", value: methodLabel }];

  if (amountValue === null && paidAmount && !isStock) {
    baseRows.push({ label: "Amount paid", value: paidAmount });
  } else {
    const amountLabel = isStock
      ? transaction.type === "SELL"
        ? "Shares sold"
        : "Shares bought"
      : operation === "stake"
        ? "Amount deposited"
        : operation === "unstake"
          ? "Amount withdrawn"
          : operation === "swap"
            ? "Amount swapped"
            : "Amount";
    baseRows.push({
      label: amountLabel,
      value: amountText,
    });
  }

  if (isStock) {
    const orderValue = getStockTransactionFiatAmount(transaction);
    if (orderValue !== null) {
      baseRows.push({
        label: transaction.type === "SELL" ? "Sale proceeds" : "Amount paid",
        value: formatFiatAmount(orderValue, "USD"),
      });
    }
  } else if (operation === "withdraw" && fiatReceived !== null) {
    baseRows.push({
      label:
        getNumericMetadataValue(metadata, ["settledFiat"]) !== null
          ? "Bank payout confirmed"
          : "Expected bank payout",
      value: formatFiatAmount(fiatReceived, fiatCurrency),
    });
    const quoted = getNumericMetadataValue(metadata, ["quotedNetFiat"]);
    if (
      quoted !== null &&
      quoted > 0 &&
      Math.abs(quoted - fiatReceived) >= 0.01
    ) {
      baseRows.push({
        label: "Originally quoted",
        value: formatFiatAmount(quoted, fiatCurrency),
      });
    }
  } else if (["buy", "deposit"].includes(operation)) {
    if (paidAmount && amountValue !== null) {
      baseRows.push({ label: "Amount Paid", value: paidAmount });
    }
  } else if (transaction.type === "SELL" && fiatReceived !== null) {
    baseRows.push({
      label: "Amount Received",
      value: formatFiatAmount(fiatReceived, fiatCurrency),
    });
  }

  if (fee !== null) {
    const feeCurrency =
      getStringMetadataValue(metadata, ["feeCurrency"]) ||
      symbol ||
      fiatCurrency;
    const isFiatFee = feeCurrency === fiatCurrency;
    baseRows.push({
      label: "Fee",
      value: isFiatFee
        ? formatFiatAmount(fee, fiatCurrency)
        : `${formatAssetAmount(fee)} ${feeCurrency}`,
    });
  }

  if (operation === "bridge") {
    const fromChain = getStringMetadataValue(metadata, [
      "fromChain",
      "chain",
      "network",
    ]);
    const toChain = getStringMetadataValue(metadata, ["toChain"]);
    if (fromChain)
      baseRows.push({ label: "From network", value: getChainLabel(fromChain) });
    if (toChain)
      baseRows.push({ label: "To network", value: getChainLabel(toChain) });
    if (!fromChain && transactionNetwork && transactionNetwork !== "Unknown") {
      baseRows.push({ label: "From network", value: transactionNetwork });
    }
  } else if (transactionNetwork && transactionNetwork !== "Unknown") {
    baseRows.push({ label: "Network", value: transactionNetwork });
  }

  if (
    rate !== null &&
    ["buy", "deposit", "withdraw", "sell"].includes(operation) &&
    !isStock
  ) {
    baseRows.push({
      label: "Rate",
      value: `${formatFiatAmount(rate, fiatCurrency)} / ${symbol}`,
    });
  }

  const transactionHash = getTransactionHash(transaction);
  if (transactionHash) {
    baseRows.push({
      label: "Transaction hash",
      value: transactionHash,
      copyable: true,
      mono: true,
    });
  }

  baseRows.push({
    label: "Reference ID",
    value: transaction.id,
    copyable: true,
    mono: true,
  });

  const sections: DetailSection[] = [{ rows: baseRows }];
  const bankRows = getBankDetailRows(transaction, resolvedBankName);
  const recipientRows = getRecipientDetailRows(transaction);

  if (
    ["withdraw", "buy", "deposit", "sell"].includes(operation) &&
    !isStock &&
    bankRows.length > 0
  ) {
    sections.push({ title: "Account Details", rows: bankRows });
  }

  if (transaction.type === "TRANSFER_OUT" && recipientRows.length > 0) {
    sections.push({ title: "Recipient", rows: recipientRows });
  }

  if (operation === "stake" || operation === "unstake") {
    const protocol = getStringMetadataValue(metadata, ["protocol", "provider"]);
    if (protocol)
      sections.push({
        title: "Yield position",
        rows: [{ label: "Protocol", value: protocol }],
      });
  }

  if (transaction.type === "TRANSFER_IN") {
    const senderTag = getStringMetadataValue(metadata, ["senderTag"]);
    const senderAddress = getStringMetadataValue(metadata, [
      "senderAddress",
      "fromAddress",
    ]);
    if (senderTag || senderAddress) {
      sections.push({
        title: "Sender",
        rows: [
          {
            label: senderTag ? "Tag" : "Address",
            value: senderTag || senderAddress!,
            mono: !senderTag,
          },
        ],
      });
    }
  }

  return sections;
}

export function getTransactionReceiptAmountLabel(
  transaction: Transaction,
): string {
  const amount = getTransactionReceiptAmount(transaction);
  const symbol = getTransactionSymbol(transaction);
  if (amount === null) {
    if (isStockTransaction(transaction)) {
      const value = getStockTransactionFiatAmount(transaction);
      return value === null
        ? `Unavailable ${symbol}`
        : formatFiatAmount(value, "USD");
    }
    return formatPaidAmount(transaction) || `Unavailable ${symbol}`;
  }
  return `${formatAssetAmount(amount)} ${symbol}`;
}

export function getTransactionReceiptAmount(
  transaction: Transaction,
): number | null {
  if (isStockTransaction(transaction))
    return getStockTransactionShares(transaction);

  if (getTransactionOperation(transaction) === "withdraw") {
    const cryptoAmount = getNumericMetadataValue(
      getTransactionMetadata(transaction),
      ["cryptoAmount", "assetAmount", "tokenAmount", "sendAmount"],
    );
    if (cryptoAmount !== null) return cryptoAmount;
    const amount = Number(transaction.amount);
    return String(transaction.amount).trim() && Number.isFinite(amount)
      ? amount
      : null;
  }

  if (transaction.type === "SWAP") {
    const amount = Number(transaction.amount);
    return String(transaction.amount).trim() && Number.isFinite(amount)
      ? amount
      : null;
  }

  return getTransactionDisplayAmount(transaction);
}

export function escapeReceiptHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

export function getReceiptPdfImageSize(
  canvasWidth: number,
  canvasHeight: number,
) {
  const scale = Math.min(190 / canvasWidth, 277 / canvasHeight);
  return { width: canvasWidth * scale, height: canvasHeight * scale };
}
