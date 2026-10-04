"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Circle, CircleAlert, LoaderCircle } from "lucide-react";
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

interface BridgeSuccessModalProps {
  open: boolean;
  amount: string;
  symbol: string;
  destination: string;
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
  submissionPhase: BridgeSuccessModalProps["submissionPhase"],
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
  submissionPhase: BridgeSuccessModalProps["submissionPhase"],
  activeStep: BridgeProgressStep,
  providerUpdate: string | null,
) {
  if (submissionPhase === "preparing") return "Preparing your bridge route";
  if (submissionPhase === "approving")
    return "Approving USDC and submitting your transaction";
  if (providerUpdate) return providerUpdate;
  if (activeStep === "destination")
    return "Relaying funds to the destination network";
  return "Confirming your source transaction";
}

export default function BridgeSuccessModal({
  open,
  amount,
  symbol,
  destination,
  tracking,
  submissionPhase = "submitted",
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
  const isComplete =
    submissionPhase === "completed" || isCompletedBridgeStatus(status || {});
  const isFailed = isTerminalBridgeFailure(status || {});
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
  const title = isComplete
    ? "Bridge complete"
    : isFailed
      ? "Bridge needs attention"
      : "Bridge in progress";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onDismiss()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-[32px] border border-black/5 bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-6 outline-none dark:border-white/10 dark:bg-none dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="pt-3 text-center sm:pt-5">
          <div
            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
              isFailed
                ? "bg-red-500/10 text-red-500"
                : "bg-emerald-500/10 text-emerald-500"
            }`}
          >
            {isComplete ? (
              <Check className="h-10 w-10" />
            ) : isFailed ? (
              <CircleAlert className="h-10 w-10" />
            ) : (
              <LoaderCircle className="h-10 w-10 animate-spin" />
            )}
          </div>
          <h2 className="mt-6 text-2xl font-bold text-black dark:text-white">
            {title}
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-40">
            {isComplete
              ? `${amount} ${symbol} has arrived on ${destination}.`
              : isFailed
                ? "The bridge provider reported a final issue. Your transaction remains available in Activity."
                : `${amount} ${symbol} is moving to ${destination}.`}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-black/5 bg-black/[0.02] px-4 py-1 dark:border-white/10 dark:bg-white/[0.03]">
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
                        ? "Provider reported a final issue"
                        : progressMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          onClick={isComplete ? onDone : onDismiss}
          className="h-14 rounded-2xl bg-emerald-500 text-base font-bold text-white hover:bg-emerald-600"
        >
          {isComplete
            ? `View ${symbol} on ${destination}`
            : isFailed
              ? "Close"
              : "Continue in background"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
