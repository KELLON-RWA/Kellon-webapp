"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Clock3,
  RefreshCw,
  RouteIcon,
} from "lucide-react";
import { encodeFunctionData, erc20Abi, formatUnits, parseUnits } from "viem";
import { toast } from "sonner";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import ChainIcon from "@/components/wallet/ChainIcon";
import { AssetLogo } from "@/components/invoices/create-invoice/AssetLogo";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getBridgeDestinations,
  getBridgeSources,
  isExecutableBridgePair,
  type BridgeAssetOption,
} from "@/lib/bridge-assets";
import {
  useSmartAccount,
  setStickyTransferMeta,
  setStickyVerificationCode,
} from "@/hooks/useSmartAccount";
import {
  findTransferVerificationRequiredError,
  getAvailableVerificationMethods,
  getOtpChannelForMethod,
  getVerificationTypeForMethod,
  resolveVerificationMethod,
  transferService,
  type VerificationMethod,
} from "@/services/api/transfers";
import type { User } from "@/types/db";
import { bridgeService, type BridgeRoute } from "@/services/api/bridge";

interface BridgeFlowProps {
  profile: User;
}

type BridgeVerification = {
  availableMethods: VerificationMethod[];
  selectedMethod: VerificationMethod;
  verificationType: "otp" | "totp";
  action?: string;
  otpSent: boolean;
};

type EvmSmartAccountClient = {
  account: { address?: string };
  chain: unknown;
  sendTransaction(args: {
    account: unknown;
    chain: unknown;
    calls: Array<{ to: `0x${string}`; data?: `0x${string}`; value?: bigint }>;
  }): Promise<string>;
};

function formatBalance(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(
    value,
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `About ${Math.max(1, Math.ceil(seconds))} sec`;
  return `About ${Math.ceil(seconds / 60)} min`;
}

function getTokenIcon(symbol: string): string {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
}

const BRIDGE_CARD_CLASS =
  "rounded-[28px] border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-secondary-50/80";

export default function BridgeFlow({ profile }: BridgeFlowProps) {
  const router = useRouter();
  const { wallets, ready: walletsReady } = useWallets();
  const { getSmartAccountClient } = useSmartAccount();
  const sources = useMemo(
    () => getBridgeSources(profile.assets || []),
    [profile.assets],
  );
  const destinations = useMemo(() => getBridgeDestinations(), []);
  const [sourceKey, setSourceKey] = useState(
    sources.find((item) => item.chainType === "evm")?.key ||
      sources[0]?.key ||
      "",
  );
  const [destinationKey, setDestinationKey] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceAddress, setSourceAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<BridgeRoute | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verification, setVerification] = useState<BridgeVerification | null>(
    null,
  );

  const source = sources.find((item) => item.key === sourceKey) || null;
  const selectedSymbol = source?.symbol || null;
  const destination =
    destinations.find((item) => item.key === destinationKey) || null;
  const amountValue = Number(amount);
  const isAmountValid =
    Boolean(source) &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    amountValue <= (source?.balance || 0);
  const isExecutablePair = Boolean(
    source && destination && isExecutableBridgePair(source, destination),
  );

  const availableDestinations = useMemo(
    () =>
      destinations.filter(
        (item) =>
          item.symbol === selectedSymbol && item.chainKey !== source?.chainKey,
      ),
    [destinations, selectedSymbol, source?.chainKey],
  );

  useEffect(() => {
    const destinationIsValid = availableDestinations.some(
      (item) => item.key === destinationKey,
    );
    if (!source || !destinationIsValid) {
      const preferred = source
        ? availableDestinations.find((item) =>
            isExecutableBridgePair(source, item),
          )
        : null;
      setDestinationKey(preferred?.key || availableDestinations[0]?.key || "");
    }
  }, [availableDestinations, destinationKey, source]);

  const selectToken = (symbol: BridgeAssetOption["symbol"]) => {
    const nextSource =
      sources.find(
        (item) => item.symbol === symbol && item.chainKey === source?.chainKey,
      ) || sources.find((item) => item.symbol === symbol);
    if (!nextSource) return;

    setSourceKey(nextSource.key);
    setDestinationKey("");
    setAmount("");
    setSelectedRoute(null);
  };

  const swapNetworks = () => {
    if (!source || !destination) return;
    const reverseSource = sources.find(
      (item) =>
        item.symbol === source.symbol && item.chainKey === destination.chainKey,
    );
    const reverseDestination = destinations.find(
      (item) =>
        item.symbol === source.symbol && item.chainKey === source.chainKey,
    );
    if (!reverseSource || !reverseDestination) return;

    setSourceKey(reverseSource.key);
    setDestinationKey(reverseDestination.key);
    setAmount("");
    setSelectedRoute(null);
  };

  const canSwapNetworks = Boolean(
    source &&
      destination &&
      sources.some(
        (item) =>
          item.symbol === source.symbol &&
          item.chainKey === destination.chainKey,
      ),
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveAccounts() {
      setSourceAddress("");
      setDestinationAddress("");
      if (!source || !destination || !isExecutablePair || !walletsReady) return;

      const embeddedWallet = wallets.find(
        (wallet) =>
          wallet.walletClientType === "privy" &&
          wallet.address.startsWith("0x"),
      );
      if (!embeddedWallet) return;

      const [sourceClient, destinationClient] = await Promise.all([
        getSmartAccountClient(embeddedWallet, source.chainKey),
        getSmartAccountClient(embeddedWallet, destination.chainKey),
      ]);
      if (cancelled) return;

      setSourceAddress(
        (sourceClient?.account as { address?: string } | undefined)?.address ||
          "",
      );
      setDestinationAddress(
        (destinationClient?.account as { address?: string } | undefined)
          ?.address || "",
      );
    }

    void resolveAccounts();
    return () => {
      cancelled = true;
    };
  }, [
    destination,
    getSmartAccountClient,
    isExecutablePair,
    source,
    wallets,
    walletsReady,
  ]);

  const quoteQuery = useQuery({
    queryKey: [
      "bridge-routes",
      source?.key,
      destination?.key,
      amount,
      sourceAddress,
      destinationAddress,
    ],
    queryFn: async () => {
      if (!source || !destination) return [] as BridgeRoute[];
      return bridgeService.getRoutes({
        fromChainId: Number(source.chainId),
        fromTokenAddress: source.tokenAddress,
        fromAmount: parseUnits(amount, source.decimals).toString(),
        fromAddress: sourceAddress,
        toChainId: Number(destination.chainId),
        toTokenAddress: destination.tokenAddress,
        toAddress: destinationAddress,
      });
    },
    enabled:
      isExecutablePair &&
      isAmountValid &&
      Boolean(sourceAddress && destinationAddress),
    staleTime: 20_000,
    retry: 1,
  });

  useEffect(() => {
    setSelectedRoute(quoteQuery.data?.[0] || null);
  }, [quoteQuery.data]);

  const quoteError =
    quoteQuery.error instanceof Error ? quoteQuery.error.message : null;
  const routeDuration =
    selectedRoute?.steps.reduce(
      (total, step) => total + (step.estimate?.executionDuration || 0),
      0,
    ) || 0;
  const receiveAmount = selectedRoute
    ? formatUnits(
        BigInt(selectedRoute.toAmount),
        selectedRoute.toToken.decimals,
      )
    : "";

  const executeBridge = async (code?: string) => {
    if (!source || !destination || !selectedRoute) return;
    setIsSubmitting(true);

    try {
      if (!walletsReady)
        throw new Error("Wallet is still loading. Please try again.");
      const embeddedWallet = wallets.find(
        (wallet) =>
          wallet.walletClientType === "privy" &&
          wallet.address.startsWith("0x"),
      );
      if (!embeddedWallet)
        throw new Error(
          "Your embedded wallet is unavailable. Please log in again.",
        );

      const smartAccount = await getSmartAccountClient(
        embeddedWallet,
        source.chainKey,
      );
      if (!smartAccount)
        throw new Error(
          `Could not initialize your ${source.chainName} account.`,
        );

      if (code && verification) {
        setStickyVerificationCode({ type: verification.selectedMethod, code });
      } else {
        setStickyVerificationCode(null);
      }
      setStickyTransferMeta({
        amount: amountValue,
        symbol: source.symbol,
        toAddress: destinationAddress,
      });

      const step = await bridgeService.getStepTransaction(
        selectedRoute.steps[0],
      );
      const transaction = step.transactionRequest;
      if (!transaction?.to || !transaction.data) {
        throw new Error(
          "The bridge provider returned an incomplete transaction.",
        );
      }

      const approvalAddress = step.estimate?.approvalAddress;
      const calls: Array<{
        to: `0x${string}`;
        data?: `0x${string}`;
        value?: bigint;
      }> = [];
      if (approvalAddress) {
        calls.push({
          to: source.tokenAddress as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [
              approvalAddress as `0x${string}`,
              parseUnits(amount, source.decimals),
            ],
          }),
          value: 0n,
        });
      }
      calls.push({
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}`,
        value: BigInt(transaction.value || "0"),
      });

      const hash = await (
        smartAccount as unknown as EvmSmartAccountClient
      ).sendTransaction({
        account: smartAccount.account,
        chain: smartAccount.chain,
        calls,
      });

      setVerification(null);
      toast.success("Bridge submitted", {
        description: `Your ${source.symbol} is moving to ${destination.chainName}. Transaction: ${hash.slice(0, 10)}…`,
      });
      router.push("/");
    } catch (error) {
      const verificationError = findTransferVerificationRequiredError(error);
      if (verificationError) {
        const methods = getAvailableVerificationMethods(
          verificationError.availableMethods,
          verificationError.verificationType,
        );
        const selectedMethod = resolveVerificationMethod(
          methods,
          verificationError.verificationType,
        );
        setVerification({
          availableMethods: methods,
          selectedMethod,
          verificationType: getVerificationTypeForMethod(selectedMethod),
          action: verificationError.action,
          otpSent: selectedMethod !== "totp",
        });
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Unable to submit bridge",
      );
    } finally {
      setStickyVerificationCode(null);
      setStickyTransferMeta(null);
      setIsSubmitting(false);
    }
  };

  const requestOtp = async (method: VerificationMethod) => {
    const channel = getOtpChannelForMethod(method);
    if (!verification || !channel || isResending) return;
    setIsResending(true);
    try {
      await transferService.requestOTP(
        verification.action || "transfer",
        channel,
      );
      setVerification((current) =>
        current ? { ...current, otpSent: true } : current,
      );
      toast.success("Verification code sent");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send code",
      );
    } finally {
      setIsResending(false);
    }
  };

  const selectVerificationMethod = (method: VerificationMethod) => {
    const channel = getOtpChannelForMethod(method);
    setVerification((current) =>
      current
        ? {
            ...current,
            selectedMethod: method,
            verificationType: getVerificationTypeForMethod(method),
            otpSent: channel === null,
          }
        : current,
    );
  };

  const routeUnavailableMessage =
    source && destination && !isExecutablePair
      ? `${source.chainName} to ${destination.chainName} bridging is not available yet.`
      : quoteError
        ? "No bridge route is currently available for this pair."
        : null;

  return (
    <section className="container mx-auto flex min-h-[90dvh] max-w-4xl flex-col overflow-x-hidden px-4 pb-28 pt-4 md:px-6 md:pb-14 md:pt-20">
      <header className="relative mb-6 flex items-center justify-center md:mb-8">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => router.back()}
          className="absolute left-0 cursor-pointer rounded-full border border-black/5 bg-white p-2 text-gray-600 transition-all hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-300 dark:hover:bg-secondary-60/50"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-black dark:text-white">
          Bridge
        </h1>
      </header>

      {sources.length === 0 ? (
        <div className={BRIDGE_CARD_CLASS}>
          <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center dark:border-white/10">
            <p className="font-semibold text-black dark:text-white">
              No bridgeable balance
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Add USDC or USDT to start bridging.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-xl min-w-0 flex-col gap-4">
          <section className={BRIDGE_CARD_CLASS}>
            <div className="space-y-5">
              <div>
                <h2 className="mb-3 text-sm font-bold text-black dark:text-white">
                  Token
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from(
                    new Map(
                      sources.map((item) => [item.symbol, item]),
                    ).values(),
                  ).map((token) => (
                    <button
                      key={token.symbol}
                      type="button"
                      onClick={() => selectToken(token.symbol)}
                      className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                        selectedSymbol === token.symbol
                          ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                          : "border-black/5 bg-gray-95 text-gray-600 hover:text-black dark:border-white/10 dark:bg-secondary-50 dark:text-gray-400 dark:hover:bg-secondary-60/50 dark:hover:text-white"
                      }`}
                    >
                      <AssetLogo
                        src={getTokenIcon(token.symbol)}
                        symbol={token.symbol}
                        size="sm"
                      />
                      <span
                        className={`truncate text-sm font-bold ${
                          selectedSymbol === token.symbol
                            ? "text-primary-60"
                            : ""
                        }`}
                      >
                        {token.symbol}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-black/5 pt-4 dark:border-white/5">
                <NetworkSelector
                  label="From network"
                  value={sourceKey}
                  options={sources.filter(
                    (item) => item.symbol === selectedSymbol,
                  )}
                  onChange={(value) => {
                    setSourceKey(value);
                    setAmount("");
                    setSelectedRoute(null);
                  }}
                  showBalance
                />

                <div className="relative flex h-8 items-center justify-center">
                  <span className="absolute inset-x-0 top-1/2 border-t border-black/5 dark:border-white/5" />
                  <button
                    type="button"
                    aria-label="Swap source and destination networks"
                    onClick={swapNetworks}
                    disabled={!canSwapNetworks}
                    className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-black/5 bg-white text-primary-60 transition hover:bg-gray-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </div>

                <NetworkSelector
                  label="To network"
                  value={destinationKey}
                  options={availableDestinations}
                  onChange={(value) => {
                    setDestinationKey(value);
                    setSelectedRoute(null);
                  }}
                />
              </div>

              <div className="border-t border-black/5 pt-4 dark:border-white/5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="bridge-amount"
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400"
                  >
                    Amount
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {source ? formatBalance(source.balance) : "0"}{" "}
                    {source?.symbol || ""} available
                  </span>
                </div>
                <div className="flex h-16 items-center gap-3 rounded-2xl border border-black/5 bg-gray-95 px-4 dark:border-white/10 dark:bg-secondary-60">
                  <input
                    id="bridge-amount"
                    aria-label="Amount"
                    value={amount}
                    onChange={(event) =>
                      setAmount(event.target.value.replace(/[^0-9.]/g, ""))
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                    className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-black outline-none placeholder:text-gray-400 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => source && setAmount(String(source.balance))}
                    className="cursor-pointer text-xs font-bold uppercase text-primary-60"
                  >
                    Max
                  </button>
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                    {source?.symbol}
                  </span>
                </div>
                {amount && !isAmountValid ? (
                  <p className="mt-2 text-xs text-red-500">
                    Enter an amount within your available balance.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="min-w-0 space-y-4">
            {selectedRoute && source && destination ? (
              <div className={BRIDGE_CARD_CLASS}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-black dark:text-white">
                    Bridge preview
                  </h2>
                  <RouteIcon className="h-4 w-4 text-primary-50" />
                </div>
                <div className="mt-4 space-y-4">
                  <PreviewRow
                    label="You send"
                    value={`${formatBalance(amountValue)} ${source.symbol}`}
                  />
                  <PreviewRow
                    label="You receive"
                    value={`≈ ${formatBalance(Number(receiveAmount))} ${destination.symbol}`}
                  />
                  <PreviewRow
                    label="Network"
                    value={`${source.chainName} → ${destination.chainName}`}
                  />
                  <PreviewRow
                    label="Provider"
                    value={
                      selectedRoute.steps[0]?.toolDetails?.name ||
                      selectedRoute.steps[0]?.tool ||
                      "Best route"
                    }
                  />
                  <PreviewRow
                    label="Estimated time"
                    value={formatDuration(routeDuration)}
                    icon={<Clock3 className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>
            ) : quoteQuery.isFetching ? (
              <div className={BRIDGE_CARD_CLASS}>
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary-50" />
                  Finding the best available route…
                </div>
              </div>
            ) : null}

            <FlowActionFooter
              sticky={false}
              className="mt-0"
              onClick={() => void executeBridge()}
              disabled={!selectedRoute || isSubmitting || !isAmountValid}
              helperText="Review the route and final amount before confirming."
            >
              {isSubmitting ? "Submitting…" : "Bridge now"}
              <ArrowRight className="h-4 w-4" />
            </FlowActionFooter>
          </aside>

          {routeUnavailableMessage ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
              {routeUnavailableMessage}
            </p>
          ) : null}
        </div>
      )}

      <TransferVerificationModal
        isOpen={Boolean(verification)}
        isSubmitting={isSubmitting}
        verificationType={verification?.verificationType || "otp"}
        availableMethods={verification?.availableMethods}
        selectedMethod={verification?.selectedMethod}
        onMethodChange={selectVerificationMethod}
        otpSent={verification?.otpSent}
        onResend={() =>
          verification && void requestOtp(verification.selectedMethod)
        }
        isResending={isResending}
        onClose={() => !isSubmitting && setVerification(null)}
        onSubmit={(code) => void executeBridge(code)}
        title="Confirm bridge"
        actionNoun="bridge"
      />
    </section>
  );
}

function NetworkSelector({
  label,
  value,
  options,
  onChange,
  showBalance = false,
}: {
  label: string;
  value: string;
  options: BridgeAssetOption[];
  onChange: (value: string) => void;
  showBalance?: boolean;
}) {
  const selected = options.find((item) => item.key === value);
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-14 w-full rounded-2xl border-black/5 bg-gray-95 px-4 text-black shadow-none transition-colors hover:bg-gray-90 focus:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:hover:bg-secondary-60/70 [&>svg]:ml-2">
          {selected ? (
            <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <ChainIcon name={selected.chainKey} size={30} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {selected.chainName}
                </span>
              </span>
              {showBalance ? (
                <span className="ml-auto shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {formatBalance(selected.balance)} {selected.symbol}
                </span>
              ) : null}
            </span>
          ) : (
            <SelectValue placeholder="Select network" />
          )}
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-black/10 bg-white p-1 text-black shadow-xl dark:border-white/10 dark:bg-secondary-50 dark:text-white">
          {options.map((option) => (
            <SelectItem
              key={option.key}
              value={option.key}
              className="rounded-xl py-2.5 pl-2.5 pr-8 focus:bg-gray-95 dark:focus:bg-secondary-60"
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <ChainIcon name={option.chainKey} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {option.chainName}
                </span>
                {showBalance ? (
                  <span className="ml-auto text-xs text-gray-500">
                    {formatBalance(option.balance)} {option.symbol}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/5 pb-3 last:border-0 last:pb-0 dark:border-white/10">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="flex items-center gap-1 text-right text-xs font-semibold text-black dark:text-white">
        {icon}
        {value}
      </span>
    </div>
  );
}
