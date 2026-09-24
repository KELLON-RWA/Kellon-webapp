"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BridgeSuccessModalProps {
  open: boolean;
  amount: string;
  symbol: string;
  destination: string;
  onDone: () => void;
}

export default function BridgeSuccessModal({
  open,
  amount,
  symbol,
  destination,
  onDone,
}: BridgeSuccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onDone()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[32px] border border-black/5 bg-gray-70 p-6 outline-none dark:border-white/10 dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Bridge submitted</DialogTitle>
        </DialogHeader>

        <div className="py-5 text-center sm:py-7">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <Check className="h-10 w-10" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-black dark:text-white">
            Bridge submitted
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-40">
            {amount} {symbol} is on its way to {destination}. We&apos;ll show
            your destination asset view next.
          </p>
        </div>

        <Button
          type="button"
          onClick={onDone}
          className="h-14 rounded-2xl bg-emerald-500 text-base font-bold text-white hover:bg-emerald-600"
        >
          View {symbol}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
