"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMfa, useWallets } from "@privy-io/react-auth";
import {
  useWallets as useSolanaWallets,
  useSignTransaction as useSolanaSignTransaction,
} from "@privy-io/react-auth/solana";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import {
  setStickyVerificationCode,
  useSmartAccount,
} from "@/hooks/useSmartAccount";
import {
  findTransferVerificationRequiredError,
  transferService,
} from "@/services/api/transfers";
import { createWebauthnAttestation } from "@/services/api";
import {
  yieldService,
  type PreparedYieldAction,
  type YieldActionType,
  type YieldTransaction,
} from "@/services/api/yield";
import type { User, YieldOpportunity, YieldPosition } from "@/types/db";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  formatApy,
  formatTokenAmount,
  getMaxUsableBalance,
  getPositionValue,
  getProtocolName,
  getSymbolBalances,
} from "./earn-utils";

type EvmSmartAccountClient = {
  account: unknown;
  chain: unknown;
  sendTransaction(args: {
    account: unknown;
    chain: unknown;
    to: `0x${string}`;
    data?: `0x${string}`;
    value: bigint;
  }): Promise<string>;
};

type EarnVerification = {
  verificationCode: string;
  verificationType: "email_otp" | "sms_otp" | "totp" | "webauthn";
  context: EarnVerificationContext;
};

type EarnVerificationContext = "transfer" | "withdrawal" | "submitUserOp" | "yield";

interface EarnActionDialogProps {
  action: YieldActionType;
  opportunity: YieldOpportunity | null;
  position?: YieldPosition | null;
  profile: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => Promise<void> | void;
  hideOpportunitySummary?: boolean;
}

const CHAIN_BY_ID: Record<number, string> = {
  56: "bnb",
  97: "bnb",
  137: "polygon",
  80002: "polygon",
  8453: "base",
  84532: "base",
  42220: "celo",
  44787: "celo",
  5042: "arc",
  5042002: "arc",
};

function transactionValue(value: YieldTransaction["value"]): bigint {
  if (value === undefined || value === null || value === "") return 0n;
  return BigInt(value);
}

async function waitForBridge(transaction: YieldTransaction, txHash: string) {
  if (!transaction.provider) {
    throw new Error(
      "The bridge provider was not included in the funding plan. No supply transaction was submitted.",
    );
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await yieldService.getBridgeStatus(
      transaction.provider,
      txHash,
      transaction.chainId ? Number(transaction.chainId) : undefined,
    );
    const status = `${response.data.status || ""} ${response.data.substatus || ""}`
      .trim()
      .toUpperCase();

    if (
      ["DONE", "COMPLETED", "SUCCESS", "DELIVERED"].some((value) =>
        status.includes(value),
      )
    ) {
      return;
    }

    if (
      ["FAILED", "INVALID", "REFUNDED", "CANCELLED"].some((value) =>
        status.includes(value),
      )
    ) {
      throw new Error("The cross-chain funding transfer did not complete.");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 3_000));
  }

  throw new Error(
    "The bridge is still processing. Your funds are safe, but the Earn deposit has not been submitted yet.",
  );
}

export default function EarnActionDialog({
  action,
  opportunity,
  position,
  profile,
  open,
  onOpenChange,
  onComplete,
  hideOpportunitySummary = false,
}: EarnActionDialogProps) {
  const { wallets, ready: walletsReady } = useWallets();
  const { wallets: solanaWallets, ready: solanaWalletsReady } =
    useSolanaWallets();
  const { signTransaction: signSolanaTransaction } =
    useSolanaSignTransaction();
  const { mfaMethods, promptMfa } = useMfa();
  const { getSmartAccountClient } = useSmartAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationType, setVerificationType] = useState<
    "email_otp" | "sms_otp" | "totp" | null
  >(null);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const otpRequestInFlightRef = useRef(false);
  const lastOtpRequestAtRef = useRef(0);
  const [verificationContext, setVerificationContext] =
    useState<EarnVerificationContext>(
      action === "withdraw" ? "withdrawal" : "yield",
    );

  const symbol = opportunity?.symbol.toUpperCase() || "";
  const sourceBalances = useMemo(
    () => (opportunity ? getSymbolBalances(profile, opportunity.symbol) : []),
    [opportunity, profile],
  );
  const availableAmount =
    action === "supply"
      ? getMaxUsableBalance(profile, symbol)
      : getPositionValue(position as YieldPosition);

  const schema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .trim()
          .min(1, "Enter an amount")
          .refine(
            (value) => Number.isFinite(Number(value)) && Number(value) > 0,
            "Enter a valid amount",
          )
          .refine(
            (value) => Number(value) <= availableAmount,
            `Maximum available is ${formatTokenAmount(availableAmount)} ${symbol}`,
          ),
      }),
    [availableAmount, symbol],
  );

  type AmountForm = z.infer<typeof schema>;
  const form = useForm<AmountForm>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "" },
  });

  const closeDialog = (nextOpen: boolean) => {
    if (isSubmitting) return;
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  const requestEarnOtp = async () => {
    const now = Date.now();
    if (
      otpRequestInFlightRef.current ||
      now - lastOtpRequestAtRef.current < 1_500
    ) {
      return;
    }

    otpRequestInFlightRef.current = true;
    lastOtpRequestAtRef.current = now;
    setIsRequestingOtp(true);

    try {
      const response = await transferService.requestOTP(
        verificationContext,
        "email",
      );
      setOtpSent(true);
      toast.success(
        response.data?.message || "Verification code sent by email.",
      );
    } catch (error) {
      setOtpSent(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to send verification code.",
      );
    } finally {
      otpRequestInFlightRef.current = false;
      setIsRequestingOtp(false);
    }
  };

  const executeEvmTransactions = async (
    prepared: PreparedYieldAction,
  ): Promise<string> => {
    // `wallets` is [] until Privy settles.
    if (!walletsReady) {
      throw new Error("Wallet is still loading. Please try again in a moment.");
    }

    // Must be the embedded wallet — an extension wallet here derives the wrong Safe.
    const evmWallet = wallets.find(
      (wallet) =>
        wallet.walletClientType === "privy" && wallet.address.startsWith("0x"),
    );
    if (!evmWallet) {
      throw new Error("Your EVM wallet is unavailable. Please log in again.");
    }

    const bridgeWithoutProvider = prepared.transactions.find(
      (transaction) =>
        transaction.stepType === "bridge" && !transaction.provider,
    );
    if (bridgeWithoutProvider) {
      throw new Error(
        "The funding plan is missing its bridge provider. Please try again.",
      );
    }

    let finalHash = "";
    for (const transaction of prepared.transactions) {
      if (!transaction.to) {
        throw new Error("The provider returned an incomplete transaction.");
      }

      const chainId = Number(transaction.chainId);
      const chainKey =
        CHAIN_BY_ID[chainId] || opportunity?.chain.toLowerCase() || "";
      const client = await getSmartAccountClient(evmWallet, chainKey);
      if (!client) {
        throw new Error(`Could not initialize your ${chainKey} account.`);
      }

      finalHash = await (
        client as unknown as EvmSmartAccountClient
      ).sendTransaction({
        account: client.account,
        chain: client.chain,
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}` | undefined,
        value: transactionValue(transaction.value),
      });

      if (transaction.stepType === "bridge") {
        toast.loading("Moving funds to the earning network...", {
          id: "yield-bridge",
        });
        try {
          await waitForBridge(transaction, finalHash);
        } finally {
          toast.dismiss("yield-bridge");
        }
      }
    }

    return finalHash;
  };

  const performAction = async (
    values: AmountForm,
    verification?: EarnVerification,
  ) => {
    if (!opportunity) return;
    setIsSubmitting(true);

    const isBundlerVerification = verification?.context === "submitUserOp";
    let activeVerificationContext: EarnVerificationContext =
      action === "withdraw" ? "withdrawal" : "yield";

    if (verification?.verificationCode && verification.verificationType) {
      setStickyVerificationCode({
        type: verification.verificationType,
        code: verification.verificationCode,
      });
    } else {
      setStickyVerificationCode(null);
    }

    try {
      const verificationPayload =
        verification && !isBundlerVerification
          ? {
              verificationCode: verification.verificationCode,
              verificationType: verification.verificationType,
              verificationCodes: [
                {
                  type: verification.verificationType,
                  code: verification.verificationCode,
                },
              ],
            }
          : undefined;
      const preparedResponse =
        action === "supply"
          ? await yieldService.prepareSupply(
              opportunity.id,
              values.amount,
              sourceBalances.map(({ chain }) => chain),
              verificationPayload,
            )
          : await yieldService.prepareWithdraw(
              opportunity.id,
              values.amount,
              verificationPayload,
            );
      const prepared = preparedResponse.data;
      const stellarTransaction =
        opportunity.chain === "stellar"
          ? prepared.transactions.find(
              (transaction) =>
                transaction.txXdr || transaction.xdr || transaction.data,
            )
          : null;

      if (stellarTransaction) {
        await yieldService.executeStellar(
          opportunity.id,
          values.amount,
          stellarTransaction.txXdr ||
            stellarTransaction.xdr ||
            stellarTransaction.data ||
            "",
          action,
        );
      } else if (opportunity.chain === "solana") {
        const solanaTx = prepared.transactions[0];
        if (!solanaTx?.data) {
          throw new Error("Solana transaction payload is missing.");
        }
        let signedTx = solanaTx.data;
        if (solanaWalletsReady && solanaWallets.length > 0) {
          try {
            const rawBytes = Uint8Array.from(atob(solanaTx.data), (c) =>
              c.charCodeAt(0),
            );
            const result = await signSolanaTransaction({
              transaction: rawBytes,
              wallet: solanaWallets[0],
            });
            const signedBytes = result.signedTransaction;
            if (signedBytes) {
              signedTx = btoa(
                String.fromCharCode(...Array.from(signedBytes)),
              );
            }
          } catch {
            // Fallback to sending sponsored tx as prepared
          }
        }
        await yieldService.executeSolana(
          opportunity.id,
          values.amount,
          signedTx,
          action,
        );
      } else {
        activeVerificationContext = "submitUserOp";
        const txHash = await executeEvmTransactions(prepared);
        if (!txHash) throw new Error("The transaction did not return a hash.");
        await yieldService.confirmPosition(
          opportunity.id,
          values.amount,
          txHash,
          action,
        );
      }

      setVerificationType(null);
      setOtpSent(false);
      form.reset();
      onOpenChange(false);
      await onComplete();
      toast.success(
        action === "supply"
          ? `${symbol} is now earning`
          : `${symbol} withdrawal submitted`,
      );
    } catch (error) {
      const verificationError = findTransferVerificationRequiredError(error);
      if (verificationError) {
        const availableMethods = verificationError.availableMethods || [];
        const normalizedMethods = availableMethods.map((method) =>
          method.toLowerCase(),
        );
        const requiresWebauthn = normalizedMethods.includes("webauthn");

        if (requiresWebauthn) {
          if (verification?.verificationType === "webauthn") {
            toast.error(
              "Passkey verification was not accepted. Please try again.",
            );
            return;
          }

          if (mfaMethods.length > 0 && !mfaMethods.includes("passkey")) {
            toast.error(
              "This transaction requires a passkey, but no passkey is enrolled for this account.",
            );
            return;
          }

          try {
            await promptMfa();
            const attestation = await createWebauthnAttestation();
            await performAction(values, {
              verificationCode: attestation,
              verificationType: "webauthn",
              context: activeVerificationContext,
            });
          } catch (passkeyError) {
            toast.error(
              passkeyError instanceof Error
                ? passkeyError.message
                : "Passkey verification was not completed.",
            );
          }
          return;
        }

        setVerificationContext(activeVerificationContext);
        setOtpSent(verificationError.verificationType !== "totp");
        setVerificationType(verificationError.verificationType);

        if (verificationError.verificationType === "totp") {
          toast.info("Enter your authenticator code to continue.");
        }
        return;
      }

      toast.error(
        error instanceof Error ? error.message : "The Earn action failed.",
      );
    } finally {
      setStickyVerificationCode(null);
      setIsSubmitting(false);
    }
  };

  const title = action === "supply" ? "Start earning" : "Withdraw position";
  const ActionIcon =
    action === "supply" ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <>
      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="gap-0 overflow-hidden rounded-[32px] border-none bg-gray-70 p-0 outline-none dark:bg-black2 [&>button]:hidden sm:max-w-[425px]">
          <div className="px-5 pt-5">
            <div className="mb-5 flex justify-end">
              <button
                type="button"
                onClick={() => closeDialog(false)}
                aria-label={`Close ${title.toLowerCase()} dialog`}
                className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-black/5 bg-white text-slate-600 transition-opacity hover:opacity-80 dark:border-none dark:bg-secondary-60/50 dark:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <DialogHeader className="items-center text-center sm:text-center">
              <DialogTitle className="text-xl font-bold text-cryptoNight dark:text-white">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-30 dark:text-secondary-90">
                {action === "supply"
                  ? "Put your stablecoins to work through a supported protocol."
                  : "Move supplied funds back to your Kellon wallet."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {opportunity ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => performAction(values))}
                className="space-y-5 px-5 pb-5 pt-6"
              >
                {!hideOpportunitySummary ? (
                  <div className="flex items-center justify-between rounded-[24px] border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-secondary-60">
                    <div className="flex items-center gap-3">
                      <AssetNetworkIcon
                        symbol={opportunity.symbol}
                        network={opportunity.chain}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-bold text-cryptoNight dark:text-white">
                          {getProtocolName(opportunity.protocol)}
                        </p>
                        <p className="mt-0.5 text-xs capitalize text-gray-30 dark:text-gray-40">
                          {opportunity.symbol} on {opportunity.chain}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-primary-50 dark:text-primary-80">
                        {formatApy(opportunity.apy)}
                      </p>
                      <p className="text-[10px] font-semibold uppercase text-gray-30 dark:text-gray-40">
                        APY
                      </p>
                    </div>
                  </div>
                ) : null}

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="earn-amount"
                          className="text-xs font-semibold text-gray-20 dark:text-secondary-90"
                        >
                          Amount
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            form.setValue("amount", String(availableAmount), {
                              shouldValidate: true,
                            })
                          }
                          className="cursor-pointer text-xs font-bold text-primary-50 transition-colors hover:text-primary-30 dark:text-primary-80"
                        >
                          Max
                        </button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            id="earn-amount"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            className="h-14 rounded-[18px] border border-black/5 bg-white pr-20 text-xl font-bold text-cryptoNight shadow-none dark:border-white/10 dark:bg-secondary-60 dark:text-white"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-20 dark:text-secondary-90">
                            {symbol}
                          </span>
                        </div>
                      </FormControl>
                      <div className="flex items-center justify-between text-[11px] text-gray-30 dark:text-secondary-90">
                        <span>Available</span>
                        <span>
                          {formatTokenAmount(availableAmount)} {symbol}
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  variant="flow"
                  size="flow"
                  className="h-14 rounded-[18px]"
                  disabled={isSubmitting || availableAmount <= 0}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ActionIcon className="transition-transform group-hover:translate-x-0.5" />
                    )}
                    {isSubmitting
                      ? "Processing..."
                      : action === "supply"
                        ? "Start earning"
                        : "Withdraw"}
                  </span>
                  {!isSubmitting && availableAmount > 0 ? (
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                  ) : null}
                </Button>
              </form>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>

      <TransferVerificationModal
        isOpen={Boolean(verificationType)}
        isSubmitting={isSubmitting}
        verificationType={verificationType || "email_otp"}
        title={
          verificationType !== "totp" && !otpSent
            ? "Email verification"
            : action === "supply"
              ? "Confirm deposit"
              : "Confirm withdrawal"
        }
        description={
          verificationType === "totp"
            ? "Enter the code from your authenticator app to continue."
            : otpSent
              ? "Enter the one-time code sent by email."
              : "We'll send a verification code to your email to authorize this transaction."
        }
        selectedMethod={verificationType === "totp" ? "totp" : "email_otp"}
        otpSent={otpSent}
        onResend={requestEarnOtp}
        isResending={isRequestingOtp}
        onClose={() => {
          setVerificationType(null);
          setOtpSent(false);
        }}
        onSubmit={(verificationCode) => {
          const activeVerificationType = verificationType || "email_otp";
          form.handleSubmit((values) =>
            performAction(values, {
              verificationCode,
              verificationType: activeVerificationType,
              context: verificationContext,
            }),
          )();
        }}
      />
    </>
  );
}
