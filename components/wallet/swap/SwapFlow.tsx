"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { toast } from "sonner";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
import FlowStepIndicator from "@/components/wallet/shared/FlowStepIndicator";
import {
  getDefaultSwapDestination,
  getSwapDestinations,
  getSwapSources,
  getSwapTokens,
} from "@/lib/swap-assets";
import { getNativeSwapBalances } from "@/lib/swap-native-balances";
import { isNativeSwapAddress } from "@/lib/swap-policy";
import {
  setStickyTransferMeta,
  setStickyVerificationCode,
  useSmartAccount,
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
import { swapService, type Route } from "@/services/api/swap";
import type { User } from "@/types/db";
import { SwapComposeStep } from "./steps/ComposeStep";
import { SwapReviewStep } from "./steps/ReviewStep";
import type { SwapSmartAccountClient, SwapVerification } from "./types";
import { getRouteReceiveAmount } from "./utils";

export default function SwapFlow({ profile }: { profile: User }) {
  const router = useRouter();
  const { wallets, ready: walletsReady } = useWallets();
  const { getSmartAccountClient } = useSmartAccount();
  const tokensQuery = useQuery({
    queryKey: ["swap-token-catalog"],
    queryFn: swapService.getTokens,
    staleTime: 15 * 60 * 1000,
    retry: 2,
  });
  const tokenCatalog = useMemo(
    () => getSwapTokens(tokensQuery.data || []),
    [tokensQuery.data],
  );
  const nativeBalancesQuery = useQuery({
    queryKey: [
      "swap-native-balances",
      profile.id,
      tokenCatalog.map((token) => token.key).join(","),
    ],
    queryFn: () =>
      getNativeSwapBalances(profile.chainAccounts || [], tokenCatalog),
    enabled: tokenCatalog.length > 0,
    staleTime: 15_000,
    refetchOnMount: "always",
    retry: 1,
  });
  const sources = useMemo(
    () =>
      getSwapSources(
        profile.assets || [],
        tokenCatalog,
        nativeBalancesQuery.data || [],
      ),
    [profile.assets, tokenCatalog, nativeBalancesQuery.data],
  );
  const [sourceKey, setSourceKey] = useState("");
  const [destinationKey, setDestinationKey] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [view, setView] = useState<"compose" | "review">("compose");
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verification, setVerification] = useState<SwapVerification | null>(
    null,
  );

  const source = sources.find((item) => item.key === sourceKey) || null;
  const destinations = useMemo(
    () => getSwapDestinations(source, tokenCatalog),
    [source, tokenCatalog],
  );
  const destination =
    destinations.find((item) => item.key === destinationKey) || null;

  useEffect(() => {
    if (!sources.length) return;
    if (!sources.some((item) => item.key === sourceKey)) {
      setSourceKey(sources[0].key);
    }
  }, [sourceKey, sources]);

  useEffect(() => {
    if (!source) return;
    if (!destinations.some((item) => item.key === destinationKey)) {
      setDestinationKey(
        getDefaultSwapDestination(source, destinations)?.key || "",
      );
    }
  }, [destinationKey, destinations, source]);
  const amountValue = Number(amount);
  const isProviderSupported = Boolean(
    source?.chainType === "evm" && destination?.chainType === "evm",
  );
  const isAmountValid = Boolean(
    source &&
      destination &&
      Number.isFinite(amountValue) &&
      amountValue > 0 &&
      amountValue <= source.balance,
  );

  const getEmbeddedWallet = () =>
    wallets.find(
      (wallet) =>
        wallet.walletClientType === "privy" && wallet.address.startsWith("0x"),
    );

  const quoteQuery = useQuery({
    queryKey: ["swap-routes", source?.key, destination?.key, amount],
    queryFn: async () => {
      if (!source || !destination) return { routes: [] as Route[] };
      if (
        source.chainType !== "evm" ||
        destination.chainType !== "evm" ||
        typeof source.chainId !== "number" ||
        typeof destination.chainId !== "number"
      ) {
        throw new Error("This network is not supported by the swap provider.");
      }
      if (!walletsReady) throw new Error("Wallet is still loading");
      const wallet = getEmbeddedWallet();
      if (!wallet)
        throw new Error(
          "Your embedded wallet is unavailable. Please log in again.",
        );
      const smartAccount = await getSmartAccountClient(wallet, source.chainKey);
      const address = (
        smartAccount?.account as { address?: string } | undefined
      )?.address;
      if (!address)
        throw new Error(
          `Could not initialize your ${source.chainName} account.`,
        );
      return swapService.getRoutes({
        fromChainId: source.chainId,
        toChainId: source.chainId,
        fromTokenAddress: source.tokenAddress,
        toTokenAddress: destination.tokenAddress,
        fromAmount: parseUnits(amount, source.decimals).toString(),
        fromAddress: address,
        toAddress: address,
      });
    },
    enabled: isAmountValid && isProviderSupported && walletsReady,
    staleTime: 20_000,
    retry: 1,
  });

  const routes = useMemo(
    () =>
      [...(quoteQuery.data?.routes || [])]
        .filter(
          (route) =>
            route.fromChainId === route.toChainId && !route.containsSwitchChain,
        )
        .sort((left, right) =>
          BigInt(right.toAmount) > BigInt(left.toAmount) ? 1 : -1,
        ),
    [quoteQuery.data],
  );

  useEffect(() => {
    setSelectedRoute(
      (current) =>
        routes.find((route) => route.id === current?.id) || routes[0] || null,
    );
    setShowAllRoutes(false);
    setView("compose");
  }, [routes]);

  const executeSwap = async (code?: string) => {
    if (!source || !destination || !selectedRoute) return;
    if (source.chainType !== "evm" || destination.chainType !== "evm") {
      toast.error("This network is not supported by the swap provider.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (!walletsReady)
        throw new Error("Wallet is still loading. Please try again.");
      const wallet = getEmbeddedWallet();
      if (!wallet)
        throw new Error(
          "Your embedded wallet is unavailable. Please log in again.",
        );
      const smartAccount = await getSmartAccountClient(wallet, source.chainKey);
      if (!smartAccount)
        throw new Error(
          `Could not initialize your ${source.chainName} account.`,
        );

      setStickyVerificationCode(
        code && verification
          ? { type: verification.selectedMethod, code }
          : null,
      );
      setStickyTransferMeta({ amount: amountValue, symbol: source.symbol });

      const calls: Array<{
        to: `0x${string}`;
        data?: `0x${string}`;
        value?: bigint;
      }> = [];
      const approved = new Set<string>();
      for (const routeStep of selectedRoute.steps) {
        const { step } = await swapService.getStepTransaction(routeStep);
        const request = step.transactionRequest;
        if (!request?.to || !request.data)
          throw new Error(
            "The route returned incomplete transaction instructions.",
          );
        const spender = step.estimate.approvalAddress as `0x${string}`;
        const token = step.action.fromToken.address as `0x${string}`;
        const approvalKey =
          spender && token
            ? `${token.toLowerCase()}:${spender.toLowerCase()}`
            : "";
        if (
          !step.estimate.skipApproval &&
          spender &&
          token &&
          !isNativeSwapAddress(token) &&
          !approved.has(approvalKey)
        ) {
          if (step.estimate.approvalReset) {
            calls.push({
              to: token,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [spender, 0n],
              }),
              value: 0n,
            });
          }
          calls.push({
            to: token,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [spender, BigInt(step.action.fromAmount)],
            }),
            value: 0n,
          });
          approved.add(approvalKey);
        }
        calls.push({
          to: request.to as `0x${string}`,
          data: request.data as `0x${string}`,
          value: BigInt(request.value || 0),
        });
      }
      if (!calls.length)
        throw new Error("No executable swap transaction was returned.");
      setStickyTransferMeta({
        amount: amountValue,
        symbol: source.symbol,
        toAddress: calls.at(-1)?.to,
      });
      const hash = await (
        smartAccount as unknown as SwapSmartAccountClient
      ).sendTransaction({
        account: smartAccount.account,
        chain: smartAccount.chain,
        calls,
      });
      setVerification(null);
      toast.success("Swap submitted", {
        description: `${amount} ${source.symbol} is being swapped to ${destination.symbol}. Transaction: ${hash.slice(0, 10)}…`,
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
        error instanceof Error ? error.message : "Unable to submit swap",
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
      await transferService.requestOTP(verification.action || "swap", channel);
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
    setVerification((current) =>
      current
        ? {
            ...current,
            selectedMethod: method,
            verificationType: getVerificationTypeForMethod(method),
            otpSent: getOtpChannelForMethod(method) === null,
          }
        : current,
    );
  };

  const quoteError =
    source && destination && !isProviderSupported
      ? `${source.symbol} recovery swaps on ${source.chainName} are not supported by the current swap provider yet.`
      : quoteQuery.error instanceof Error
        ? quoteQuery.error.message
        : null;
  return (
    <section className="container mx-auto flex min-h-[90dvh] max-w-4xl flex-col overflow-x-hidden px-4 pb-28 pt-4 md:px-6 md:pb-14 md:pt-20">
      <FlowHeader
        title={view === "review" ? "Review swap" : "Swap"}
        onBack={() => (view === "review" ? setView("compose") : router.back())}
        className="mb-6 md:mb-8"
      />
      <FlowStepIndicator
        currentStep={view === "review" ? 1 : 0}
        totalSteps={2}
      />
      {view === "review" && source && destination && selectedRoute ? (
        <SwapReviewStep
          source={source}
          destination={destination}
          amount={amountValue}
          route={selectedRoute}
          isSubmitting={isSubmitting}
          onSubmit={() => void executeSwap()}
        />
      ) : (
        <SwapComposeStep
          sources={sources}
          destinations={destinations}
          source={source}
          destination={destination}
          amount={amount}
          receiveAmount={getRouteReceiveAmount(selectedRoute)}
          isAmountValid={isAmountValid}
          isLoadingTokens={
            tokensQuery.isLoading || nativeBalancesQuery.isLoading
          }
          routes={routes}
          selectedRoute={selectedRoute}
          isLoadingRoutes={quoteQuery.isFetching}
          showAllRoutes={showAllRoutes}
          routeError={quoteError}
          onSourceChange={(key) => {
            setSourceKey(key);
            setDestinationKey("");
            setAmount("");
            setSelectedRoute(null);
          }}
          onDestinationChange={(key) => {
            setDestinationKey(key);
            setSelectedRoute(null);
          }}
          onAmountChange={setAmount}
          onRouteSelect={setSelectedRoute}
          onShowAllRoutes={() => setShowAllRoutes(true)}
          onReview={() => setView("review")}
        />
      )}
      <TransferVerificationModal
        isOpen={Boolean(verification)}
        isSubmitting={isSubmitting}
        verificationType={verification?.verificationType || "email_otp"}
        availableMethods={verification?.availableMethods}
        selectedMethod={verification?.selectedMethod}
        onMethodChange={selectVerificationMethod}
        otpSent={verification?.otpSent}
        onResend={() =>
          verification && void requestOtp(verification.selectedMethod)
        }
        isResending={isResending}
        onClose={() => !isSubmitting && setVerification(null)}
        onSubmit={(code) => void executeSwap(code)}
        title="Confirm swap"
        actionNoun="swap"
      />
    </section>
  );
}
