"use client";

import { useState } from "react";
import { ArrowRight, Check, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getChainLabel } from "@/lib/chains";
import ChainIcon from "@/components/wallet/ChainIcon";
import { formatAssetAmount, truncateMiddle } from "./send-utils";
import type { RecipientKind } from "./send-types";

export interface SendSuccessState {
  amount: number;
  symbol: string;
  recipient: string;
  recipientKind: RecipientKind;
  chain?: string;
  txHash?: string;
  transactionId?: string;
}

interface SendSuccessModalProps {
  open: boolean;
  state: SendSuccessState | null;
  onDone: () => void;
  onViewTransactions: () => void | Promise<void>;
}

export default function SendSuccessModal({
  open,
  state,
  onDone,
  onViewTransactions,
}: SendSuccessModalProps) {
  const [isNavigating, setIsNavigating] = useState<
    "done" | "transactions" | null
  >(null);

  if (!state) return null;

  const networkName = getChainLabel(state.chain);
  const formattedAmount = `${formatAssetAmount(state.amount)} ${state.symbol}`;
  const isAddress =
    state.recipientKind === "evm" ||
    state.recipientKind === "solana" ||
    state.recipientKind === "stellar";
  const displayRecipient = isAddress
    ? truncateMiddle(state.recipient, 16)
    : state.recipient;

  const handleDoneClick = () => {
    if (isNavigating) return;
    setIsNavigating("done");
    onDone();
  };

  const handleViewTransactionsClick = async () => {
    if (isNavigating) return;
    setIsNavigating("transactions");
    try {
      await onViewTransactions();
    } catch {
      setIsNavigating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleDoneClick()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-6 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Your transfer is on the way</DialogTitle>
        </DialogHeader>

        <div className="pt-3 text-center sm:pt-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
            <Check className="h-7 w-7 text-primary-60 dark:text-primary-80" strokeWidth={2.5} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-black dark:text-white">
            Your transfer is on the way
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            We&apos;ve submitted your transfer. It will arrive in the recipient&apos;s wallet shortly.
          </p>
        </div>

        {/* Transfer Details Card */}
        <div className="mt-5 rounded-2xl border border-black/5 bg-white p-4.5 text-xs dark:border-white/10 dark:bg-secondary-60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">You sent</span>
            <span className="font-semibold text-black dark:text-white">
              {formattedAmount}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">Recipient</span>
            <span className="font-medium text-black dark:text-white">
              {displayRecipient}
            </span>
          </div>

          {networkName ? (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Network</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-black dark:text-white">
                <ChainIcon name={state.chain || ""} size={14} />
                <span>{networkName}</span>
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-black/5 pt-3 dark:border-white/10">
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <span className="flex items-center gap-1.5 font-medium text-primary-60 dark:text-primary-80">
              <Clock className="h-3 w-3" />
              Processing
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            type="button"
            variant="flow"
            onClick={handleDoneClick}
            disabled={isNavigating !== null}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white shadow-md cursor-pointer disabled:opacity-60"
          >
            {isNavigating === "done" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Closing...</span>
              </>
            ) : (
              "Done"
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleViewTransactionsClick}
            disabled={isNavigating !== null}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-black/5 hover:text-black dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white cursor-pointer disabled:opacity-60"
          >
            {isNavigating === "transactions" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary-60" />
                <span>Opening transaction...</span>
              </>
            ) : (
              <>
                <span>View transaction</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
