"use client";

import { chainStatus } from "@/lib/chain-status";

import { zodResolver } from "@hookform/resolvers/zod";
import { useWallets } from "@privy-io/react-auth";
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import {
  findTransferVerificationRequiredError,
  getAvailableVerificationMethods,
  transferService,
  type VerificationMethod,
} from "@/services/api/transfers";
import {
  getEnabledTransactionVerificationMethods,
  securityService,
} from "@/services/api/security";
import {
  beginOperation,
  createWebauthnAttestation,
  endOperation,
} from "@/services/api";
import { syncMyAssets } from "@/services/api/user";
import { queryClient } from "@/components/providers/ReactQueryProvider";
import {
  setStickyVerificationCode,
  useSmartAccount,
} from "@/hooks/useSmartAccount";
import { expectedSafeFor, resolveEvmSigner } from "@/lib/evm-signer";
import { getActiveChains } from "@/lib/chains";
import {
  stocksService,
  type StockListing,
  type StockPortfolioHolding,
  type SellStockResponse,
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
  getStockProviderLabel,
  getStockSettlementChain,
} from "./earn-utils";

export type StockActionType = "buy" | "sell";

type StockVerificationContext = "stocks" | "transfer";

interface StockActionVerification {
  verificationCode: string;
  verificationType: "email_otp" | "sms_otp" | "totp" | "webauthn";
  context: StockVerificationContext;
}

interface StockActionDialogProps {
  action: StockActionType;
  stock: StockListing | null;
  holding?: StockPortfolioHolding | null;
  stockOptions?: StockListing[];
  profile: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => Promise<void> | void;
  onViewPosition?: () => void;
}

type StockOrderSuccess = {
  side: StockActionType;
  symbol: string;
  shares: number;
  price: number;
  value: number;
};

const BALANCE_RECONCILIATION_DELAY_MS = 5_000;

function getDisplayTicker(symbol: string, provider?: string): string {
  const raw = symbol.trim();
  const withoutProviderSuffix = /[bc]$/i.test(raw) ? raw.slice(0, -1) : raw;
  const withoutXStockSuffix =
    provider?.toLowerCase().includes("xstock") &&
    /x$/i.test(withoutProviderSuffix)
      ? withoutProviderSuffix.slice(0, -1)
      : withoutProviderSuffix;

  return (
    withoutXStockSuffix.startsWith("b")
      ? withoutXStockSuffix.slice(1)
      : withoutXStockSuffix
  ).toUpperCase();
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
  stockOptions = [],
  profile,
  open,
  onOpenChange,
  onComplete,
  onViewPosition,
}: StockActionDialogProps) {
  const { wallets, ready: walletsReady } = useWallets();
  const { getSmartAccountClient } = useSmartAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationType, setVerificationType] = useState<
    "email_otp" | "sms_otp" | "totp" | null
  >(null);
  const [verificationMethods, setVerificationMethods] = useState<
    VerificationMethod[]
  >([]);
  const [verificationAction, setVerificationAction] =
    useState<StockVerificationContext>("stocks");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<StockOrderSuccess | null>(
    null,
  );
  const [selectedFundingChain, setSelectedFundingChain] = useState("");
  const [fundingSymbol, setFundingSymbol] = useState<"USDC" | "USDT">("USDC");
  const [isNetworkPickerOpen, setIsNetworkPickerOpen] = useState(false);
  const otpRequestInFlightRef = useRef(false);
  const lastOtpRequestAtRef = useRef(0);

  const stockRoutes = useMemo(() => {
    const candidates =
      action === "sell" && holding
        ? stockOptions.filter(
            (option) =>
              option.provider.toLowerCase() === holding.provider.toLowerCase(),
          )
        : stockOptions.length
          ? stockOptions
          : stock
            ? [stock]
            : [];
    const routesByChain = new Map<
      ReturnType<typeof getStockSettlementChain>,
      StockListing
    >();

    candidates.forEach((option) => {
      const chain = getStockSettlementChain(
        option.provider,
        option.settlementChain || option.chain || option.network,
      );
      if (!routesByChain.has(chain)) routesByChain.set(chain, option);
    });

    return [...routesByChain.entries()].map(([chain, option]) => ({
      chain,
      stock: option,
    }));
  }, [action, holding, stock, stockOptions]);
  const selectedRoute =
    stockRoutes.find((route) => route.chain === selectedFundingChain) ||
    stockRoutes[0];
  const currentStock =
    selectedRoute?.stock ||
    (action === "sell" && holding
      ? {
          symbol: holding.symbol,
          name: holding.symbol,
          price: holding.currentPrice,
          currency: "USD",
          provider: holding.provider,
        }
      : stock);
  const targetStockChain =
    selectedRoute?.chain ||
    getStockSettlementChain(
      currentStock?.provider || holding?.provider || "",
      currentStock?.settlementChain ||
        currentStock?.chain ||
        currentStock?.network,
    );
  const supportedFundingSymbols = useMemo<Array<"USDC" | "USDT">>(() => {
    const chain = getActiveChains()[targetStockChain];
    const symbols = (["USDC", "USDT"] as const).filter((symbol) =>
      Boolean(chain?.[symbol === "USDC" ? "usdcAddress" : "usdtAddress"]),
    );
    return symbols.length ? symbols : ["USDC"];
  }, [targetStockChain]);

  useEffect(() => {
    if (!open || action === "sell" || !stockRoutes.length) return;

    const preferredRoute = [...stockRoutes].sort((left, right) => {
      const leftBalance =
        getMaxUsableBalanceForChain(profile, "USDC", left.chain) +
        getMaxUsableBalanceForChain(profile, "USDT", left.chain);
      const rightBalance =
        getMaxUsableBalanceForChain(profile, "USDC", right.chain) +
        getMaxUsableBalanceForChain(profile, "USDT", right.chain);
      return rightBalance - leftBalance;
    })[0];
    setSelectedFundingChain(preferredRoute.chain);
  }, [action, open, profile, stockRoutes]);

  useEffect(() => {
    if (supportedFundingSymbols.includes(fundingSymbol)) return;
    setFundingSymbol(supportedFundingSymbols[0]);
  }, [fundingSymbol, supportedFundingSymbols]);

  useEffect(() => {
    if (!open) setIsNetworkPickerOpen(false);
  }, [open]);

  const listingSymbol = currentStock?.symbol || holding?.symbol || "";
  const symbol = getDisplayTicker(
    listingSymbol,
    currentStock?.provider || holding?.provider,
  );
  const stockLogoUrl =
    currentStock?.logoUrl ||
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(symbol)}`;
  const stockPrice = Number(currentStock?.price || holding?.currentPrice || 0);
  const stockProvider = currentStock?.provider || holding?.provider || "";

  const availableFundingBalance = getMaxUsableBalanceForChain(
    profile,
    fundingSymbol,
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
                return Number(val) <= availableFundingBalance;
              }
              return Number(val) <= availableShares;
            },
            action === "buy"
              ? `Maximum available balance is $${availableFundingBalance.toFixed(2)} ${fundingSymbol}`
              : `Maximum available shares: ${availableShares.toFixed(4)}`,
          ),
      }),
    [action, availableFundingBalance, availableShares, fundingSymbol],
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

  const reconcileWalletBalances = async () => {
    try {
      const response = await syncMyAssets();
      if (response.data) {
        queryClient.setQueryData(["user-session"], response.data);
      }
    } catch {
      // The transaction is already confirmed. The dashboard's normal live sync
      // will retry if this immediate reconciliation is temporarily unavailable.
    }
  };

  const prepareStockVerification = async (values: FormSchema) => {
    setIsSubmitting(true);

    try {
      const securitySettings = await securityService.getSettings();
      const availableMethods =
        getEnabledTransactionVerificationMethods(securitySettings);

      if (!availableMethods.length) {
        await performStockAction(values);
        return;
      }

      const selectedMethod = availableMethods[0];
      setVerificationAction("stocks");
      setVerificationMethods(availableMethods);
      setVerificationType(selectedMethod);
      // OTP delivery is deliberately user initiated from the verification modal.
      setOtpSent(selectedMethod === "totp");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to load your verification methods.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const performStockAction = async (
    values: FormSchema,
    verification?: StockActionVerification,
  ) => {
    if (!currentStock && !holding) return;
    const tradeStock = currentStock || {
      symbol: holding!.symbol,
      name: holding!.symbol,
      price: holding!.currentPrice,
      currency: "USD",
      provider: holding!.provider,
    };

    setIsSubmitting(true);
    beginOperation(Boolean(verification));

    setStickyVerificationCode(
      verification?.context === "transfer"
        ? {
            type: verification.verificationType,
            code: verification.verificationCode,
          }
        : null,
    );

    try {
      const verificationPayload =
        verification?.context === "stocks"
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

      const transactionChain = getStockSettlementChain(
        tradeStock.provider,
        tradeStock.settlementChain || tradeStock.chain || tradeStock.network,
      );
      const chainBlocked = chainStatus.blockedMessage(
        transactionChain,
        action === "buy" ? "in" : "out",
      );
      if (chainBlocked) throw new Error(chainBlocked);
      if (transactionChain !== targetStockChain) {
        throw new Error(
          "The settlement chain does not match this stock listing.",
        );
      }
      if (!walletsReady) {
        throw new Error("Your wallet is still loading. Please try again.");
      }

      const embeddedWallet = resolveEvmSigner(wallets, profile.chainAccounts);
      if (!embeddedWallet) {
        throw new Error(
          "Your wallet is not available on this device. Please log out and log in again.",
        );
      }

      const rawClient = await getSmartAccountClient(
        embeddedWallet,
        targetStockChain,
        expectedSafeFor(profile.chainAccounts, targetStockChain),
      );
      if (!rawClient) {
        throw new Error("Smart Account wallet client is not ready.");
      }

      const client = rawClient as unknown as StockSmartAccountClient;
      const shares = action === "sell" ? Number(values.value) : undefined;
      const amountFiat =
        action === "sell" ? calculatedProceeds : Number(values.value);
      const buildRes = await stocksService.buildBuyTransaction({
        symbol: tradeStock.symbol,
        amountFiat,
        currency: tradeStock.currency || "USD",
        provider: tradeStock.provider,
        fundingSymbol,
        fundingChain: targetStockChain,
        userAddress: client.account.address,
        side: action,
        shares,
        ...verificationPayload,
      });

      const batchedCalls = (buildRes.data?.calls || []).map((call) => ({
        to: call.to as `0x${string}`,
        data: (call.data || "0x") as `0x${string}`,
        value: BigInt(call.value || "0"),
      }));

      if (!batchedCalls.length && !buildRes.data?.to) {
        throw new Error(
          `The stock ${action === "buy" ? "purchase" : "sale"} transaction could not be built.`,
        );
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
          `On-chain stock ${action === "buy" ? "purchase" : "sale"} transaction failed to broadcast.`,
        );
      }

      const res = await stocksService.confirmTransaction({
        symbol: tradeStock.symbol,
        amountFiat,
        shares:
          shares ||
          buildRes.data.quote?.shares ||
          amountFiat / tradeStock.price,
        provider: tradeStock.provider,
        txHash,
        fundingSymbol,
        fundingChain: targetStockChain,
        side: action,
        ...verificationPayload,
      });

      if (action === "buy") {
        const purchase = res.data;
        setOrderSuccess({
          side: "buy",
          symbol: purchase?.symbol || tradeStock.symbol,
          shares:
            Number(purchase?.shares) ||
            buildRes.data.quote?.shares ||
            amountFiat / tradeStock.price,
          price: Number(purchase?.price) || tradeStock.price,
          value: Number(purchase?.cost) || amountFiat,
        });
      } else {
        const sale = res.data as unknown as SellStockResponse | undefined;
        setOrderSuccess({
          side: "sell",
          symbol: tradeStock.symbol,
          shares: shares || Number(values.value),
          price: Number(sale?.price) || tradeStock.price,
          value: Number(sale?.proceeds) || amountFiat,
        });
      }

      setVerificationType(null);
      setVerificationMethods([]);
      setOtpSent(false);
      form.reset();
      onOpenChange(false);
      await Promise.all([onComplete(), reconcileWalletBalances()]);

      // The stock provider can confirm an order before every RPC/indexer reflects
      // the USDC debit. Reconcile once more shortly after the immediate refresh.
      window.setTimeout(() => {
        void reconcileWalletBalances();
      }, BALANCE_RECONCILIATION_DELAY_MS);
      endOperation();
    } catch (error: unknown) {
      const mfaErr = findTransferVerificationRequiredError(error);

      if (mfaErr) {
        const nextAction: StockVerificationContext =
          mfaErr.action === "transfer" ? "transfer" : "stocks";
        const nextType = mfaErr.verificationType;
        const availableMethods = getAvailableVerificationMethods(
          mfaErr.availableMethods,
          nextType,
        );
        setVerificationAction(nextAction);

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
              context: nextAction,
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

        setVerificationMethods(availableMethods);
        const selectedMethod = availableMethods.includes("email_otp")
          ? "email_otp"
          : availableMethods[0] || nextType;
        setVerificationType(selectedMethod);
        // Let the customer choose a verification method before sending a code.
        // The verification modal exposes an explicit "Send code" action for OTP methods.
        setOtpSent(selectedMethod === "totp");
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
    action === "buy" ? availableFundingBalance <= 0 : availableShares <= 0;
  const selectFundingRoute = (chain: string) => {
    setSelectedFundingChain(chain);
    form.reset({ value: "" });
    setIsNetworkPickerOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-0 shadow-2xl outline-none data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom dark:bg-none dark:bg-black2 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[calc(100dvh-4rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[32px]">
          <div className="border-b border-gray-80 bg-transparent px-5 py-5 dark:border-white/10">
            {isNetworkPickerOpen ? (
              <button
                type="button"
                onClick={() => setIsNetworkPickerOpen(false)}
                className="mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-gray-80 text-cryptoNight transition hover:border-primary-60 dark:border-white/10 dark:text-white"
                aria-label="Back to stock order"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <DialogHeader>
              <DialogTitle className="text-left text-lg text-cryptoNight dark:text-white">
                {isNetworkPickerOpen ? "Select funding network" : title}
              </DialogTitle>
              <DialogDescription className="text-left text-xs text-gray-30 dark:text-gray-40">
                {isNetworkPickerOpen
                  ? "Choose a network that supports this stock and holds your stablecoins."
                  : action === "buy"
                    ? "Purchase 24/7 tokenized equity backed by live market oracle pricing."
                    : "Liquidate tokenized stock shares directly back into your USDC balance."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {isNetworkPickerOpen && action === "buy" ? (
            <div className="min-h-0 space-y-3 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:p-5">
              {stockRoutes.map((route) => {
                const chainName =
                  getActiveChains()[route.chain]?.name ||
                  route.chain.toUpperCase();
                const usdcBalance = getMaxUsableBalanceForChain(
                  profile,
                  "USDC",
                  route.chain,
                );
                const usdtBalance = getMaxUsableBalanceForChain(
                  profile,
                  "USDT",
                  route.chain,
                );
                const isSelected = route.chain === targetStockChain;

                return (
                  <button
                    key={route.chain}
                    type="button"
                    onClick={() => selectFundingRoute(route.chain)}
                    className={
                      isSelected
                        ? "flex w-full items-center justify-between rounded-xl border border-primary-60 bg-primary-70/10 px-3 py-3 text-left"
                        : "flex w-full items-center justify-between rounded-xl border border-gray-80 bg-white px-3 py-3 text-left transition hover:border-primary-60/60 dark:border-white/10 dark:bg-secondary-50"
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <AssetNetworkIcon
                        symbol="USDC"
                        network={route.chain}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-cryptoNight dark:text-white">
                          {chainName}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-gray-30 dark:text-gray-40">
                          {usdcBalance.toFixed(2)} USDC ·{" "}
                          {usdtBalance.toFixed(2)} USDT
                        </span>
                      </span>
                    </span>
                    {isSelected ? (
                      <Check className="h-5 w-5 shrink-0 text-primary-60" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : currentStock || holding ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) =>
                  prepareStockVerification(values),
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
                        {getStockProviderLabel(stockProvider)}
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

                {action === "buy" ? (
                  <section aria-label="Funding network" className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-cryptoNight dark:text-white">
                        Funding network
                      </p>
                      <p className="mt-1 text-[11px] text-gray-30 dark:text-gray-40">
                        Only networks that support this stock are available.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNetworkPickerOpen(true)}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-80 bg-white px-3 py-3 text-left transition hover:border-primary-60/60 dark:border-white/10 dark:bg-secondary-50"
                      aria-haspopup="dialog"
                      aria-expanded={isNetworkPickerOpen}
                    >
                      <AssetNetworkIcon
                        symbol="USDC"
                        network={targetStockChain}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-cryptoNight dark:text-white">
                          {getActiveChains()[targetStockChain]?.name ||
                            targetStockChain.toUpperCase()}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-gray-30 dark:text-gray-40">
                          {getMaxUsableBalanceForChain(
                            profile,
                            "USDC",
                            targetStockChain,
                          ).toFixed(2)}{" "}
                          USDC ·{" "}
                          {getMaxUsableBalanceForChain(
                            profile,
                            "USDT",
                            targetStockChain,
                          ).toFixed(2)}{" "}
                          USDT
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-50 dark:text-primary-80">
                        Change
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                    {supportedFundingSymbols.length > 1 ? (
                      <div className="grid grid-cols-2 rounded-xl border border-gray-80 p-1 dark:border-white/10">
                        {supportedFundingSymbols.map((symbolOption) => (
                          <button
                            key={symbolOption}
                            type="button"
                            onClick={() => setFundingSymbol(symbolOption)}
                            className={
                              fundingSymbol === symbolOption
                                ? "rounded-lg bg-primary-60 py-2 text-xs font-semibold text-white"
                                : "rounded-lg py-2 text-xs font-semibold text-gray-30 transition hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                            }
                          >
                            Pay with {symbolOption}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}

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
                                  ? availableFundingBalance
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
                            ? `Available ${fundingSymbol}`
                            : "Available Shares"}
                        </span>
                        <span>
                          {action === "buy"
                            ? `${availableFundingBalance.toFixed(2)} ${fundingSymbol}`
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
                  variant={action === "sell" ? "destructive" : "flow"}
                  size="flow"
                  className={
                    action === "sell"
                      ? "group relative overflow-hidden rounded-xl bg-red-500 font-bold text-white shadow-lg hover:bg-red-600 hover:shadow-xl active:scale-[0.98] dark:bg-red-600 dark:hover:bg-red-500"
                      : undefined
                  }
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
                          ? `Insufficient ${fundingSymbol} Balance`
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
        availableMethods={verificationMethods}
        onMethodChange={(method) => {
          setVerificationType(method);
          setOtpSent(method === "totp");
        }}
        otpSent={otpSent}
        onResend={requestStockOtp}
        isResending={isRequestingOtp}
        onClose={() => {
          setVerificationType(null);
          setVerificationMethods([]);
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
              context: verificationAction,
            }),
          )();
        }}
      />

      <Dialog
        open={Boolean(orderSuccess)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setOrderSuccess(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border-gray-80 bg-white p-6 text-center dark:border-white/10 dark:bg-secondary-50 sm:p-7">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <DialogHeader className="mt-4 items-center">
            <DialogTitle className="text-xl text-cryptoNight dark:text-white">
              {orderSuccess?.side === "sell"
                ? "Sale successful"
                : "Purchase successful"}
            </DialogTitle>
            <DialogDescription className="max-w-[18rem] text-center text-sm leading-6 text-gray-30 dark:text-gray-40">
              Your {orderSuccess?.symbol} position has been updated.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-80 bg-gray-80 text-left dark:border-white/10 dark:bg-white/10">
            <div className="bg-white p-3.5 dark:bg-secondary-50">
              <p className="text-[11px] text-gray-30 dark:text-gray-40">
                {orderSuccess?.side === "sell"
                  ? "Shares sold"
                  : "Shares purchased"}
              </p>
              <p className="mt-1 font-semibold tabular-nums text-cryptoNight dark:text-white">
                {orderSuccess?.shares.toFixed(4)}
              </p>
            </div>
            <div className="bg-white p-3.5 dark:bg-secondary-50">
              <p className="text-[11px] text-gray-30 dark:text-gray-40">
                {orderSuccess?.side === "sell" ? "USDC received" : "Total paid"}
              </p>
              <p className="mt-1 font-semibold tabular-nums text-cryptoNight dark:text-white">
                ${orderSuccess?.value.toFixed(2)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="flow"
            className="mt-5 h-12 w-full"
            onClick={() => {
              setOrderSuccess(null);
              onViewPosition?.();
            }}
          >
            <span className="relative z-10">View my position</span>
          </Button>
          <button
            type="button"
            className="mt-3 w-full text-sm font-semibold text-gray-30 transition hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
            onClick={() => setOrderSuccess(null)}
          >
            Done
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
