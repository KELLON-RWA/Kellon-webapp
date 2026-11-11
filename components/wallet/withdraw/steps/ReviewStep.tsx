"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { formatNumberWithCommas } from "@/lib/format-number-with-comma";
import { formatAssetAmount } from "@/components/wallet/send/send-utils";
import SummaryPill from "@/components/wallet/shared/FlowSummaryPill";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import type { BankDetail } from "@/types/db";
import {
  getPaymentRailConfig,
  type PaymentRail,
} from "@/lib/payment-rails";

interface ReviewStepProps {
  netFiat: number;
  fiatCurrency: string;
  maxCryptoDebit?: string;
  amount: string;
  asset: string | null;
  amountUnit?: string | null;
  selectedChain?: { name: string } | null;
  selectedProvider: { name: string; fee?: string } | null;
  selectedBank: BankDetail | null;
  onConfirm: () => void;
  isSubmitting: boolean;
  paymentRail?: PaymentRail;
  exchangeRate?: number | null;
  fee?: number | string | null;
  feeCurrency?: string | null;
}

export function WithdrawReviewStep({
  netFiat,
  fiatCurrency,
  maxCryptoDebit,
  amount,
  asset,
  amountUnit = "",
  selectedChain,
  selectedProvider,
  selectedBank,
  onConfirm,
  isSubmitting,
  paymentRail,
  exchangeRate,
  fee,
  feeCurrency,
}: ReviewStepProps) {
  const paymentAction = paymentRail ? getPaymentRailConfig(paymentRail) : null;

  const effectiveExchangeRate =
    exchangeRate && exchangeRate > 0
      ? exchangeRate
      : netFiat > 0 && Number(amount) > 0
        ? netFiat / Number(amount)
        : 0;

  const displayWithdrawAmount = amount ? formatNumberWithCommas(amount) : "0";

  const displayFee = useMemo(() => {
    // 1. Explicit fee prop passed from quote
    if (fee !== undefined && fee !== null) {
      if (typeof fee === "number") {
        return fee > 0
          ? `${formatAssetAmount(fee)} ${feeCurrency || asset || "USDC"}`
          : `0 ${asset || "USDC"}`;
      }
      if (typeof fee === "string" && fee.trim()) {
        const parsed = parseFloat(fee);
        if (Number.isFinite(parsed)) {
          return parsed > 0
            ? `${formatAssetAmount(parsed)} ${feeCurrency || asset || "USDC"}`
            : `0 ${asset || "USDC"}`;
        }
        return fee === "No fee" ? `0 ${asset || "USDC"}` : fee;
      }
    }

    // 2. From maxCryptoDebit difference (protocol/network fee)
    if (maxCryptoDebit && Number(amount) > 0) {
      const maxDebitNum = parseFloat(maxCryptoDebit);
      const amountNum = parseFloat(amount);
      if (Number.isFinite(maxDebitNum) && maxDebitNum > amountNum) {
        const diff = maxDebitNum - amountNum;
        return `${formatAssetAmount(diff)} ${asset || "USDC"}`;
      }
    }

    // 3. From selected provider metadata
    if (selectedProvider?.fee && selectedProvider.fee !== "No fee") {
      return selectedProvider.fee;
    }

    return `0 ${asset || "USDC"}`;
  }, [fee, feeCurrency, maxCryptoDebit, amount, asset, selectedProvider]);

  const providerName = selectedProvider?.name || "Ramphub";
  const recipientName = selectedBank?.accountName?.toUpperCase() || "--";
  const bankName = selectedBank?.bankName || "--";
  const accountNumber = selectedBank?.accountNumber || "--";

  return (
    <div className="flex h-full min-h-[calc(100dvh-200px)] flex-col md:min-h-[500px]">
      <div className="flex-1 animate-in fade-in slide-in-from-bottom-4">
        <SummaryPill
          asset={asset}
          selectedChain={selectedChain}
          amount={amount}
          amountCurrency={amountUnit ?? ""}
          fiatAmount={
            netFiat > 0
              ? formatNumberWithCommas(netFiat.toFixed(2))
              : undefined
          }
          fiatCurrency={fiatCurrency}
        />

        <div className="mb-6 w-full rounded-[28px] border border-black/5 bg-white p-5 dark:border-white/10 dark:bg-secondary-50 xs:p-6">
          <div className="space-y-4">
            {/* Section 1: Withdraw Amount, Exchange Rate, Fee */}
            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                Withdraw Amount
              </span>
              <span className="font-bold text-black dark:text-white">
                {displayWithdrawAmount} {asset || "USDC"}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                Exchange Rate
              </span>
              <span className="font-bold text-black dark:text-white">
                1 {asset || "USDC"} ≈ {fiatCurrency}{" "}
                {formatNumberWithCommas(effectiveExchangeRate.toFixed(2))}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                Fee
              </span>
              <span className="font-bold text-black dark:text-white">
                {displayFee}
              </span>
            </div>

            {/* Subtle Divider */}
            <div className="my-1 h-px w-full bg-slate-200/80 dark:bg-white/5" />

            {/* Section 2: Highlight "You Receive" */}
            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                You Receive
              </span>
              <span className="text-base font-bold text-primary-60 xs:text-lg">
                {fiatCurrency} {formatNumberWithCommas(netFiat.toFixed(2))}
              </span>
            </div>

            {/* Subtle Divider */}
            <div className="my-1 h-px w-full bg-slate-200/80 dark:bg-white/5" />

            {/* Section 3: Provider, Recipient, Bank Name, Account Number */}
            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                Provider
              </span>
              <span className="font-bold text-black dark:text-white">
                {providerName}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                Recipient
              </span>
              <span className="font-bold uppercase text-black dark:text-white">
                {recipientName}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                Bank Name
              </span>
              <span className="font-bold text-black dark:text-white">
                {bankName}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm py-0.5">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                Account Number
              </span>
              <span className="font-bold text-black dark:text-white">
                {accountNumber}
              </span>
            </div>
          </div>
        </div>
      </div>

      <FlowActionFooter
        onClick={onConfirm}
        disabled={isSubmitting}
        showShimmer={!isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>
              {paymentAction?.withdrawalLoadingAction ||
                "Processing Withdrawal..."}
            </span>
          </>
        ) : (
          paymentAction?.withdrawalAction || "Confirm Withdrawal"
        )}
      </FlowActionFooter>
    </div>
  );
}
