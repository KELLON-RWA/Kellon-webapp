"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import { encodeFunctionData, erc20Abi, formatUnits, parseUnits } from "viem";
import { toast } from "sonner";
import { extractHumanErrorMessage } from "@/lib/utils";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
import FlowStepIndicator from "@/components/wallet/shared/FlowStepIndicator";
import {
  getAllConvertAssets,
  getConvertDestinations,
  getConvertMode,
  getConvertSources,
  getDefaultConvertDestination,
  type ConvertMode,
} from "@/lib/convert-assets";
import { isNativeSwapAddress } from "@/lib/swap-policy";
import { clampDust } from "@/lib/token-amount";
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
import {
  getEnabledTransactionVerificationMethods,
  securityService,
} from "@/services/api/security";
import { swapService, type Route } from "@/services/api/swap";
import { bridgeService, type BridgeRateOption, type FundingPlan } from "@/services/api/bridge";
import { bridgeOutbox } from "@/services/api/bridge-outbox";
import { yieldService } from "@/services/api/yield";
import type { User } from "@/types/db";
import {
  getTransactionDetailsPath,
  resolveFlowTransactionId,
} from "@/lib/transaction-navigation";
import { BridgeComposeStep } from "./BridgeComposeStep";
import { SwapReviewStep } from "../swap/steps/ReviewStep";
import { BridgeReviewStep } from "./steps/ReviewStep";
import BridgeSuccessModal, { type ConvertSuccessState } from "./BridgeSuccessModal";
import { getRouteReceiveAmount as getSwapReceiveAmount } from "../swap/utils";
import {
  getRouteDuration as getBridgeRouteDuration,
  getRouteId as getBridgeRouteId,
  getRouteReceiveAmount as getBridgeReceiveAmount,
  matchesBridgeRecommendation,
} from "./utils";
import type { SwapAssetOption } from "@/lib/swap-assets";
import type { BridgeAssetOption } from "@/lib/bridge-assets";
import type { BridgeVerification, EvmSmartAccountClient } from "./types";
import type { SwapSmartAccountClient } from "../swap/types";

export interface BridgeFlowProps {
  profile: User;
  initialMode?: "swap" | "bridge" | "auto";
  initialSymbol?: "USDC" | "USDT";
  initialSourceChain?: string;
  initialDestinationChain?: string;
}

export type ConvertFlowProps = BridgeFlowProps;

export default function BridgeFlow({
  profile,
  initialMode = "auto",
  initialSymbol,
  initialSourceChain,
}: BridgeFlowProps) {
  const router = useRouter();
  const { wallets, ready: walletsReady } = useWallets();
  const { getSmartAccountClient } = useSmartAccount();

  useEffect(() => {
    router.prefetch("/transactions");
    router.prefetch("/");
  }, [router]);

  // 1. Sources (all supported options with user balances merged; solana excluded as source)
  const sources = useMemo(() => {
    const catalog = getAllConvertAssets().filter(
      (c) => c.chainType !== "solana",
    );
    const funded = getConvertSources(profile.assets || []);
    const fundedMap = new Map(funded.map((f) => [f.key, f]));

    return catalog.map((item) => {
      const existing = fundedMap.get(item.key);
      return existing || item;
    });
  }, [profile.assets]);

  // Initial source resolution (prefer funded source)
  const defaultSource = useMemo(() => {
    const fundedSources = sources.filter((s) => s.balance > 0);
    const pool = fundedSources.length > 0 ? fundedSources : sources;

    if (initialSymbol && initialSourceChain) {
      const match = pool.find(
        (s) =>
          s.symbol === initialSymbol &&
          s.chainKey.toLowerCase() === initialSourceChain.toLowerCase(),
      );
      if (match) return match;
    }
    if (initialSymbol) {
      const match = pool.find((s) => s.symbol === initialSymbol);
      if (match) return match;
    }
    if (initialSourceChain) {
      const match = pool.find(
        (s) => s.chainKey.toLowerCase() === initialSourceChain.toLowerCase(),
      );
      if (match) return match;
    }
    return pool[0] || null;
  }, [sources, initialSymbol, initialSourceChain]);

  const [sourceKey, setSourceKey] = useState<string>(defaultSource?.key || "");
  const [filterMode, setFilterMode] = useState<"all" | "swap" | "bridge">(
    initialMode === "auto" ? "all" : initialMode,
  );
  const [destinationKey, setDestinationKey] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [view, setView] = useState<"compose" | "review">("compose");
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verification, setVerification] = useState<BridgeVerification | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [successState, setSuccessState] = useState<ConvertSuccessState | null>(null);
  const [resolvedTransactionId, setResolvedTransactionId] = useState<string | null>(null);

  useEffect(() => {
    if (
      !successState ||
      (successState.submissionPhase !== "submitted" &&
        successState.submissionPhase !== "completed")
    ) {
      setResolvedTransactionId(null);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["transactions"] });

    let isMounted = true;
    void resolveFlowTransactionId({
      transactionId: successState.transactionId,
      txHash: successState.txHash,
      groupId: successState.tracking?.groupId,
      type:
        successState.mode === "swap"
          ? ["SWAP", "TRANSFER_OUT"]
          : ["BRIDGE", "SWAP"],
      symbol: successState.symbol,
      amount: successState.amount,
      maxAttempts: 6,
    }).then((id) => {
      if (isMounted && id) {
        setResolvedTransactionId(id);
        router.prefetch(getTransactionDetailsPath(id, "flow"));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [successState, router, queryClient]);

  // Cache prepared transaction instructions and plans to skip re-fetching/re-calculating
  // when resuming execution after OTP verification.
  const cachedSwapCallsRef = useRef<{
    routeId: string;
    calls: Array<{
      to: `0x${string}`;
      data?: `0x${string}`;
      value?: bigint;
    }>;
  } | null>(null);

  const cachedBridgePlanRef = useRef<{
    key: string;
    plan: FundingPlan;
  } | null>(null);

  useEffect(() => {
    cachedSwapCallsRef.current = null;
    cachedBridgePlanRef.current = null;
  }, [sourceKey, destinationKey, amount]);

  // Active Source
  const source = useMemo(
    () => sources.find((s) => s.key === sourceKey) || sources[0] || null,
    [sources, sourceKey],
  );

  // Available Destinations for current source and filter
  const destinations = useMemo(
    () => getConvertDestinations(source, filterMode),
    [source, filterMode],
  );

  // Active Destination
  const destination = useMemo(() => {
    const found = destinations.find((d) => d.key === destinationKey);
    return found || null;
  }, [destinations, destinationKey]);

  // Active Mode (dynamically derived from pair, defaults to preference)
  const activeMode: ConvertMode = useMemo(() => {
    const derived = getConvertMode(source, destination);
    if (derived) return derived;
    if (filterMode === "bridge") return "bridge";
    return "swap";
  }, [source, destination, filterMode]);

  // Keep destination valid when source or filter changes
  useEffect(() => {
    if (!source) return;
    const currentValid = destinations.some((d) => d.key === destinationKey);
    if (!currentValid) {
      const preferred = getDefaultConvertDestination(
        source,
        destinations,
        filterMode === "all" ? undefined : filterMode,
      );
      setDestinationKey(preferred?.key || destinations[0]?.key || "");
    }
  }, [source, destinations, destinationKey, filterMode]);

  // Handle Mode Toggle from Top Switcher
  const handleModeToggle = (targetMode: ConvertMode) => {
    setFilterMode(targetMode);
    const availableForTarget = getConvertDestinations(source, targetMode);
    const preferred = getDefaultConvertDestination(
      source,
      availableForTarget,
      targetMode,
    );
    if (preferred) {
      setDestinationKey(preferred.key);
    }
    setAmount("");
  };

  // Flip direction (Reverse Source & Destination)
  const canFlip = useMemo(() => {
    if (!source || !destination) return false;
    return sources.some((s) => s.key === destination.key);
  }, [source, destination, sources]);

  const handleFlip = () => {
    if (!source || !destination || !canFlip) return;
    const newSourceKey = destination.key;
    const newDestKey = source.key;
    setSourceKey(newSourceKey);
    setDestinationKey(newDestKey);
    setAmount("");
  };

  // Amount Validation
  const amountNumber = Number(amount);
  const isAmountValid =
    Boolean(source) &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    amountNumber <= (source?.balance || 0);

  // -------------------------------------------------------------
  // SWAP ROUTE QUERY (LI.FI)
  // -------------------------------------------------------------
  const [selectedSwapRoute, setSelectedSwapRoute] = useState<Route | null>(null);

  const getEmbeddedWallet = () =>
    wallets.find(
      (wallet) =>
        wallet.walletClientType === "privy" && wallet.address.startsWith("0x"),
    ) || wallets[0];

  const swapQuoteQuery = useQuery({
    queryKey: [
      "swap-convert-routes",
      source?.chainId,
      source?.tokenAddress,
      destination?.chainId,
      destination?.tokenAddress,
      amount,
      walletsReady,
    ],
    queryFn: async () => {
      if (!source?.tokenAddress || !destination?.tokenAddress) {
        return { routes: [] };
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

      let toAddress = address;
      if (destination.chainKey !== source.chainKey && destination.chainType === "evm") {
        try {
          const destSmartAccount = await getSmartAccountClient(wallet, destination.chainKey);
          const derived = (destSmartAccount?.account as { address?: string } | undefined)?.address;
          if (derived) toAddress = derived;
        } catch {
          // fallback to address
        }
      }

      const parsedAmount = parseUnits(amount, source.decimals).toString();
      return swapService.getRoutes({
        fromChainId: Number(source.chainId),
        toChainId: Number(destination.chainId),
        fromTokenAddress: source.tokenAddress,
        toTokenAddress: destination.tokenAddress,
        fromAmount: parsedAmount,
        fromAddress: address,
        toAddress: toAddress,
        options: { maxPriceImpact: 0.1 },
      });
    },
    enabled:
      activeMode === "swap" &&
      isAmountValid &&
      walletsReady &&
      Boolean(source?.tokenAddress && destination?.tokenAddress),
    staleTime: 15_000,
    retry: 1,
  });

  const swapRoutes = useMemo(() => {
    const raw = swapQuoteQuery.data?.routes || [];
    // Sort descending by receive amount so best return is ALWAYS index 0
    return [...raw].sort((a, b) => {
      const aAmt = getSwapReceiveAmount(a);
      const bAmt = getSwapReceiveAmount(b);
      return bAmt - aAmt;
    });
  }, [swapQuoteQuery.data]);

  useEffect(() => {
    if (activeMode === "swap") {
      if (swapRoutes.length === 0) {
        setSelectedSwapRoute(null);
        return;
      }
      // If user has not elected a route or when fresh routes arrive, default to Best Return (routes[0])
      const matching = selectedSwapRoute
        ? swapRoutes.find((route) => route.id === selectedSwapRoute.id)
        : null;
      setSelectedSwapRoute(matching || swapRoutes[0]);
    }
  }, [swapRoutes, activeMode]);

  // -------------------------------------------------------------
  // BRIDGE ROUTE QUERY (CCTP / Allbridge)
  // -------------------------------------------------------------
  const [selectedBridgeRoute, setSelectedBridgeRoute] = useState<BridgeRateOption | null>(null);

  const bridgeQuoteQuery = useQuery({
    queryKey: [
      "bridge-convert-rates",
      source?.key,
      destination?.key,
      amount,
    ],
    queryFn: async () => {
      if (!source || !destination) {
        return { options: [], minThresholds: {} };
      }
      return bridgeService.compareRates({
        fromChain: source.chainKey,
        toChain: destination.chainKey,
        fromToken: source.symbol,
        toToken: destination.symbol,
        amount,
      });
    },
    enabled: activeMode === "bridge" && isAmountValid,
    staleTime: 20_000,
    retry: 1,
  });

  const rankedBridgeRoutes = useMemo(
    () =>
      [...(bridgeQuoteQuery.data?.options || [])]
        .filter((route) => route.supported)
        .sort((left, right) => {
          const leftAmount = Number(left.estimatedOutput || 0);
          const rightAmount = Number(right.estimatedOutput || 0);
          if (leftAmount === rightAmount) {
            return getBridgeRouteDuration(left) - getBridgeRouteDuration(right);
          }
          return rightAmount - leftAmount;
        }),
    [bridgeQuoteQuery.data?.options],
  );

  const bestBridgeRouteId = rankedBridgeRoutes[0]
    ? getBridgeRouteId(rankedBridgeRoutes[0])
    : undefined;

  const fastestBridgeRouteId = useMemo(() => {
    const candidate = [...rankedBridgeRoutes].sort(
      (left, right) =>
        getBridgeRouteDuration(left) - getBridgeRouteDuration(right),
    )[0];
    return candidate ? getBridgeRouteId(candidate) : undefined;
  }, [rankedBridgeRoutes]);

  useEffect(() => {
    if (activeMode === "bridge") {
      if (
        !selectedBridgeRoute ||
        !rankedBridgeRoutes.some((route) =>
          matchesBridgeRecommendation(route, selectedBridgeRoute),
        )
      ) {
        setSelectedBridgeRoute(rankedBridgeRoutes[0] || null);
      }
    }
  }, [rankedBridgeRoutes, selectedBridgeRoute, activeMode]);

  // Receive Amount Calculation (defaults to best return route until user elects another)
  const receiveAmount = useMemo(() => {
    if (activeMode === "swap") {
      const activeRoute = selectedSwapRoute || swapRoutes[0];
      return activeRoute ? getSwapReceiveAmount(activeRoute) : "0.00";
    }
    const activeRoute = selectedBridgeRoute || rankedBridgeRoutes[0];
    return activeRoute ? getBridgeReceiveAmount(activeRoute) : "0.00";
  }, [activeMode, selectedSwapRoute, swapRoutes, selectedBridgeRoute, rankedBridgeRoutes]);

  // Route Errors
  const swapError =
    swapQuoteQuery.error instanceof Error
      ? swapQuoteQuery.error.message
      : isAmountValid && !swapQuoteQuery.isFetching && !swapRoutes.length
        ? "No valid swap route found for this amount."
        : null;

  const bridgeError =
    bridgeQuoteQuery.error instanceof Error
      ? bridgeQuoteQuery.error.message
      : isAmountValid && !bridgeQuoteQuery.isFetching && !rankedBridgeRoutes.length
        ? "No route currently available for this bridge pair."
        : null;

  // -------------------------------------------------------------
  // SUBMIT HANDLERS
  // -------------------------------------------------------------
  const requestOtp = async (methodOverride?: VerificationMethod) => {
    const method = methodOverride || verification?.selectedMethod || "email_otp";
    const channel = getOtpChannelForMethod(method);
    if (!verification || !channel || isResending) return;
    setIsResending(true);
    setVerificationError(null);
    try {
      await transferService.requestOTP(
        verification.action || "transfer",
        channel,
      );
      setVerification((prev) => (prev ? { ...prev, otpSent: true } : null));
      toast.success(
        channel === "sms"
          ? "Verification code sent via SMS."
          : "Verification code sent to your email.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send verification code.",
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleMethodChange = (method: VerificationMethod) => {
    setVerification((prev) =>
      prev
        ? {
            ...prev,
            selectedMethod: method,
            verificationType: getVerificationTypeForMethod(method),
            otpSent: method === "totp",
          }
        : null,
    );
    setVerificationError(null);
  };

  const executeSwap = async (
    code?: string,
    methodOverride?: VerificationMethod,
  ) => {
    if (!source || !destination || !selectedSwapRoute) return;
    if (source.chainType !== "evm" || destination.chainType !== "evm") {
      toast.error("This network is not supported by the swap provider.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (!walletsReady)
        throw new Error("Wallet is still loading. Please try again.");
      const activeWallet =
        wallets.find(
          (wallet) =>
            wallet.walletClientType === "privy" &&
            wallet.address.startsWith("0x"),
        ) || wallets[0];
      if (!activeWallet)
        throw new Error(
          "Your embedded wallet is unavailable. Please log in again.",
        );
      const smartAccount = await getSmartAccountClient(
        activeWallet,
        source.chainKey,
      );
      if (!smartAccount)
        throw new Error(
          `Could not initialize your ${source.chainName} account.`,
        );

      // Pre-check on-chain balance to avoid doomed reverts in the bundler
      if (
        source.chainType === "evm" &&
        source.tokenAddress &&
        smartAccount.account?.address
      ) {
        try {
          const client = (
            smartAccount.account as unknown as {
              client?: {
                readContract: (args: unknown) => Promise<bigint>;
              };
            }
          ).client;
          if (client?.readContract) {
            const onChainBal = await client.readContract({
              address: source.tokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [smartAccount.account.address as `0x${string}`],
            });
            const requiredBigInt = parseUnits(amount, source.decimals);
            const clampedBigInt = clampDust(
              requiredBigInt,
              onChainBal,
              source.decimals,
            );
            if (onChainBal < clampedBigInt) {
              const availableFmt = formatUnits(onChainBal, source.decimals);
              throw new Error(
                `Insufficient ${source.symbol} on ${source.chainName}. You have ${availableFmt} ${source.symbol} available on-chain.`,
              );
            }
          }
        } catch (balErr) {
          if (
            balErr instanceof Error &&
            balErr.message.includes("Insufficient")
          ) {
            throw balErr;
          }
        }
      }

      const effectiveMethod =
        methodOverride || verification?.selectedMethod || "totp";
      setStickyVerificationCode(
        code ? { type: effectiveMethod, code } : null,
      );
      setStickyTransferMeta({ amount: amountNumber, symbol: source.symbol });

      let calls: Array<{
        to: `0x${string}`;
        data?: `0x${string}`;
        value?: bigint;
      }> = [];

      if (
        cachedSwapCallsRef.current &&
        cachedSwapCallsRef.current.routeId === selectedSwapRoute.id
      ) {
        calls = cachedSwapCallsRef.current.calls;
      } else {
        const approved = new Set<string>();

        for (const routeStep of selectedSwapRoute.steps) {
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

        cachedSwapCallsRef.current = {
          routeId: selectedSwapRoute.id,
          calls,
        };
      }

      setStickyTransferMeta({
        amount: amountNumber,
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

      cachedSwapCallsRef.current = null;
      setVerification(null);
      setVerificationError(null);
      toast.success(
        `Successfully swapped ${amount} ${source.symbol} for ${destination.symbol}!`,
      );
      setSuccessState({
        mode: "swap",
        amount,
        symbol: source.symbol,
        receiveAmount: String(receiveAmount) || (selectedSwapRoute ? String(getSwapReceiveAmount(selectedSwapRoute)) : undefined),
        destinationSymbol: destination.symbol,
        sourceChainName: source.chainName,
        destinationChainName: destination.chainName,
        txHash: hash,
        provider: selectedSwapRoute?.steps?.[0]?.toolDetails?.name || undefined,
        submissionPhase: "completed",
      });
    } catch (error) {
      const verificationChallenge = findTransferVerificationRequiredError(error);
      const isVerifying = Boolean(code);
      if (!verificationChallenge) {
        cachedSwapCallsRef.current = null;
      }
      if (verificationChallenge) {
        let userEnabledMethods: VerificationMethod[] | null = null;
        try {
          const settings = await securityService.getSettings();
          userEnabledMethods =
            getEnabledTransactionVerificationMethods(settings);
        } catch {
          userEnabledMethods = null;
        }
        const hasNoSecurityMethods =
          userEnabledMethods !== null && userEnabledMethods.length === 0;

        const methods = getAvailableVerificationMethods(
          verificationChallenge.availableMethods,
          verificationChallenge.verificationType,
        );
        const selectedMethod = resolveVerificationMethod(
          methods,
          userEnabledMethods?.includes("totp")
            ? "totp"
            : verificationChallenge.verificationType,
        );
        setVerification((prev) => ({
          availableMethods: hasNoSecurityMethods ? [] : methods,
          selectedMethod:
            prev?.selectedMethod && methods.includes(prev.selectedMethod)
              ? prev.selectedMethod
              : selectedMethod,
          verificationType: getVerificationTypeForMethod(selectedMethod),
          action: verificationChallenge.action,
          otpSent: hasNoSecurityMethods
            ? false
            : isVerifying
              ? true
              : selectedMethod === "totp",
        }));
        if (isVerifying) {
          const msg = "Invalid verification code. Please try again.";
          setVerificationError(msg);
          toast.error(msg);
        } else {
          setVerificationError(null);
          if (!hasNoSecurityMethods && selectedMethod === "totp") {
            toast.info("Enter your authenticator code to continue.");
          }
        }
        return;
      }
      const fallbackMsg = extractHumanErrorMessage(error);
      if (isVerifying) {
        setVerificationError(fallbackMsg);
      } else {
        setVerification(null);
      }
      toast.error(fallbackMsg);
    } finally {
      setIsSubmitting(false);
      setStickyVerificationCode(null);
      setStickyTransferMeta(null);
    }
  };

  const executeBridge = async (
    code?: string,
    methodOverride?: VerificationMethod,
  ) => {
    if (!source || !destination || !selectedBridgeRoute) return;
    setIsSubmitting(true);
    setSuccessState({
      mode: "bridge",
      symbol: source.symbol,
      amount: String(receiveAmount) || amount,
      sourceChainName: source.chainName,
      destinationChainName: destination.chainName,
      destinationSymbol: destination.symbol,
      submissionPhase: "preparing",
    });

    try {
      const effectiveMethod =
        methodOverride || verification?.selectedMethod || "totp";
      if (code) {
        setStickyVerificationCode({ type: effectiveMethod, code });
      } else {
        setStickyVerificationCode(null);
      }

      const planKey = `${source.chainKey}:${destination.chainKey}:${source.symbol}:${destination.symbol}:${amount}`;
      let plan: FundingPlan;
      if (
        cachedBridgePlanRef.current &&
        cachedBridgePlanRef.current.key === planKey
      ) {
        plan = cachedBridgePlanRef.current.plan;
      } else {
        plan = await bridgeService.calculatePlan({
          symbol: source.symbol,
          amount,
          selectedChains: [source.chainKey],
          targetChain: destination.chainKey,
          targetToken: destination.symbol,
        });

        if (plan.insufficientBalances || Number(plan.shortfall || 0) > 0) {
          throw new Error("Your available balance cannot fund this bridge.");
        }
        cachedBridgePlanRef.current = { key: planKey, plan };
      }

      const execution = await bridgeService.executePlan(
        plan,
        destination.chainKey,
        {
          messenger: selectedBridgeRoute.messenger,
          targetToken: destination.symbol,
          provider: selectedBridgeRoute.provider,
          verification:
            code && verification
              ? {
                  verificationCode: code,
                  verificationType: getVerificationTypeForMethod(
                    effectiveMethod,
                  ),
                  verificationCodes: [
                    {
                      type: getVerificationTypeForMethod(effectiveMethod),
                      code,
                    },
                  ],
                }
              : undefined,
        },
      );

      if (execution.transactions.length === 0) {
        setVerification(null);
        setVerificationError(null);
        setSuccessState({
          mode: "bridge",
          symbol: source.symbol,
          amount,
          sourceChainName: source.chainName,
          destinationChainName: destination.chainName,
          destinationSymbol: destination.symbol,
          submissionPhase: "completed",
        });
        return;
      }

      const transactions = execution.transactions;
      let hash = "";

      setSuccessState((current) =>
        current ? { ...current, submissionPhase: "approving" } : current,
      );

      if (source.chainType === "stellar") {
        const stellarTransactions = transactions.filter(
          (tx) => tx.serializedTx || tx.data,
        );
        if (stellarTransactions.length !== transactions.length) {
          throw new Error("The backend returned a non-Stellar bridge payload.");
        }
        if (stellarTransactions.length === 0) {
          throw new Error("The backend returned no Stellar bridge payload.");
        }
        hash = "";
        for (const transaction of stellarTransactions) {
          const result = await yieldService.executeStellar(
            "bridge",
            amount,
            transaction.serializedTx || transaction.data || "",
            "supply",
          );
          hash = result.data?.txHash || "";
          if (!hash) throw new Error("The Stellar bridge transaction failed.");
        }
      } else {
        if (!walletsReady) {
          throw new Error("Wallet is still loading. Please try again.");
        }
        const activeWallet =
          wallets.find(
            (item) =>
              item.walletClientType === "privy" &&
              item.address.startsWith("0x"),
          ) || wallets[0];
        if (!activeWallet)
          throw new Error("Please wait for your wallet to finish loading.");
        const smartAccount = await getSmartAccountClient(
          activeWallet,
          source.chainKey,
        );
        if (!smartAccount)
          throw new Error(
            `Could not initialize your ${source.chainName} account.`,
          );

        if (transactions.some((tx) => tx.serializedTx)) {
          throw new Error("The backend returned a non-EVM bridge payload.");
        }
        if (transactions.some((tx) => !tx.to)) {
          throw new Error(
            "The backend returned incomplete bridge transaction instructions.",
          );
        }

        setSuccessState((current) =>
          current ? { ...current, submissionPhase: "submitted" } : current,
        );

        const batchCalls = transactions.map((tx) => ({
          to: tx.to as `0x${string}`,
          data: (tx.data as `0x${string}`) || undefined,
          value: BigInt(tx.value || 0),
        }));

        setStickyTransferMeta({
          amount: amountNumber,
          symbol: source.symbol,
          toAddress: batchCalls.at(-1)?.to || "",
        });

        hash = await (
          smartAccount as unknown as EvmSmartAccountClient
        ).sendTransaction({
          account: smartAccount.account,
          chain: smartAccount.chain,
          calls: batchCalls,
        });
      }

      bridgeOutbox.save(profile.id, {
        txHash: hash,
        provider: selectedBridgeRoute.provider,
        fromChain: source.chainKey,
        toChain: destination.chainKey,
        amount,
        symbol: source.symbol,
        groupId: execution.groupId,
      });
      void bridgeOutbox.flush(profile.id);

      cachedBridgePlanRef.current = null;
      setVerification(null);
      setVerificationError(null);
      setSuccessState({
        mode: "bridge",
        symbol: source.symbol,
        amount,
        receiveAmount: String(receiveAmount) || amount,
        sourceChainName: source.chainName,
        destinationChainName: destination.chainName,
        destinationSymbol: destination.symbol,
        submissionPhase: "submitted",
        txHash: hash,
        provider: selectedBridgeRoute.provider,
        tracking: {
          txHash: hash,
          provider: selectedBridgeRoute.provider,
          fromChain: source.chainKey,
          toChain: destination.chainKey,
          amount,
          symbol: source.symbol,
          groupId: execution.groupId,
        },
      });
    } catch (error) {
      setSuccessState(null);
      const verificationChallenge = findTransferVerificationRequiredError(error);
      const isVerifying = Boolean(code);
      if (!verificationChallenge) {
        cachedBridgePlanRef.current = null;
      }
      if (verificationChallenge) {
        let userEnabledMethods: VerificationMethod[] | null = null;
        try {
          const settings = await securityService.getSettings();
          userEnabledMethods =
            getEnabledTransactionVerificationMethods(settings);
        } catch {
          userEnabledMethods = null;
        }
        const hasNoSecurityMethods =
          userEnabledMethods !== null && userEnabledMethods.length === 0;

        const methods = getAvailableVerificationMethods(
          verificationChallenge.availableMethods,
          verificationChallenge.verificationType,
        );
        const selectedMethod = resolveVerificationMethod(
          methods,
          userEnabledMethods?.includes("totp")
            ? "totp"
            : verificationChallenge.verificationType,
        );
        setVerification((prev) => ({
          availableMethods: hasNoSecurityMethods ? [] : methods,
          selectedMethod:
            prev?.selectedMethod && methods.includes(prev.selectedMethod)
              ? prev.selectedMethod
              : selectedMethod,
          verificationType: getVerificationTypeForMethod(selectedMethod),
          action: verificationChallenge.action,
          otpSent: hasNoSecurityMethods
            ? false
            : isVerifying
              ? true
              : selectedMethod === "totp",
        }));
        if (isVerifying) {
          const msg = "Invalid verification code. Please try again.";
          setVerificationError(msg);
          toast.error(msg);
        } else {
          setVerificationError(null);
          if (!hasNoSecurityMethods && selectedMethod === "totp") {
            toast.info("Enter your authenticator code to continue.");
          }
        }
        return;
      }
      const fallbackMsg = extractHumanErrorMessage(error);
      if (isVerifying) {
        setVerificationError(fallbackMsg);
      } else {
        setVerification(null);
      }
      toast.error(fallbackMsg);
    } finally {
      setIsSubmitting(false);
      setStickyVerificationCode(null);
      setStickyTransferMeta(null);
    }
  };

  const handleReviewSubmit = () => {
    if (successState) return;
    if (activeMode === "swap") {
      void executeSwap();
    } else {
      void executeBridge();
    }
  };

  const handleVerify = async (
    code: string,
    method?: VerificationMethod,
  ) => {
    if (activeMode === "swap") {
      await executeSwap(code, method);
    } else {
      await executeBridge(code, method);
    }
  };

  // Convert Asset to SwapAssetOption / BridgeAssetOption for Review Step
  const swapSourceOption: SwapAssetOption | null = source
    ? {
        key: source.key,
        symbol: source.symbol,
        name: source.name,
        chainKey: source.chainKey,
        chainName: source.chainName,
        chainId: source.chainId,
        chainType: source.chainType,
        tokenAddress: source.tokenAddress || "",
        decimals: source.decimals,
        balance: source.balance,
      }
    : null;

  const swapDestinationOption: SwapAssetOption | null = destination
    ? {
        key: destination.key,
        symbol: destination.symbol,
        name: destination.name,
        chainKey: destination.chainKey,
        chainName: destination.chainName,
        chainId: destination.chainId,
        chainType: destination.chainType,
        tokenAddress: destination.tokenAddress || "",
        decimals: destination.decimals,
        balance: destination.balance,
      }
    : null;

  const bridgeSourceOption: BridgeAssetOption | null = source
    ? {
        key: source.key,
        symbol: source.symbol,
        name: source.name,
        chainKey: source.chainKey,
        chainName: source.chainName,
        chainId: source.chainId,
        chainType: source.chainType,
        balance: source.balance,
      }
    : null;

  const bridgeDestinationOption: BridgeAssetOption | null = destination
    ? {
        key: destination.key,
        symbol: destination.symbol,
        name: destination.name,
        chainKey: destination.chainKey,
        chainName: destination.chainName,
        chainId: destination.chainId,
        chainType: destination.chainType,
        balance: destination.balance,
      }
    : null;

  return (
    <div className="container mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-4 pb-[env(safe-area-inset-bottom)] md:min-h-[90dvh] md:px-6 md:pb-32 md:pt-20">
      <FlowHeader
        title="Bridge"
        onBack={
          view === "review"
            ? () => setView("compose")
            : () => router.push("/assets")
        }
        onClose={() => router.push("/assets")}
        closeLabel="Close bridge flow"
        className="mb-8 pt-4 md:mb-8 md:pt-0"
      />

      <FlowStepIndicator
        currentStep={view === "compose" ? 0 : 1}
        totalSteps={2}
      />

      <div className="pt-1">
        {view === "compose" ? (
          <BridgeComposeStep
            sources={sources}
            destinations={destinations}
            source={source}
            destination={destination}
            amount={amount}
            receiveAmount={receiveAmount}
            isAmountValid={isAmountValid}
            mode={activeMode}
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            onModeToggle={handleModeToggle}
            onSourceChange={(key) => {
              setSourceKey(key);
              setDestinationKey("");
              setAmount("");
            }}
            onDestinationChange={(key) => {
              setDestinationKey(key);
            }}
            onAmountChange={setAmount}
            onFlip={handleFlip}
            canFlip={canFlip}
            // Swap
            swapRoutes={swapRoutes}
            selectedSwapRoute={selectedSwapRoute}
            isLoadingSwapRoutes={swapQuoteQuery.isFetching}
            swapError={swapError}
            onSelectSwapRoute={setSelectedSwapRoute}
            // Bridge
            bridgeRoutes={rankedBridgeRoutes}
            selectedBridgeRoute={selectedBridgeRoute}
            bestRouteId={bestBridgeRouteId}
            fastestRouteId={fastestBridgeRouteId}
            isLoadingBridgeRoutes={bridgeQuoteQuery.isFetching}
            bridgeError={bridgeError}
            onSelectBridgeRoute={setSelectedBridgeRoute}
            // Shared
            showAllRoutes={showAllRoutes}
            onShowAllRoutes={() => setShowAllRoutes((prev) => !prev)}
            isSubmitting={isSubmitting}
            onReview={() => setView("review")}
          />
        ) : (
          activeMode === "swap" && swapSourceOption && swapDestinationOption && selectedSwapRoute ? (
            <SwapReviewStep
              source={swapSourceOption}
              destination={swapDestinationOption}
              amount={amountNumber}
              route={selectedSwapRoute}
              isSubmitting={isSubmitting || Boolean(successState)}
              onSubmit={handleReviewSubmit}
            />
          ) : bridgeSourceOption && bridgeDestinationOption && selectedBridgeRoute ? (
            <BridgeReviewStep
              source={bridgeSourceOption}
              destination={bridgeDestinationOption}
              amount={amountNumber}
              route={selectedBridgeRoute}
              isSubmitting={isSubmitting || Boolean(successState)}
              onSubmit={handleReviewSubmit}
            />
          ) : null
        )}
      </div>

      {/* 2FA Verification Modal */}
      {verification ? (
        <TransferVerificationModal
          isOpen={Boolean(verification)}
          isSubmitting={isSubmitting}
          verificationType={verification.verificationType}
          availableMethods={verification.availableMethods}
          selectedMethod={verification.selectedMethod}
          onMethodChange={handleMethodChange}
          otpSent={verification.otpSent}
          onResend={() => void requestOtp(verification.selectedMethod)}
          isResending={isResending}
          onClose={() => {
            if (!isSubmitting) {
              setVerification(null);
              setVerificationError(null);
            }
          }}
          onSubmit={(code, method) => void handleVerify(code, method)}
          title={activeMode === "swap" ? "Confirm swap" : "Confirm bridge"}
          actionNoun={activeMode === "swap" ? "swap" : "bridge"}
          errorMessage={verificationError}
          onClearError={() => setVerificationError(null)}
        />
      ) : null}

      {/* Success Modal (Swap & Bridge) */}
      {successState ? (
        <BridgeSuccessModal
          open={Boolean(successState)}
          state={successState}
          onViewTransactions={async () => {
            let targetId: string | null | undefined =
              resolvedTransactionId || successState.transactionId;
            if (!targetId) {
              targetId = await resolveFlowTransactionId({
                transactionId: successState.transactionId,
                txHash: successState.txHash,
                groupId: successState.tracking?.groupId,
                type:
                  successState.mode === "swap"
                    ? ["SWAP", "TRANSFER_OUT"]
                    : ["BRIDGE", "SWAP"],
                symbol: successState.symbol,
                amount: successState.amount,
                maxAttempts: 5,
              });
            }
            if (targetId) {
              router.push(getTransactionDetailsPath(targetId, "flow"));
            } else {
              router.push("/transactions");
            }
          }}
          onDone={() => {
            router.push("/");
          }}
          onDismiss={() => {
            router.push("/");
          }}
        />
      ) : null}
    </div>
  );
}

export { BridgeFlow as ConvertFlow };
