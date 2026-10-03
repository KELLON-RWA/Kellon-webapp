"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCompletedBridgeStatus, isTerminalBridgeFailure } from "@/lib/bridge-status";
import { bridgeService } from "@/services/api/bridge";
import type { BridgeOutboxJob } from "@/services/api/bridge-outbox";
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
  tracking?: Pick<
    BridgeOutboxJob,
    "txHash" | "provider" | "fromChain" | "toChain" | "amount" | "symbol" | "groupId"
  >;
  onDone: () => void;
  onDismiss: () => void;
}

export default function BridgeSuccessModal({
  open,
  amount,
  symbol,
  destination,
  tracking,
  onDone,
  onDismiss,
}: BridgeSuccessModalProps) {
  const statusQuery = useQuery({
    queryKey: ["bridge-status", tracking?.txHash, tracking?.groupId],
    queryFn: () => bridgeService.getStatus(tracking!),
    enabled: open && Boolean(tracking),
    refetchInterval: (query) => {
      const status = query.state.data;
      return status &&
        (isCompletedBridgeStatus(status) || isTerminalBridgeFailure(status))
        ? false
        : 7_500;
    },
    retry: 1,
  });
  const status = statusQuery.data;
  const isComplete = !tracking || isCompletedBridgeStatus(status || {});
  const isFailed = isTerminalBridgeFailure(status || {});
  const statusText = status?.substatus || status?.status || "Confirming on-chain";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onDismiss()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[32px] border border-black/5 bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-6 outline-none dark:border-white/10 dark:bg-none dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{isComplete ? "Bridge complete" : "Bridge in progress"}</DialogTitle>
        </DialogHeader>

        <div className="py-5 text-center sm:py-7">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            {isComplete ? (
              <Check className="h-10 w-10" />
            ) : (
              <LoaderCircle className="h-10 w-10 animate-spin" />
            )}
          </div>
          <h2 className="mt-6 text-2xl font-bold text-black dark:text-white">
            {isComplete ? "Bridge complete" : isFailed ? "Bridge needs attention" : "Bridge in progress"}
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-40">
            {isComplete
              ? `${amount} ${symbol} has arrived on ${destination}.`
              : isFailed
                ? "The bridge provider needs more time to confirm this transfer. You can continue in the background."
                : `${amount} ${symbol} is on its way to ${destination}. We\'re checking its live status.`}
          </p>
          {!isComplete && !isFailed ? (
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary-60">
              {statusText.replaceAll("_", " ")}
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={isComplete ? onDone : onDismiss}
          className="h-14 rounded-2xl bg-emerald-500 text-base font-bold text-white hover:bg-emerald-600"
        >
          {isComplete ? "Done" : "Continue in background"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
