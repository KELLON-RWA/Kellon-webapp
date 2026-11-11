"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Circle, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isCompletedBridgeStatus,
  isTerminalBridgeFailure,
} from "@/lib/bridge-status";
import { bridgeService } from "@/services/api/bridge";
import type { BridgeOutboxJob } from "@/services/api/bridge-outbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConvertSuccessState {
  mode: "swap" | "bridge";
  amount: string;
  symbol: string; // source symbol
  receiveAmount?: string;
  destinationSymbol?: string;
  sourceChainName?: string;
  destinationChainName: string;
  txHash?: string;
  provider?: string;
  tracking?: Pick<
    BridgeOutboxJob,
    | "txHash"
    | "provider"
    | "fromChain"
    | "toChain"
    | "amount"
    | "symbol"
    | "groupId"
  >;
  submissionPhase?: "preparing" | "approving" | "submitted" | "completed";
  transactionId?: string;
}

interface BridgeSuccessModalProps {
  open: boolean;
  state: ConvertSuccessState | null;
  onViewTransactions: () => void;
  onDone: () => void;
  onDismiss: () => void;
}

type BridgeProgressStep = "approval" | "source" | "destination";

const PROGRESS_STEPS: Array<{ id: BridgeProgressStep; label: string }> = [
  { id: "approval", label: "Approve and submit" },
  { id: "source", label: "Confirm source transaction" },
  { id: "destination", label: "Deliver to destination" },
];

function formatProviderStatus(status?: string) {
  if (!status) return null;

  return status
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getActiveStep(
  submissionPhase: ConvertSuccessState["submissionPhase"],
  providerStatus: string,
  isComplete: boolean,
  isFailed: boolean,
): BridgeProgressStep {
  if (isComplete || isFailed) return "destination";
  if (submissionPhase === "preparing" || submissionPhase === "approving") {
    return "approval";
  }

  const normalized = providerStatus.toLowerCase();
  if (
    /(attest|relay|bridge|mint|destination|deliver|receive|process)/.test(
      normalized,
    )
  ) {
    return "destination";
  }
  return "source";
}

function getProgressMessage(
  submissionPhase: ConvertSuccessState["submissionPhase"],
  activeStep: BridgeProgressStep,
  providerUpdate: string | null,
) {
  if (submissionPhase === "preparing") return "Preparing your bridge route";
  if (submissionPhase === "approving")
    return "Approving tokens and submitting your transaction";
  if (providerUpdate) return providerUpdate;
  if (activeStep === "destination")
    return "Relaying funds to the destination network";
  return "Confirming your source transaction";
}

export default function BridgeSuccessModal({
  open,
  state,
  onViewTransactions,
  onDone,
  onDismiss,
}: BridgeSuccessModalProps) {
  const [isNavigating, setIsNavigating] = useState<
    "done" | "transactions" | null
  >(null);

  useEffect(() => {
    if (!open) {
      setIsNavigating(null);
    }
  }, [open]);

  const handleViewTransactionsClick = () => {
    if (isNavigating) return;
    setIsNavigating("transactions");
    onViewTransactions();
  };

  const handleDoneClick = () => {
    if (isNavigating) return;
    setIsNavigating("done");
    onDone();
  };

  const tracking = state?.tracking;
  const isSwap = state?.mode === "swap";
  const amount = state?.amount || "";
  const symbol = state?.symbol || "";
  const receiveAmount = state?.receiveAmount || "";
  const destinationSymbol = state?.destinationSymbol || symbol;
  const sourceChain = state?.sourceChainName || "";
  const destination = state?.destinationChainName || "";
  const txHash = state?.txHash;
  const submissionPhase = state?.submissionPhase || "completed";

  const statusQuery = useQuery({
    queryKey: ["bridge-status", tracking?.txHash, tracking?.groupId],
    queryFn: () => bridgeService.getStatus(tracking!),
    enabled: open && Boolean(tracking) && !isSwap,
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
  const isComplete =
    isSwap
      ? submissionPhase === "completed"
      : isCompletedBridgeStatus(status || {});
  const isFailed = !isSwap && isTerminalBridgeFailure(status || {});
  const isSubmitted = isSwap
    ? isComplete
    : Boolean(txHash) || submissionPhase === "submitted" || isComplete;
  const providerUpdate = formatProviderStatus(
    status?.substatus || status?.status,
  );
  const activeStep = getActiveStep(
    submissionPhase,
    `${status?.status || ""} ${status?.substatus || ""}`,
    isComplete,
    isFailed,
  );
  const activeStepIndex = PROGRESS_STEPS.findIndex(
    (step) => step.id === activeStep,
  );
  const progressMessage = getProgressMessage(
    submissionPhase,
    activeStep,
    providerUpdate,
  );

  const title = isSwap
    ? "Swap submitted"
    : isComplete
      ? "Bridge complete"
      : isFailed
        ? "Bridge needs attention"
        : isSubmitted
          ? "Bridge submitted"
          : "Bridge in progress";

  const description = isSwap
    ? `${amount} ${symbol} swapped to ${receiveAmount ? `${receiveAmount} ` : ""}${destinationSymbol}${sourceChain ? ` on ${sourceChain}` : ""}.`
    : isComplete
      ? `${amount} ${symbol} has arrived on ${destination}.`
      : isFailed
        ? "The bridge provider reported an issue. Your transaction is recorded in Activity."
        : isSubmitted
          ? `${amount} ${symbol} is on its way to ${destination}. It will arrive shortly once verified on-chain.`
          : `${amount} ${symbol} is moving to ${destination}.`;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && (isSubmitted || isComplete || isFailed) && onDismiss()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[32px] border border-black/5 bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-6 outline-none dark:border-white/10 dark:bg-none dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="pt-3 text-center sm:pt-4">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              isFailed
                ? "bg-red-500/10 text-red-500"
                : isComplete
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-primary-60/10 text-primary-60 dark:bg-primary-50/15 dark:text-primary-40"
            }`}
          >
            {isComplete ? (
              <Check className="h-8 w-8" />
            ) : isFailed ? (
              <CircleAlert className="h-8 w-8" />
            ) : (
              <LoaderCircle className="h-8 w-8 animate-spin" />
            )}
          </div>
          <h2 className="mt-4 text-2xl font-bold text-black dark:text-white">
            {title}
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>

        {/* Swap Summary Card */}
        {isSwap ? (
          <div className="mt-5 rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-xs dark:border-white/10 dark:bg-white/[0.03] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">You sent</span>
              <span className="font-semibold text-black dark:text-white">
                {amount} {symbol}
              </span>
            </div>
            {receiveAmount ? (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">You receive</span>
                <span className="font-bold text-primary-60">
                  {receiveAmount} {destinationSymbol}
                </span>
              </div>
            ) : null}
            {sourceChain ? (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Network</span>
                <span className="font-medium text-black dark:text-white">
                  {sourceChain}
                </span>
              </div>
            ) : null}
            {state?.provider ? (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Provider</span>
                <span className="font-medium text-black dark:text-white">
                  {state.provider}
                </span>
              </div>
            ) : null}
            {txHash ? (
              <div className="flex items-center justify-between border-t border-black/5 pt-2.5 dark:border-white/5">
                <span className="text-gray-500 dark:text-gray-400">Transaction</span>
                <span className="font-mono text-[11px] text-gray-600 dark:text-gray-300">
                  {txHash.slice(0, 10)}…{txHash.slice(-6)}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          /* Bridge Progress Steps */
          <div className="mt-5 rounded-2xl border border-black/5 bg-black/[0.02] px-4 py-1 dark:border-white/10 dark:bg-white/[0.03]">
            {PROGRESS_STEPS.map((step, index) => {
              const isCurrent = step.id === activeStep;
              const isDone = isComplete || (!isFailed && index < activeStepIndex);

              return (
                <div key={step.id} className="flex items-center gap-3 py-3">
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                          ? isFailed
                            ? "bg-red-500/15 text-red-500"
                            : "bg-primary-60/15 text-primary-60"
                          : "text-gray-400 dark:text-gray-60"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isCurrent && !isFailed ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : isCurrent ? (
                      <CircleAlert className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <p
                      className={`text-sm font-semibold ${
                        isCurrent || isDone
                          ? "text-black dark:text-white"
                          : "text-gray-500 dark:text-gray-50"
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && !isComplete ? (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-40">
                        {isFailed
                          ? "Provider reported an issue"
                          : progressMessage}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Buttons: View in Transactions & Done (Visible once transaction is submitted or complete) */}
        {isSubmitted || isComplete ? (
          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              type="button"
              disabled={isNavigating !== null}
              onClick={handleViewTransactionsClick}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-60 to-primary-70 text-sm font-bold text-white shadow-md transition hover:opacity-95 cursor-pointer disabled:opacity-60"
            >
              {isNavigating === "transactions" ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                  <span>Opening transactions...</span>
                </>
              ) : (
                <>
                  <span>View in Transactions</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={isNavigating !== null}
              onClick={handleDoneClick}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-black/5 hover:text-black dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white cursor-pointer disabled:opacity-60"
            >
              {isNavigating === "done" ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin text-gray-500" />
                  <span>Closing...</span>
                </>
              ) : (
                "Done"
              )}
            </Button>
          </div>
        ) : isFailed ? (
          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              type="button"
              variant="outline"
              disabled={isNavigating !== null}
              onClick={handleDoneClick}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer disabled:opacity-60"
            >
              {isNavigating === "done" ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin text-gray-500" />
                  <span>Closing...</span>
                </>
              ) : (
                "Done"
              )}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
