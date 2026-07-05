"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GiftSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  symbol: string;
  chain: string;
  recipient: string;
  onDone: () => void;
}

export default function GiftSuccessModal({
  open,
  onOpenChange,
  amount,
  symbol,
  chain,
  recipient,
  onDone,
}: GiftSuccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[32px] border border-black/5 bg-gray-70 p-6 outline-none dark:border-white/10 dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Gift Sent</DialogTitle>
        </DialogHeader>

        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold text-black dark:text-white">
            Gift Sent!
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white text-gray-600 transition hover:bg-gray-95 dark:border-white/10 dark:bg-secondary-60/60 dark:text-white dark:hover:bg-secondary-60 cursor-pointer"
            aria-label="Close gift sent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <Check className="h-10 w-10" />
          </div>
          <p className="mx-auto mt-6 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-40">
            You&apos;ve successfully sent {amount} {symbol} on {chain} to{" "}
            {recipient}. Gasless on-chain transaction.
          </p>
        </div>

        <Button
          type="button"
          onClick={onDone}
          className="h-14 rounded-2xl bg-emerald-500 text-base font-bold text-white hover:bg-emerald-600"
        >
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
