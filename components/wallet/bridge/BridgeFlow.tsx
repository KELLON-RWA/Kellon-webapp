"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useWallets } from "@privy-io/react-auth"
import { toast } from "sonner"
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal"
import FlowHeader from "@/components/wallet/shared/FlowHeader"
import FlowStepIndicator from "@/components/wallet/shared/FlowStepIndicator"
import {
  getBridgeDestinations,
  getBridgeSources,
  isExecutableBridgePair,
  type BridgeAssetOption,
} from "@/lib/bridge-assets"
import {
  useSmartAccount,
  setStickyTransferMeta,
  setStickyVerificationCode,
} from "@/hooks/useSmartAccount"
import {
  findTransferVerificationRequiredError,
  getAvailableVerificationMethods,
  getOtpChannelForMethod,
  getVerificationTypeForMethod,
  resolveVerificationMethod,
  transferService,
  type VerificationMethod,
} from "@/services/api/transfers"
import {
  getEnabledTransactionVerificationMethods,
  securityService,
} from "@/services/api/security"
import type { User } from "@/types/db"
import {
  bridgeService,
  type BridgeRateOption,
} from "@/services/api/bridge"
import {
  bridgeOutbox,
  type BridgeOutboxJob,
} from "@/services/api/bridge-outbox"
import { yieldService } from "@/services/api/yield"
import { BridgeComposeStep } from "./steps/ComposeStep"
import { BridgeReviewStep } from "./steps/ReviewStep"
import BridgeSuccessModal from "./BridgeSuccessModal"
import type { BridgeVerification, EvmSmartAccountClient } from "./types"
import {
  getRouteDuration,
  getRouteId,
  matchesBridgeRecommendation,
} from "./utils"

export interface BridgeFlowProps {
  profile: User
  embedded?: boolean
  initialSymbol?: BridgeAssetOption["symbol"]
  initialSourceChain?: string
  initialDestinationChain?: string
  initialAmount?: string
  onClose?: () => void
  onSubmitted?: () => void
}

export default function BridgeFlow({
  profile,
  embedded = false,
  initialSymbol,
  initialSourceChain,
  initialDestinationChain,
  initialAmount = "",
  onClose,
  onSubmitted,
}: BridgeFlowProps) {
  const router = useRouter()
  const { wallets, ready: walletsReady } = useWallets()
  const { getSmartAccountClient } = useSmartAccount()
  const sources = useMemo(
    () => getBridgeSources(profile.assets || []),
    [profile.assets],
  )
  const bridgeSources = useMemo(
    () => sources.filter((source) => source.chainType !== "solana"),
    [sources],
  )
  const destinations = useMemo(() => getBridgeDestinations(), [])
  const [sourceKey, setSourceKey] = useState(
    bridgeSources.find(
      (item) =>
        (!initialSymbol || item.symbol === initialSymbol) &&
        (!initialSourceChain || item.chainKey === initialSourceChain),
    )?.key ||
      bridgeSources.find(
        (item) =>
          (!initialSymbol || item.symbol === initialSymbol) &&
          item.chainKey !== initialDestinationChain,
      )?.key ||
      bridgeSources[0]?.key ||
      "",
  )
  const [destinationKey, setDestinationKey] = useState(
    initialSymbol && initialDestinationChain
      ? `${initialSymbol}:${initialDestinationChain}`
      : "",
  )
  const [amount, setAmount] = useState(initialAmount)
  const [selectedRoute, setSelectedRoute] = useState<BridgeRateOption | null>(
    null,
  )
  const [view, setView] = useState<"compose" | "review">("compose")
  const [showAllRoutes, setShowAllRoutes] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [verification, setVerification] = useState<BridgeVerification | null>(
    null,
  )
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [bridgeSuccess, setBridgeSuccess] = useState<{
    symbol: BridgeAssetOption["symbol"]
    amount: string
    destination: BridgeAssetOption
    submissionPhase: "preparing" | "approving" | "submitted" | "completed"
    tracking?: Pick<
      BridgeOutboxJob,
      "txHash" | "provider" | "fromChain" | "toChain" | "amount" | "symbol" | "groupId"
    >
  } | null>(null)

  const source = bridgeSources.find((item) => item.key === sourceKey) || null
  const selectedSymbol = source?.symbol || null
  const destination =
    destinations.find((item) => item.key === destinationKey) || null
  const amountValue = Number(amount)
  const thresholdsQuery = useQuery({
    queryKey: ["bridge-minimum-thresholds"],
    queryFn: bridgeService.getMinThresholds,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const minimumAmount = Number(
    (source?.symbol && thresholdsQuery.data?.[source.symbol]) || 1,
  )
  const isAmountValid =
    Boolean(source) &&
    Number.isFinite(amountValue) &&
    amountValue >= minimumAmount &&
    amountValue <= (source?.balance || 0)
  const isExecutablePair = Boolean(
    source && destination && isExecutableBridgePair(source, destination),
  )

  const availableDestinations = useMemo(
    () =>
      destinations.filter(
        (item) =>
          item.symbol === selectedSymbol && item.chainKey !== source?.chainKey,
      ),
    [destinations, selectedSymbol, source?.chainKey],
  )

  useEffect(() => {
    const destinationIsValid = availableDestinations.some(
      (item) => item.key === destinationKey,
    )
    if (!source || !destinationIsValid) {
      const preferred = source
        ? availableDestinations.find((item) =>
            isExecutableBridgePair(source, item),
          )
        : null
      setDestinationKey(preferred?.key || availableDestinations[0]?.key || "")
    }
  }, [availableDestinations, destinationKey, source])

  const selectToken = (symbol: BridgeAssetOption["symbol"]) => {
    const nextSource =
      sources.find(
        (item) => item.symbol === symbol && item.chainKey === source?.chainKey,
      ) || sources.find((item) => item.symbol === symbol)
    if (!nextSource) return

    setSourceKey(nextSource.key)
    setDestinationKey("")
    setAmount("")
    setSelectedRoute(null)
  }

  const swapNetworks = () => {
    if (!source || !destination) return
    const reverseSource = bridgeSources.find(
      (item) =>
        item.symbol === source.symbol && item.chainKey === destination.chainKey,
    )
    const reverseDestination = destinations.find(
      (item) =>
        item.symbol === source.symbol && item.chainKey === source.chainKey,
    )
    if (!reverseSource || !reverseDestination) {
      toast.info(
        `You need a ${source.symbol} balance on ${destination.chainName} to bridge in the opposite direction.`,
      )
      return
    }

    setSourceKey(reverseSource.key)
    setDestinationKey(reverseDestination.key)
    setAmount("")
    setSelectedRoute(null)
  }

  const canSwapNetworks = Boolean(
    source &&
      destination &&
      bridgeSources.some(
        (item) =>
          item.symbol === source.symbol &&
          item.chainKey === destination.chainKey,
      ),
  )

  const quoteQuery = useQuery({
    queryKey: ["bridge-rates", source?.key, destination?.key, amount],
    queryFn: async () => {
      if (!source || !destination) {
        return { options: [], minThresholds: {} }
      }
      return bridgeService.compareRates({
        fromChain: source.chainKey,
        toChain: destination.chainKey,
        fromToken: source.symbol,
        toToken: destination.symbol,
        amount,
      })
    },
    enabled: isExecutablePair && isAmountValid,
    staleTime: 20_000,
    retry: 1,
  })

  const rankedRoutes = useMemo(
    () =>
      [...(quoteQuery.data?.options || [])]
        .filter((route) => route.supported)
        .sort((left, right) => {
          const leftAmount = Number(left.estimatedOutput || 0)
          const rightAmount = Number(right.estimatedOutput || 0)
          if (leftAmount === rightAmount) {
            return getRouteDuration(left) - getRouteDuration(right)
          }
          return leftAmount > rightAmount ? -1 : 1
        }),
    [quoteQuery.data],
  )

  const recommendedRoute = rankedRoutes.find((route) =>
    matchesBridgeRecommendation(route, quoteQuery.data?.recommended),
  )
  const bestRouteId = getRouteId(recommendedRoute || rankedRoutes[0])
  const fastestRouteId = useMemo(
    () =>
      rankedRoutes
        .filter((route) => getRouteDuration(route) > 0)
        .reduce<BridgeRateOption | null>((fastest, route) => {
          if (!fastest) return route
          return getRouteDuration(route) < getRouteDuration(fastest)
            ? route
            : fastest
        }, null),
    [rankedRoutes],
  )
  const fastestRouteKey = fastestRouteId
    ? getRouteId(fastestRouteId)
    : undefined

  useEffect(() => {
    setSelectedRoute((current) => {
      const currentId = current ? getRouteId(current) : null
      return (
        rankedRoutes.find((route) => getRouteId(route) === currentId) ||
        recommendedRoute ||
        rankedRoutes[0] ||
        null
      )
    })
    setShowAllRoutes(false)
    setView("compose")
  }, [rankedRoutes, recommendedRoute])

  const quoteError =
    quoteQuery.error instanceof Error ? quoteQuery.error.message : null
  const receiveAmount = selectedRoute?.estimatedOutput || ""
  const finishBridge = () => {
    if (!bridgeSuccess) return

    if (embedded) {
      onSubmitted?.()
      return
    }

    router.push(
      `/assets/${bridgeSuccess.symbol.toLowerCase()}?network=${bridgeSuccess.destination.chainKey}`,
    )
  }

  const executeBridge = async (
    code?: string,
    methodOverride?: VerificationMethod,
  ) => {
    if (!source || !destination || !selectedRoute) return
    setIsSubmitting(true)
    setBridgeSuccess({
      symbol: source.symbol,
      amount: receiveAmount || amount,
      destination,
      submissionPhase: "preparing",
    })

    try {
      const effectiveMethod =
        methodOverride || verification?.selectedMethod || "totp"
      if (code) {
        setStickyVerificationCode({ type: effectiveMethod, code })
      } else {
        setStickyVerificationCode(null)
      }
      const plan = await bridgeService.calculatePlan({
        symbol: source.symbol,
        amount,
        selectedChains: [source.chainKey],
        targetChain: destination.chainKey,
        targetToken: destination.symbol,
      })
      if (plan.insufficientBalances || Number(plan.shortfall || 0) > 0) {
        throw new Error("Your available balance cannot fund this bridge.")
      }

      const execution = await bridgeService.executePlan(
        plan,
        destination.chainKey,
        {
          messenger: selectedRoute.messenger,
          targetToken: destination.symbol,
          provider: selectedRoute.provider,
          verification: code && verification
            ? {
              verificationCode: code,
              verificationType: getVerificationTypeForMethod(
                verification.selectedMethod,
              ),
              verificationCodes: [
                {
                  type: getVerificationTypeForMethod(
                    verification.selectedMethod,
                  ),
                  code,
                },
              ],
              }
            : undefined,
        },
      )
      if (execution.transactions.length === 0) {
        setVerification(null)
        setBridgeSuccess({
          symbol: source.symbol,
          amount,
          destination,
          submissionPhase: "completed",
        })
        return
      }

      const transactions = execution.transactions
      let hash: string
      setBridgeSuccess((current) =>
        current ? { ...current, submissionPhase: "approving" } : current,
      )
      if (source.chainType === "stellar") {
        const stellarTransactions = transactions.filter(
          (transaction) => transaction.serializedTx || transaction.data,
        )
        if (stellarTransactions.length !== transactions.length) {
          throw new Error("The backend returned a non-Stellar bridge payload.")
        }
        if (stellarTransactions.length === 0) {
          throw new Error("The backend returned no Stellar bridge payload.")
        }
        hash = ""
        for (const transaction of stellarTransactions) {
          const result = await yieldService.executeStellar(
            "bridge",
            amount,
            transaction.serializedTx || transaction.data || "",
            "supply",
          )
          hash = result.data?.txHash || ""
          if (!hash) throw new Error("The Stellar bridge transaction failed.")
        }
      } else {
        if (!walletsReady) {
          throw new Error("Wallet is still loading. Please try again.")
        }
        const embeddedWallet = wallets.find(
          (wallet) =>
            wallet.walletClientType === "privy" &&
            wallet.address.startsWith("0x"),
        )
        if (!embeddedWallet) {
          throw new Error(
            "Your embedded wallet is unavailable. Please log in again.",
          )
        }
        const smartAccount = await getSmartAccountClient(
          embeddedWallet,
          source.chainKey,
        )
        if (!smartAccount) {
          throw new Error(
            `Could not initialize your ${source.chainName} account.`,
          )
        }
        if (transactions.some((transaction) => transaction.serializedTx)) {
          throw new Error("The backend returned a non-EVM bridge payload.")
        }
        if (transactions.some((transaction) => !transaction.to)) {
          throw new Error(
            "The backend returned incomplete bridge transaction instructions.",
          )
        }
        setStickyTransferMeta({
          amount: amountValue,
          symbol: source.symbol,
          toAddress: transactions.at(-1)?.to || "",
        })
        hash = await (
          smartAccount as unknown as EvmSmartAccountClient
        ).sendTransaction({
          account: smartAccount.account,
          chain: smartAccount.chain,
          calls: transactions.map((transaction) => ({
            to: transaction.to as `0x${string}`,
            data: transaction.data as `0x${string}` | undefined,
            value: BigInt(transaction.value || 0),
          })),
        })
      }

      const sourceProvider = execution.steps[0]?.bridgeProvider
      const provider =
        sourceProvider && sourceProvider !== "manual"
          ? sourceProvider
          : selectedRoute.provider
      const tracking = {
        txHash: hash,
        provider,
        fromChain: source.chainKey,
        toChain: destination.chainKey,
        amount,
        symbol: source.symbol,
        groupId: execution.groupId,
      }

      setVerification(null)
      setVerificationError(null)
      setBridgeSuccess({
        symbol: source.symbol,
        amount: receiveAmount || amount,
        destination,
        submissionPhase: "submitted",
        tracking,
      })
      if (
        profile.id &&
        (provider === "lifi" || provider === "allbridge" || provider === "cctp")
      ) {
        bridgeOutbox.save(profile.id, tracking)
        void bridgeOutbox.flush(profile.id)
      }
    } catch (error) {
      setBridgeSuccess(null)
      const verificationChallenge = findTransferVerificationRequiredError(error)
      const isVerifying = Boolean(code)
      if (verificationChallenge) {
        let userEnabledMethods: VerificationMethod[] | null = null
        try {
          const settings = await securityService.getSettings()
          userEnabledMethods = getEnabledTransactionVerificationMethods(settings)
        } catch {
          userEnabledMethods = null
        }
        const hasNoSecurityMethods =
          userEnabledMethods !== null && userEnabledMethods.length === 0

        const methods = getAvailableVerificationMethods(
          verificationChallenge.availableMethods,
          verificationChallenge.verificationType,
        )
        const selectedMethod = resolveVerificationMethod(
          methods,
          userEnabledMethods?.includes("totp")
            ? "totp"
            : verificationChallenge.verificationType,
        )
        setVerification((prev) => ({
          availableMethods: hasNoSecurityMethods ? [] : methods,
          selectedMethod:
            prev?.selectedMethod && methods.includes(prev.selectedMethod)
              ? prev.selectedMethod
              : selectedMethod,
          verificationType: getVerificationTypeForMethod(selectedMethod),
          action: verificationChallenge.action,
          otpSent: hasNoSecurityMethods ? false : isVerifying ? true : selectedMethod !== "totp",
        }))
        if (isVerifying) {
          const msg = "Invalid verification code. Please try again."
          setVerificationError(msg)
          toast.error(msg)
        } else {
          setVerificationError(null)
          if (!hasNoSecurityMethods) {
            if (selectedMethod !== "totp") {
              toast.info(
                selectedMethod === "sms_otp"
                  ? "We sent a verification code to your phone. Enter it to continue."
                  : "We sent a verification code to your email. Enter it to continue.",
              )
            } else {
              toast.info("Enter your authenticator code to continue.")
            }
          }
        }
        return
      }
      const fallbackMsg =
        error instanceof Error ? error.message : "Unable to submit bridge"
      if (isVerifying) {
        setVerificationError(fallbackMsg)
      } else {
        setVerification(null)
      }
      toast.error(fallbackMsg)
    } finally {
      setStickyVerificationCode(null)
      setStickyTransferMeta(null)
      setIsSubmitting(false)
    }
  }

  const requestOtp = async (method: VerificationMethod) => {
    const channel = getOtpChannelForMethod(method)
    if (!verification || !channel || isResending) return
    setIsResending(true)
    setVerificationError(null)
    try {
      await transferService.requestOTP(
        verification.action || "transfer",
        channel,
      )
      setVerification((current) =>
        current ? { ...current, otpSent: true } : current,
      )
      toast.success("Verification code sent")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send code",
      )
    } finally {
      setIsResending(false)
    }
  }

  const selectVerificationMethod = (method: VerificationMethod) => {
    const channel = getOtpChannelForMethod(method)
    setVerification((current) =>
      current
        ? {
            ...current,
            selectedMethod: method,
            verificationType: getVerificationTypeForMethod(method),
            otpSent: channel === null,
          }
        : current,
    )
  }

  const routeUnavailableMessage =
    source && destination && !isExecutablePair
      ? `${source.chainName} to ${destination.chainName} bridging is not available yet.`
      : quoteError
        ? "No bridge route is currently available for this pair."
        : null

  return (
    <section
      className={
        embedded
          ? "mx-auto flex w-full max-w-4xl flex-col overflow-x-hidden px-4 pb-6 pt-2 md:px-6"
          : "container mx-auto flex min-h-[90dvh] max-w-4xl flex-col overflow-x-hidden px-4 pb-28 pt-4 md:px-6 md:pb-14 md:pt-20"
      }
    >
      <FlowHeader
        title={view === "review" ? "Review bridge" : "Bridge"}
        onBack={() =>
          view === "review"
            ? setView("compose")
            : embedded
              ? onClose?.()
              : router.back()
        }
        onClose={embedded ? onClose : undefined}
        closeLabel="Close bridge"
        className="mb-6 md:mb-8"
      />

      <FlowStepIndicator
        currentStep={view === "review" ? 1 : 0}
        totalSteps={2}
      />

      {view === "review" && source && destination && selectedRoute ? (
        <BridgeReviewStep
          source={source}
          destination={destination}
          amount={amountValue}
          route={selectedRoute}
          isSubmitting={isSubmitting}
          onSubmit={() => void executeBridge()}
        />
      ) : (
        <BridgeComposeStep
          sources={bridgeSources}
          availableDestinations={availableDestinations}
          source={source}
          destination={destination}
          sourceKey={sourceKey}
          destinationKey={destinationKey}
          amount={amount}
          receiveAmount={receiveAmount}
          minimumAmount={minimumAmount}
          isAmountValid={isAmountValid}
          canSwapNetworks={canSwapNetworks}
          routes={rankedRoutes}
          selectedRoute={selectedRoute}
          bestRouteId={bestRouteId}
          fastestRouteId={fastestRouteKey}
          isLoadingRoutes={quoteQuery.isFetching}
          showAllRoutes={showAllRoutes}
          routeUnavailableMessage={routeUnavailableMessage}
          isSubmitting={isSubmitting}
          onTokenSelect={selectToken}
          onSourceChange={(value) => {
            setSourceKey(value)
            setAmount("")
            setSelectedRoute(null)
          }}
          onDestinationChange={(value) => {
            setDestinationKey(value)
            setSelectedRoute(null)
          }}
          onAmountChange={setAmount}
          onSwapNetworks={swapNetworks}
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
        onClose={() => {
          if (!isSubmitting) {
            setVerification(null)
            setVerificationError(null)
          }
        }}
        onSubmit={(code, method) => void executeBridge(code, method)}
        title="Confirm bridge"
        actionNoun="bridge"
        errorMessage={verificationError}
        onClearError={() => setVerificationError(null)}
      />
      {bridgeSuccess ? (
        <BridgeSuccessModal
          open
          amount={bridgeSuccess.amount}
          symbol={bridgeSuccess.symbol}
          destination={bridgeSuccess.destination.chainName}
          destinationHref={
            embedded
              ? undefined
              : `/assets/${bridgeSuccess.symbol.toLowerCase()}?network=${bridgeSuccess.destination.chainKey}`
          }
          tracking={bridgeSuccess.tracking}
          submissionPhase={bridgeSuccess.submissionPhase}
          onDone={finishBridge}
          onDismiss={() => setBridgeSuccess(null)}
        />
      ) : null}
    </section>
  )
}
