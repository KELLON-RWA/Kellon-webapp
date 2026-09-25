"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useWallets } from "@privy-io/react-auth";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import {
  findTransferVerificationRequiredError,
  transferService,
} from "@/services/api/transfers";
import {
  beginOperation,
  createWebauthnAttestation,
  endOperation,
} from "@/services/api";
import {
  setStickyVerificationCode,
  useSmartAccount,
} from "@/hooks/useSmartAccount";
import {
  stocksService,
  type StockListing,
  type StockPortfolioHolding,
} from "@/services/api/stocks";
import type { User } from "@/types/db";
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
  getMaxUsableBalanceForChain,
  getStockSettlementChain,
} from "./earn-utils";

export type StockActionType = "buy" | "sell";

interface StockActionVerification {
  verificationCode: string;
  verificationType: "email_otp" | "sms_otp" | "totp" | "webauthn";
  context: "stocks";
}

interface StockActionDialogProps {
  action: StockActionType;
  stock: StockListing | null;
  holding?: StockPortfolioHolding | null;
  profile: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => Promise<void> | void;
}

interface StockSmartAccountClient {
  account: { address: string };
  chain: unknown;
  sendTransaction(
    args:
      | {
          account: unknown;
          chain: unknown;
          calls: Array<{
            to: `0x${string}`;
            data: `0x${string}`;
            value: bigint;
          }>;
        }
      | {
          account: unknown;
          chain: unknown;
          to: `0x${string}`;
          data: `0x${string}`;
          value: bigint;
        },
  ): Promise<string>;
}

export default function StockActionDialog({
  action,
  stock,
  holding,
  profile,
  open,
  onOpenChange,
  onComplete,
}: StockActionDialogProps) {
  const { wallets, ready: walletsReady } = useWallets();
  const { getSmartAccountClient } = useSmartAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationType, setVerificationType] = useState<
    "email_otp" | "sms_otp" | "totp" | null
  >(null);
  const [verificationAction, setVerificationAction] = useState("stocks");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const otpRequestInFlightRef = useRef(false);
  const lastOtpRequestAtRef = useRef(0);

  const listingSymbol = stock?.symbol || holding?.symbol || "";
  const symbol = listingSymbol
    .replace(/[bc]$/i, "")
    .replace(/^b/i, "")
    .toUpperCase();
  const stockLogoUrl =
    stock?.logoUrl ||
    `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(symbol)}.png`;
  const stockPrice = Number(stock?.price || holding?.currentPrice || 0);
  const stockProvider = stock?.provider || holding?.provider || "";
  const targetStockChain = getStockSettlementChain(
    stockProvider,
    stock?.settlementChain || stock?.chain || stock?.network,
  );

  // Purchases can only spend USDC held on the provider's settlement chain.
  const availableUsdc = getMaxUsableBalanceForChain(
    profile,
    "USDC",
    targetStockChain,
  );

  // Available shares for sell: holdings count
  const availableShares = Number(holding?.shares || 0);

  const schema = useMemo(
    () =>
      z.object({
        value: z
          .string()
          .trim()
          .min(
            1,
            action === "buy" ? "Enter a USD amount" : "Enter number of shares",
          )
          .refine(
            (val) => Number.isFinite(Number(val)) && Number(val) > 0,
            "Enter a valid positive number",
          )
          .refine(
            (val) => {
              if (action === "buy") {
                return Number(val) <= availableUsdc;
              }
              return Number(val) <= availableShares;
            },
            action === "buy"
              ? `Maximum available balance is $${availableUsdc.toFixed(2)} USDC`
              : `Maximum available shares: ${availableShares.toFixed(4)}`,
          ),
      }),
    [action, availableUsdc, availableShares],
  );

  type FormSchema = z.infer<typeof schema>;
  const form = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: { value: "" },
  });

  const watchValue = Number(form.watch("value")) || 0;
  const calculatedShares =
    action === "buy" && stockPrice > 0 ? watchValue / stockPrice : 0;
  const calculatedProceeds =
    action === "sell" && stockPrice > 0 ? watchValue * stockPrice : 0;

  const closeDialog = (nextOpen: boolean) => {
    if (isSubmitting) return;
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  const requestStockOtp = async (
    channel?: "email" | "sms",
    context = verificationAction,
  ) => {
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
      const deliveryChannel =
        channel || (verificationType === "sms_otp" ? "sms" : "email");
      const response = await transferService.requestOTP(
        context,
        deliveryChannel,
      );
      setOtpSent(true);
      toast.success(
        response.data?.message ||
          `Verification code sent by ${deliveryChannel === "sms" ? "SMS" : "email"}.`,
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

  const performStockAction = async (
    values: FormSchema,
    verification?: StockActionVerification,
  ) => {
    if (!stock && !holding) return;
    const currentStock = stock || {
      symbol: holding!.symbol,
      name: holding!.symbol,
      price: holding!.currentPrice,
      currency: "USD",
      provider: holding!.provider,
    };

    setIsSubmitting(true);
    beginOperation(Boolean(verification));

    if (verification) {
      setStickyVerificationCode({
        type: verification.verificationType,
        code: verification.verificationCode,
      });
    } else {
      setStickyVerificationCode(null);
    }

    try {
      const verificationPayload = verification
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
        : {};

      if (action === "buy") {
        const transactionChain = getStockSettlementChain(
          currentStock.provider,
          currentStock.settlementChain ||
            currentStock.chain ||
            currentStock.network,
        );
        if (transactionChain !== targetStockChain) {
          throw new Error(
            "Funding chain does not match the chain this stock settles on.",
          );
        }
        if (!walletsReady) {
          throw new Error("Your wallet is still loading. Please try again.");
        }

        const embeddedWallet = wallets.find(
          (wallet) =>
            wallet.walletClientType === "privy" &&
            wallet.address.toLowerCase().startsWith("0x"),
        );
        if (!embeddedWallet) {
          throw new Error("Your embedded wallet is not available.");
        }

        const rawClient = await getSmartAccountClient(
          embeddedWallet,
          targetStockChain,
        );
        if (!rawClient) {
          throw new Error("Smart Account wallet client is not ready.");
        }

        const client = rawClient as unknown as StockSmartAccountClient;
        const amountFiat = Number(values.value);
        const buildRes = await stocksService.buildBuyTransaction({
          symbol: currentStock.symbol,
          amountFiat,
          currency: currentStock.currency || "USD",
          provider: currentStock.provider,
          fundingSymbol: "USDC",
          fundingChain: targetStockChain,
          userAddress: client.account.address,
          ...verificationPayload,
        });

        const batchedCalls = (buildRes.data?.calls || []).map((call) => ({
          to: call.to as `0x${string}`,
          data: (call.data || "0x") as `0x${string}`,
          value: BigInt(call.value || "0"),
        }));

        if (!batchedCalls.length && !buildRes.data?.to) {
          throw new Error("The stock purchase transaction could not be built.");
        }

        const txHash = batchedCalls.length
          ? await client.sendTransaction({
              account: client.account,
              chain: client.chain,
              calls: batchedCalls,
            })
          : await client.sendTransaction({
              account: client.account,
              chain: client.chain,
              to: buildRes.data.to as `0x${string}`,
              data: (buildRes.data.data || "0x") as `0x${string}`,
              value: BigInt(buildRes.data.value || "0"),
            });

        if (!txHash.startsWith("0x")) {
          throw new Error(
            "On-chain stock purchase transaction failed to broadcast.",
          );
        }

        const res = await stocksService.confirmTransaction({
          symbol: currentStock.symbol,
          amountFiat,
          shares:
            buildRes.data.quote?.shares || amountFiat / currentStock.price,
          provider: currentStock.provider,
          txHash,
          fundingSymbol: "USDC",
          fundingChain: targetStockChain,
          ...verificationPayload,
        });

        toast.success(
          res.message || `Successfully purchased ${currentStock.symbol} stock!`,
        );
      } else {
        const res = await stocksService.sellStock({
          symbol: currentStock.symbol,
          shares: Number(values.value),
          currency: currentStock.currency || "USD",
          provider: currentStock.provider,
          ...verificationPayload,
        });

        toast.success(
          res.message || `Successfully sold shares of ${currentStock.symbol}!`,
        );
      }

      setVerificationType(null);
      setOtpSent(false);
      form.reset();
      onOpenChange(false);
      await onComplete();
      endOperation();
    } catch (error: unknown) {
      const mfaErr = findTransferVerificationRequiredError(error);

      if (mfaErr) {
        if (mfaErr.availableMethods?.includes("webauthn")) {
          if (verification?.verificationType === "webauthn") {
            endOperation();
            toast.error(
              "Passkey verification was not accepted. Please try again.",
            );
            return;
          }

          try {
            const attestation = await createWebauthnAttestation();
            await performStockAction(values, {
              verificationCode: attestation,
              verificationType: "webauthn",
              context: "stocks",
            });
            return;
          } catch (passkeyErr) {
            endOperation();
            toast.error(
              passkeyErr instanceof Error
                ? passkeyErr.message
                : "Passkey verification failed.",
            );
            return;
          }
        }

        const nextType = mfaErr.verificationType;
        const nextAction = mfaErr.action || "stocks";
        setVerificationAction(nextAction);
        setVerificationType(
          nextType === "totp"
            ? "totp"
            : nextType === "sms_otp"
              ? "sms_otp"
              : "email_otp",
        );

        if (nextType !== "totp" && !verification) {
          await requestStockOtp(
            nextType === "sms_otp" ? "sms" : "email",
            nextAction,
          );
        }
        return;
      }

      endOperation();
      // RPC providers can include full calldata in an error message. That is useful
      // for developers but far too noisy (and not actionable) in a customer toast.
      console.error(`[StockActionDialog] Failed to ${action} stock:`, error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setStickyVerificationCode(null);
      setIsSubmitting(false);
    }
  };

  const title = action === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`;
  const ActionIcon = action === "buy" ? ArrowUpFromLine : ArrowDownToLine;
  const isAvailableZero =
    action === "buy" ? availableUsdc <= 0 : availableShares <= 0;

  return (
    <>
      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-[32px] border-none bg-gray-70 p-0 shadow-2xl outline-none data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom dark:bg-black2 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[calc(100dvh-4rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[32px]">
          <div className="border-b border-gray-80 bg-gray-70 px-5 py-5 dark:border-white/10 dark:bg-black2">
            <DialogHeader>
              <DialogTitle className="text-left text-lg text-cryptoNight dark:text-white">
                {title}
              </DialogTitle>
              <DialogDescription className="text-left text-xs text-gray-30 dark:text-gray-40">
                {action === "buy"
                  ? "Purchase 24/7 tokenized equity backed by live market oracle pricing."
                  : "Liquidate tokenized stock shares directly back into your USDC balance."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {stock || holding ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) =>
                  performStockAction(values),
                )}
                className="space-y-5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:p-5"
              >
                <div className="flex items-center justify-between rounded-lg border border-gray-80 bg-white p-4 dark:border-white/10 dark:bg-secondary-50">
                  <div className="flex items-center gap-3">
                    <AssetNetworkIcon
                      symbol={symbol}
                      network={targetStockChain}
                      size="sm"
                      imageSrc={stockLogoUrl}
                    />
                    <div>
                      <p className="text-sm font-bold text-cryptoNight dark:text-white">
                        {symbol}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-gray-30 dark:text-gray-40">
                        {(stock?.provider || holding?.provider || "").replace(
                          "_",
                          " ",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-primary-50 dark:text-primary-80">
                      ${stockPrice.toFixed(2)}
                    </p>
                    <p className="text-[10px] font-semibold uppercase text-gray-30 dark:text-gray-40">
                      Per Share
                    </p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="stock-amount"
                          className="text-xs font-semibold text-gray-20 dark:text-gray-40"
                        >
                          {action === "buy"
                            ? "Amount in USD ($)"
                            : "Shares to Sell"}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            form.setValue(
                              "value",
                              String(
                                action === "buy"
                                  ? availableUsdc
                                  : availableShares,
                              ),
                              { shouldValidate: true },
                            )
                          }
                          className="cursor-pointer text-xs font-bold text-primary-50 hover:text-primary-30 dark:text-primary-80"
                        >
                          Max
                        </button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            id="stock-amount"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            className="h-14 rounded-lg border-gray-80 bg-white pr-24 text-xl font-bold text-cryptoNight dark:border-white/10 dark:bg-secondary-50 dark:text-white"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-20 dark:text-gray-40">
                            {action === "buy" ? "USD" : "Shares"}
                          </span>
                        </div>
                      </FormControl>
                      <div className="flex items-center justify-between text-[11px] text-gray-30 dark:text-gray-40">
                        <span>
                          {action === "buy"
                            ? "Available USDC"
                            : "Available Shares"}
                        </span>
                        <span>
                          {action === "buy"
                            ? `$${availableUsdc.toFixed(2)} USDC`
                            : `${availableShares.toFixed(4)} Shares`}
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Calculation preview */}
                {watchValue > 0 && stockPrice > 0 && (
                  <div className="rounded-lg bg-gray-90 p-3 text-xs dark:bg-secondary-60">
                    <div className="flex justify-between text-gray-20 dark:text-gray-30">
                      <span>
                        {action === "buy"
                          ? "Estimated Shares"
                          : "Estimated Proceeds"}
                      </span>
                      <span className="font-bold text-cryptoNight dark:text-white">
                        {action === "buy"
                          ? `${calculatedShares.toFixed(4)} ${symbol}`
                          : `$${calculatedProceeds.toFixed(2)} USDC`}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="flow"
                  size="flow"
                  disabled={isSubmitting || isAvailableZero}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ActionIcon className="transition-transform group-hover:translate-x-0.5" />
                    )}
                    {isSubmitting
                      ? "Processing..."
                      : isAvailableZero
                        ? action === "buy"
                          ? "Insufficient USDC Balance"
                          : "No Shares Available"
                        : action === "buy"
                          ? `Buy ${symbol}`
                          : `Sell ${symbol}`}
                  </span>
                  {!isSubmitting && !isAvailableZero ? (
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
            ? verificationType === "sms_otp"
              ? "SMS verification"
              : "Email verification"
            : action === "buy"
              ? "Verify Stock Purchase"
              : "Verify Stock Sale"
        }
        description={
          verificationType === "totp"
            ? "Enter the code from your authenticator app to authorize stock trade."
            : otpSent
              ? `Enter the one-time verification code sent by ${verificationType === "sms_otp" ? "SMS" : "email"}.`
              : `Send a one-time code by ${verificationType === "sms_otp" ? "SMS" : "email"}.`
        }
        selectedMethod={verificationType || "email_otp"}
        otpSent={otpSent}
        onResend={requestStockOtp}
        isResending={isRequestingOtp}
        onClose={() => {
          setVerificationType(null);
          setVerificationAction("stocks");
          setOtpSent(false);
          endOperation();
        }}
        onSubmit={(verificationCode) => {
          const activeVerificationType = verificationType || "email_otp";
          form.handleSubmit((values) =>
            performStockAction(values, {
              verificationCode,
              verificationType: activeVerificationType,
              context: "stocks",
            }),
          )();
        }}
      />
    </>
  );
}
