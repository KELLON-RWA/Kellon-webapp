"use client";

import { Check, ArrowRight, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumberWithCommas } from "@/lib/format-number-with-comma";

interface BuySuccessModalProps {
  open: boolean;
  onDone: () => void;
  onViewTransactions: () => void;
  amount: string;
  fiatCurrency: string;
  asset: string | null;
  networkName?: string | null;
  estimatedCrypto: number;
  providerName?: string | null;
  resolvedTransactionId?: string | null;
  isSyncingTransaction?: boolean;
}

export function BuySuccessModal({
  open,
  onDone,
  onViewTransactions,
  amount,
  fiatCurrency,
  asset,
  networkName,
  estimatedCrypto,
  providerName,
  resolvedTransactionId,
  isSyncingTransaction,
}: BuySuccessModalProps) {
  const formattedCrypto =
    estimatedCrypto > 0
      ? estimatedCrypto.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onDone()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-6 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Your money is on the way</DialogTitle>
        </DialogHeader>

        <div className="pt-3 text-center sm:pt-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
            <Check className="h-7 w-7 text-primary-60 dark:text-primary-80" strokeWidth={2.5} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-black dark:text-white">
            Your money is on the way
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            We&apos;ve recorded your transfer. Once confirmed by the provider, your
            crypto will be deposited directly to your wallet.
          </p>
        </div>

        {/* Order Details Card */}
        <div className="mt-5 rounded-2xl border border-black/5 bg-white p-4.5 text-xs dark:border-white/10 dark:bg-secondary-60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">You sent</span>
            <span className="font-semibold text-black dark:text-white">
              {formatNumberWithCommas(amount)} {fiatCurrency}
            </span>
          </div>

          {formattedCrypto && asset ? (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">You receive</span>
              <span className="font-bold text-primary-60">
                ≈ {formattedCrypto} {asset}
              </span>
            </div>
          ) : null}

          {networkName ? (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Network</span>
              <span className="font-medium text-black dark:text-white capitalize">
                {networkName}
              </span>
            </div>
          ) : null}

          {providerName ? (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Provider</span>
              <span className="font-medium text-black dark:text-white">
                {providerName}
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-black/5 pt-2.5 dark:border-white/5">
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            {resolvedTransactionId ? (
              <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" strokeWidth={3} />
                Synced & Ready
              </span>
            ) : isSyncingTransaction ? (
              <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing with provider…
              </span>
            ) : (
              <span className="flex items-center gap-1 font-medium text-gray-500 dark:text-gray-400">
                <Clock className="h-3 w-3" />
                Processing
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            type="button"
            onClick={onDone}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-60 to-primary-70 text-sm font-bold text-white shadow-md transition hover:opacity-95 cursor-pointer"
          >
            Done
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onViewTransactions}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-black/5 hover:text-black dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white cursor-pointer"
          >
            <span>View in Transactions</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
