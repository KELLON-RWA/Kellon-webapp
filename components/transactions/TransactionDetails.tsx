"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getChainLabel } from "@/lib/chains";
import {
  getCurrencyDecimals,
  getCurrencySymbol,
} from "@/lib/country-currency-map";
import { transactionService } from "@/services/api/transactions";
import type { Transaction } from "@/types/db";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface TransactionDetailsProps {
  id: string;
}

function formatAssetAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatFiatAmount(value: number, currency: string): string {
  const decimals = getCurrencyDecimals(currency);
  const symbol = getCurrencySymbol(currency);

  return `${symbol}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}`;
}

function formatDateTime(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getTransactionLabel(type: Transaction["type"]): string {
  switch (type) {
    case "TRANSFER_IN":
      return "Received";
    case "TRANSFER_OUT":
      return "Sent";
    default:
      return type.charAt(0) + type.slice(1).toLowerCase();
  }
}

function getTransactionStatusLabel(status: Transaction["status"]): string {
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

function getTransactionStatusBadgeClasses(
  status: Transaction["status"],
): string {
  switch (status) {
    case "COMPLETED":
    case "PAID":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "FAILED":
      return "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
    case "CANCELLED":
    case "REFUNDED":
      return "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300";
    case "PENDING":
    default:
      return "bg-primary-95 text-primary-60 dark:bg-primary-70/10 dark:text-primary-80";
  }
}

function isPositiveTransaction(type: Transaction["type"]): boolean {
  return ["DEPOSIT", "BUY", "TRANSFER_IN"].includes(type);
}

function formatPaidAmount(transaction: Transaction): string | null {
  const metadata = getTransactionMetadata(transaction);
  const fiatAmount = getNumericMetadataValue(metadata, [
    "fiatAmount",
    "paidAmount",
    "amountPaid",
    "purchaseAmount",
  ]);

  if (fiatAmount === null) return null;

  return formatFiatAmount(fiatAmount, getFiatCurrency(transaction));
}

function getPreferredCryptoSymbol(
  metadata: Record<string, unknown>,
): string | null {
  const value =
    getStringMetadataValue(metadata, ["cryptoCurrencyCode"]) ||
    getStringMetadataValue(metadata, ["cryptoCurrency"]) ||
    getStringMetadataValue(metadata, ["token"]) ||
    getStringMetadataValue(metadata, ["asset"]) ||
    getStringMetadataValue(metadata, ["toAsset"]) ||
    getStringMetadataValue(metadata, ["targetAsset"]);

  return value ? value.toUpperCase() : null;
}

function getTransactionSymbol(transaction: Transaction): string {
  const metadata = getTransactionMetadata(transaction);
  const provider =
    typeof metadata.provider === "string"
      ? metadata.provider.toLowerCase()
      : null;

  if (transaction.type === "BUY") {
    return getPreferredCryptoSymbol(metadata) || transaction.symbol;
  }

  switch (provider) {
    case "paycrest":
      return getPreferredCryptoSymbol(metadata) || transaction.symbol;
    case "centiiv":
      return getPreferredCryptoSymbol(metadata) || transaction.symbol;
    default:
      return transaction.symbol;
  }
}

function getProviderAmount(transaction: Transaction): number | null {
  const metadata = getTransactionMetadata(transaction);
  const provider =
    typeof metadata.provider === "string"
      ? metadata.provider.toLowerCase()
      : null;

  switch (provider) {
    case "paycrest": {
      const paycrestAmount = getNestedMetadataValue(
        metadata,
        "paycrestResponse",
        "amount",
      );
      if (paycrestAmount) {
        return parseFloat(String(paycrestAmount));
      }
      break;
    }
    case "centiiv": {
      const centiivAmount = getNestedMetadataValue(
        metadata,
        "centiivResponse",
        "receivableAmount",
      );
      if (centiivAmount) {
        return parseFloat(String(centiivAmount));
      }
      break;
    }
    default:
      return null;
  }

  return null;
}

function getMetadataCryptoAmount(transaction: Transaction): number | null {
  const metadata = getTransactionMetadata(transaction);

  return getNumericMetadataValue(metadata, [
    "cryptoAmount",
    "sendAmount",
    "assetAmount",
    "tokenAmount",
    "amount",
  ]);
}

function getFiatCurrency(transaction: Transaction): string {
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

function getFiatReceivedAmount(transaction: Transaction): number | null {
  const metadata = getTransactionMetadata(transaction);

  return getNumericMetadataValue(metadata, [
    "receiveAmount",
    "estimatedFiatAmount",
    "fiatPayoutAmount",
    "amountReceived",
    "fiatAmount",
  ]);
}

function getTransactionRate(transaction: Transaction): number | null {
  const metadata = getTransactionMetadata(transaction);

  return getNumericMetadataValue(metadata, ["rate", "rawRate", "exchangeRate"]);
}

function getTransactionFee(transaction: Transaction): number | null {
  const metadata = getTransactionMetadata(transaction);

  return getNumericMetadataValue(metadata, [
    "fee",
    "fees",
    "feeAmount",
    "providerFee",
  ]);
}

function parseTransactionAmount(amount: Transaction["amount"]): number | null {
  const parsed = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(parsed) ? parsed : null;
}

function getTransactionDisplayAmount(transaction: Transaction): number | null {
  const metadataAmount = getMetadataCryptoAmount(transaction);
  if (metadataAmount !== null) return metadataAmount;

  const providerAmount = getProviderAmount(transaction);
  if (providerAmount !== null) return providerAmount;

  if (
    ["TRANSFER_IN", "TRANSFER_OUT", "WITHDRAW", "SELL", "BUY", "DEPOSIT"].includes(
      transaction.type,
    )
  ) {
    return parseTransactionAmount(transaction.amount);
  }

  return null;
}

function getTransactionTitle(transaction: Transaction): string {
  const type = getTransactionLabel(transaction.type);
  const symbol = getTransactionSymbol(transaction);
  const fiatCurrency = getFiatCurrency(transaction);

  if (transaction.type === "WITHDRAW") {
    return `${fiatCurrency} Withdrawal`;
  }

  return `${symbol} ${type}`;
}

function getTransactionNetwork(transaction: Transaction): string {
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

function getTransactionMetadata(
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
    const parsed =
      typeof value === "string" || typeof value === "number"
        ? Number(value)
        : NaN;

    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function getNestedStringMetadataValue(
  metadata: Record<string, unknown>,
  parentKey: string,
  childKeys: string[],
): string | null {
  const parent = metadata[parentKey];

  if (!parent || typeof parent !== "object") return null;

  return getStringMetadataValue(parent as Record<string, unknown>, childKeys);
}

function getBankDetailRows(transaction: Transaction): DetailRow[] {
  const metadata = getTransactionMetadata(transaction);
  const bankName =
    getNestedStringMetadataValue(metadata, "bankDetail", ["bankName"]) ||
    getStringMetadataValue(metadata, ["bankName"]);
  const accountName =
    getNestedStringMetadataValue(metadata, "bankDetail", ["accountName"]) ||
    getStringMetadataValue(metadata, ["accountName"]);
  const accountNumber =
    getNestedStringMetadataValue(metadata, "bankDetail", ["accountNumber"]) ||
    getStringMetadataValue(metadata, ["accountNumber"]);

  return [
    bankName ? { label: "Bank Name", value: bankName } : null,
    accountName ? { label: "Account Name", value: accountName } : null,
    accountNumber ? { label: "Account Number", value: accountNumber } : null,
  ].filter(Boolean) as DetailRow[];
}

function getRecipientDetailRows(transaction: Transaction): DetailRow[] {
  const metadata = getTransactionMetadata(transaction);
  const tag = getStringMetadataValue(metadata, ["recipientTag"]);
  const email = getStringMetadataValue(metadata, ["recipientEmail"]);
  const address = getStringMetadataValue(metadata, ["recipientAddress", "address"]);
  const method = getStringMetadataValue(metadata, ["recipientMethod"]);
  const addressType = getStringMetadataValue(metadata, ["recipientAddressType"]);

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
      rows.push({ label: "Address", value: address, copyable: true, mono: true });
    }
  }
  
  return rows;
}

interface DetailRow {
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
}

interface DetailSection {
  title?: string;
  rows: DetailRow[];
}

function buildTransactionDetailSections(
  transaction: Transaction,
  amountValue: number | null,
  symbol: string,
  transactionNetwork: string,
): DetailSection[] {
  const metadata = getTransactionMetadata(transaction);
  const fiatCurrency = getFiatCurrency(transaction);
  const rate = getTransactionRate(transaction);
  const fee = getTransactionFee(transaction);
  const fiatReceived = getFiatReceivedAmount(transaction);
  const amountText =
    amountValue === null ? `-- ${symbol}` : `${formatAssetAmount(amountValue)} ${symbol}`;
  const methodLabel =
    transaction.type === "WITHDRAW"
      ? `${fiatCurrency} Withdrawal`
      : getTransactionTitle(transaction);

  const baseRows: DetailRow[] = [
    { label: "Method", value: methodLabel },
    { label: "Amount", value: amountText },
  ];

  if (transaction.type === "WITHDRAW" && fiatReceived !== null) {
    baseRows.push({
      label: "Amount Received",
      value: formatFiatAmount(fiatReceived, fiatCurrency),
    });
  } else if (transaction.type === "BUY") {
    const paidAmount = formatPaidAmount(transaction);
    if (paidAmount) {
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
      getStringMetadataValue(metadata, ["feeCurrency"]) || symbol || fiatCurrency;
    const isFiatFee = feeCurrency === fiatCurrency;
    baseRows.push({
      label: "Fee",
      value: isFiatFee
        ? formatFiatAmount(fee, fiatCurrency)
        : `${formatAssetAmount(fee)} ${feeCurrency}`,
    });
  }

  if (transactionNetwork && transactionNetwork !== "Unknown") {
    baseRows.push({ label: "Network", value: transactionNetwork });
  }

  if (rate !== null) {
    baseRows.push({
      label: "Rate",
      value: `${formatFiatAmount(rate, fiatCurrency)} / ${symbol}`,
    });
  }

  baseRows.push({
    label: "Reference ID",
    value: transaction.id,
    copyable: true,
    mono: true,
  });

  const sections: DetailSection[] = [{ rows: baseRows }];
  const bankRows = getBankDetailRows(transaction);
  const recipientRows = getRecipientDetailRows(transaction);

  if (bankRows.length > 0) {
    sections.push({ title: "Account Details", rows: bankRows });
  }

  if (transaction.type === "TRANSFER_OUT" && recipientRows.length > 0) {
    sections.push({ title: "Recipient", rows: recipientRows });
  }

  return sections;
}

function getNestedMetadataValue(
  metadata: Record<string, unknown>,
  parentKey: string,
  childKey: string,
): unknown {
  const parent = metadata[parentKey];

  if (!parent || typeof parent !== "object") {
    return null;
  }

  return (parent as Record<string, unknown>)[childKey] ?? null;
}

export default function TransactionDetails({ id }: TransactionDetailsProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["transaction", id],
    queryFn: async () => {
      const response = await transactionService.getTransaction(id);
      return response.data;
    },
  });

  const transaction = data;

  const amountValue = useMemo(() => {
    if (!transaction) return null;
    return getTransactionDisplayAmount(transaction);
  }, [transaction]);

  const symbol = useMemo(() => {
    if (!transaction) return "";
    return getTransactionSymbol(transaction);
  }, [transaction]);

  const amountLabel = useMemo(() => {
    if (!transaction) return "";
    if (amountValue === null) return `-- ${symbol}`;
    const isPositive = isPositiveTransaction(transaction.type);
    const prefix = isPositive ? "+" : "-";
    return `${prefix}${formatAssetAmount(amountValue)} ${symbol}`;
  }, [transaction, amountValue, symbol]);

  const paidAmountLabel = transaction ? formatPaidAmount(transaction) : null;
  const transactionTitle = transaction ? getTransactionTitle(transaction) : "";
  const transactionNetwork = transaction
    ? getTransactionNetwork(transaction)
    : "";
  const detailSections = useMemo(() => {
    if (!transaction) return [];
    return buildTransactionDetailSections(
      transaction,
      amountValue,
      symbol,
      transactionNetwork,
    );
  }, [transaction, amountValue, symbol, transactionNetwork]);
  const fiatReceivedAmount = transaction
    ? getFiatReceivedAmount(transaction)
    : null;
  const fiatCurrency = transaction ? getFiatCurrency(transaction) : "NGN";
  const secondaryAmountLabel =
    transaction?.type === "WITHDRAW" && fiatReceivedAmount !== null
      ? formatFiatAmount(fiatReceivedAmount, fiatCurrency)
      : paidAmountLabel;

  const copyValue = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const generateReceiptHTML = () => {
    const statusText = transaction
      ? getTransactionStatusLabel(transaction.status)
      : "Pending";
    const receiptRows = detailSections
      .flatMap((section) => [
        section.title
          ? `<div class="section-title">${section.title}</div>`
          : "",
        ...section.rows.map(
          (row) => `
                <div class="detail-row">
                  <span class="detail-label">${row.label}</span>
                  <span class="detail-value ${row.mono ? "mono" : ""}">${row.value}</span>
                </div>
          `,
        ),
      ])
      .join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kellon Receipt</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background: white;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .receipt {
              width: 450px;
              background: white;
              border: 1px solid #e5e7eb;
            }
            .header {
              background: #a7167f;
              padding: 20px 24px;
              display: grid;
              grid-template-columns: 1fr auto;
              align-items: center;
              gap: 16px;
            }
            .brand {
              display: flex;
              align-items: center;
              gap: 10px;
              min-width: 0;
            }
            .brand-badge {
              width: 36px;
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              flex-shrink: 0;
            }
            .brand-badge img {
              width: 36px;
              height: 36px;
              object-fit: contain;
              display: block;
            }
            .brand-wordmark {
              color: white;
              font-size: 21px;
              font-weight: 500;
              line-height: 36px;
              letter-spacing: 0;
              white-space: nowrap;
            }
            .header-title {
              color: white;
              font-size: 16px;
              font-weight: 600;
              text-align: right;
              line-height: 1.2;
            }
            .content {
              padding: 24px;
            }
            .status-row {
              text-align: center;
              margin-bottom: 20px;
            }
            .status-text {
              color: ${
                transaction?.status === "COMPLETED" ||
                transaction?.status === "PAID"
                  ? "#10b981"
                  : transaction?.status === "FAILED"
                    ? "#ef4444"
                    : "#a7167f"
              };
              font-size: 13px;
              font-weight: 700;
              line-height: 1;
              text-align: center;
            }
            .date {
              text-align: center;
              color: #6b7280;
              font-size: 13px;
              margin-bottom: 24px;
            }
            .amount-section {
              border-top: 1px solid #f3f4f6;
              border-bottom: 1px solid #f3f4f6;
              padding: 18px 0;
              margin-bottom: 18px;
              text-align: center;
            }
            .amount {
              font-size: 28px;
              font-weight: 700;
              color: #111827;
            }
            .transaction-type {
              font-size: 13px;
              color: #6b7280;
              margin-top: 4px;
            }
            .details {
              margin-bottom: 24px;
            }
            .section-title {
              padding: 12px 0 6px;
              color: #9ca3af;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              gap: 18px;
              padding: 10px 0;
              border-bottom: 1px solid #f9fafb;
            }
            .detail-label {
              font-size: 13px;
              color: #6b7280;
            }
            .detail-value {
              font-size: 13px;
              font-weight: 500;
              color: #111827;
            }
            .detail-value.mono {
              font-family: monospace;
              font-size: 11px;
              word-break: break-all;
              text-align: right;
              max-width: 60%;
            }
            .footer {
              border-top: 1px solid #f3f4f6;
              padding-top: 16px;
              text-align: center;
            }
            .footer p {
              font-size: 10px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div class="brand">
                
                <div class="brand-wordmark">Kellon</div>
              </div>
              <div class="header-title">Transaction Receipt</div>
            </div>
            <div class="content">
              <div class="status-row">
                <div class="status-text">${statusText}</div>
              </div>
              <div class="date">${formatDateTime(transaction!.createdAt)}</div>
              <div class="amount-section">
                <div class="amount">${amountLabel}</div>
                <div class="transaction-type">${getTransactionLabel(transaction!.type)}</div>
              </div>
              <div class="details">
                ${receiptRows}
              </div>
              <div class="footer">
                <p>Powered by Kellon</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const captureReceipt = async (): Promise<HTMLCanvasElement | null> => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "450px";
    iframe.style.height = "600px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    try {
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Cannot access iframe document");

      iframeDoc.open();
      iframeDoc.write(generateReceiptHTML());
      iframeDoc.close();

      await new Promise((resolve) => setTimeout(resolve, 200));

      const receiptElement = iframeDoc.querySelector(".receipt");
      if (!receiptElement) throw new Error("Receipt element not found");

      const canvas = await html2canvas(receiptElement as HTMLElement, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: false,
        allowTaint: true,
        onclone: (clonedDoc) => {
          const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
          links.forEach((link) => link.remove());
        },
      });

      return canvas;
    } catch (error) {
      console.error("Failed to capture receipt:", error);
      return null;
    } finally {
      document.body.removeChild(iframe);
    }
  };

  const downloadAsPDF = async () => {
    setIsGenerating(true);
    try {
      const canvas = await captureReceipt();
      if (!canvas) throw new Error("Failed to capture receipt");

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`receipt-${transaction?.id.slice(0, 8)}.pdf`);
    } catch (error) {
      console.error("Failed to download PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const shareReceipt = async () => {
    setIsGenerating(true);
    try {
      const canvas = await captureReceipt();
      if (!canvas) throw new Error("Failed to capture receipt");

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/png");
      });

      const file = new File(
        [blob],
        `receipt-${transaction?.id.slice(0, 8)}.png`,
        {
          type: "image/png",
        },
      );

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Transaction Receipt",
          text: `Receipt for ${transactionTitle}`,
          files: [file],
        });
      } else {
        const link = document.createElement("a");
        link.download = `receipt-${transaction?.id.slice(0, 8)}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    } catch (error) {
      console.error("Failed to share receipt:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col container max-w-2xl mx-auto min-h-[90dvh] pb-32 md:pt-20">
        <div className="flex items-center justify-between mb-8 px-4 pt-4">
          <Button variant="iconCircle" size="icon">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
          </Button>
          <h2 className="text-lg font-bold text-black dark:text-white">
            Transaction
          </h2>
          <div className="w-9 h-9" />
        </div>
        <div className="mx-auto max-w-2xl px-4 space-y-4">
          <div className="h-32 animate-pulse rounded-xl bg-white dark:bg-secondary-40" />
          <div className="h-48 animate-pulse rounded-xl bg-white dark:bg-secondary-40" />
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex flex-col container max-w-2xl mx-auto min-h-[90dvh] pb-32 md:pt-20">
        <div className="flex items-center justify-between mb-8 px-4">
          <Button
            type="button"
            variant="iconCircle"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
          </Button>
          <h2 className="text-lg font-bold text-black dark:text-white">
            Transaction
          </h2>
          <div className="w-9 h-9" />
        </div>
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-xl bg-white p-6 text-center dark:bg-secondary-40">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {error ? "Failed to load transaction" : "Transaction not found"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col container max-w-2xl mx-auto min-h-[90dvh] pb-32 md:pt-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-4">
        <Button
          type="button"
          variant="iconCircle"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
        </Button>
        <h2 className="text-lg font-bold text-black dark:text-white">
          {transactionTitle}
        </h2>
        <div className="w-9 h-9" />
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {/* Status Badge - Now matches the component styling */}
        <div className="mb-6 flex justify-center">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              getTransactionStatusBadgeClasses(transaction.status),
            )}
          >
            {getTransactionStatusLabel(transaction.status)}
          </span>
        </div>

        {/* Amount */}
        <div className="mb-8 text-center">
          <p className="text-4xl font-bold text-black dark:text-white">
            {amountLabel}
          </p>
          {secondaryAmountLabel ? (
            <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              {secondaryAmountLabel}
            </p>
          ) : null}
        </div>

        {/* Details Card */}
        <div className="overflow-hidden rounded-xl border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
          <div className="flex justify-between gap-4 border-b border-black/5 px-5 py-4 dark:border-white/5">
            <span className="text-sm text-gray-500 dark:text-gray-400">Date</span>
            <span className="text-right text-sm font-medium text-black dark:text-white">
              {formatDateTime(transaction.createdAt)}
            </span>
          </div>

          {detailSections.map((section, sectionIndex) => (
            <div key={section.title || `section-${sectionIndex}`}>
              {section.title ? (
                <div className="border-b border-black/5 px-5 py-3 dark:border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {section.title}
                  </p>
                </div>
              ) : null}

              {section.rows.map((row) => (
                <div
                  key={`${section.title || "main"}-${row.label}`}
                  className="flex items-center justify-between gap-4 border-b border-black/5 px-5 py-4 last:border-b-0 dark:border-white/5"
                >
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {row.label}
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-right text-sm font-medium text-black dark:text-white",
                        row.mono &&
                          "max-w-[180px] font-mono text-xs md:max-w-[250px]",
                      )}
                    >
                      {row.value}
                    </span>
                    {row.copyable ? (
                      <button
                        type="button"
                        onClick={() => copyValue(row.value)}
                        className="rounded-lg p-1 transition hover:bg-gray-100 dark:hover:bg-white/10 cursor-copy"
                        aria-label={`Copy ${row.label}`}
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Action Buttons - Only 2 buttons */}
        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            variant="flowSecondary"
            size="action"
            onClick={downloadAsPDF}
            disabled={isGenerating}
            className="flex-1"
          >
            <span className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base">
              Save as PDF
            </span>
          </Button>

          <Button
            type="button"
            variant="flow"
            size="action"
            onClick={shareReceipt}
            disabled={isGenerating}
            className="flex-1"
          >
            <span className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base">
              Share
            </span>

            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </Button>
        </div>
      </div>
    </div>
  );
}
