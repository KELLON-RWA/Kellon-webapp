"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useWallets } from "@privy-io/react-auth"
import { toast } from "sonner"
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal"
import FlowHeader from "@/components/wallet/shared/FlowHeader"
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
import type { User } from "@/types/db"
import { bridgeService, type BridgeRateOption } from "@/services/api/bridge"
import { BridgeComposeStep } from "./steps/ComposeStep"
import { BridgeReviewStep } from "./steps/ReviewStep"
import type { BridgeVerification, EvmSmartAccountClient } from "./types"
import {
  getRouteDuration,
  getRouteId,
  matchesBridgeRecommendation,
} from "./utils"

interface BridgeFlowProps {
  profile: User
}

async function monitorBridgeStatus(
  params: Parameters<typeof bridgeService.getStatus>[0],
): Promise<void> {
  const completedStatuses = new Set(["done", "success", "completed"])
  const failedStatuses = new Set(["failed", "expired", "refunded"])

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 8_000))
    try {
      const result = await bridgeService.getStatus(params)
      const status = (result.status || "").toLowerCase()
      if (completedStatuses.has(status) || failedStatuses.has(status)) return
    } catch {
      // Status polling is best-effort; the next attempt may succeed.
    }
  }
}

export default function BridgeFlow({ profile }: BridgeFlowProps) {
  const router = useRouter()
  const { wallets, ready: walletsReady } = useWallets()
  const { getSmartAccountClient } = useSmartAccount()
  const sources = useMemo(
    () => getBridgeSources(profile.assets || []),
    [profile.assets],
  )
  const destinations = useMemo(() => getBridgeDestinations(), [])
  const [sourceKey, setSourceKey] = useState(
    sources.find((item) => item.chainType === "evm")?.key ||
      sources[0]?.key ||
      "",
  )
  const [destinationKey, setDestinationKey] = useState("")
  const [amount, setAmount] = useState("")
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

  const source = sources.find((item) => item.key === sourceKey) || null
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
    const reverseSource = sources.find(
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
      sources.some(
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

  const executeBridge = async (code?: string) => {
    if (!source || !destination || !selectedRoute) return
    setIsSubmitting(true)

    try {
      if (!walletsReady)
        throw new Error("Wallet is still loading. Please try again.")
      const embeddedWallet = wallets.find(
        (wallet) =>
          wallet.walletClientType === "privy" &&
          wallet.address.startsWith("0x"),
      )
      if (!embeddedWallet)
        throw new Error(
          "Your embedded wallet is unavailable. Please log in again.",
        )

      const smartAccount = await getSmartAccountClient(
        embeddedWallet,
        source.chainKey,
      )
      if (!smartAccount)
        throw new Error(
          `Could not initialize your ${source.chainName} account.`,
        )

      if (code && verification) {
        setStickyVerificationCode({ type: verification.selectedMethod, code })
      } else {
        setStickyVerificationCode(null)
      }
      const plan = await bridgeService.calculatePlan({
        symbol: source.symbol,
        amount,
        selectedChains: [source.chainKey],
        targetChain: destination.chainKey,
      })
      if (plan.insufficientBalances || Number(plan.shortfall || 0) > 0) {
        throw new Error("Your available balance cannot fund this bridge.")
      }

      const execution = await bridgeService.executePlan(
        plan,
        destination.chainKey,
        selectedRoute.messenger,
      )
      if (execution.transactions.length === 0) {
        setVerification(null)
        toast.success("Funds are already on the destination network")
        router.push("/")
        return
      }

      const transactions = execution.transactions
      if (transactions.some((transaction) => transaction.serializedTx)) {
        throw new Error(
          "This bridge route requires a non-EVM signer that is not available on web yet.",
        )
      }
      if (
        transactions.length === 0 ||
        transactions.some((transaction) => !transaction.to)
      ) {
        throw new Error(
          "The backend returned incomplete bridge transaction instructions.",
        )
      }

      setStickyTransferMeta({
        amount: amountValue,
        symbol: source.symbol,
        toAddress: transactions.at(-1)?.to || "",
      })

      const calls = transactions.map((transaction) => ({
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}` | undefined,
        value: BigInt(transaction.value || 0),
      }))

      const hash = await (
        smartAccount as unknown as EvmSmartAccountClient
      ).sendTransaction({
        account: smartAccount.account,
        chain: smartAccount.chain,
        calls,
      })

      setVerification(null)
      toast.success("Bridge submitted", {
        description: `Your ${source.symbol} is moving to ${destination.chainName}. Transaction: ${hash.slice(0, 10)}…`,
      })
      void monitorBridgeStatus({
        provider: selectedRoute.provider,
        txHash: hash,
        chainId: Number(source.chainId),
        fromChain: source.chainKey,
        toChain: destination.chainKey,
        amount,
        symbol: source.symbol,
      })
      router.push("/")
    } catch (error) {
      const verificationError = findTransferVerificationRequiredError(error)
      if (verificationError) {
        const methods = getAvailableVerificationMethods(
          verificationError.availableMethods,
          verificationError.verificationType,
        )
        const selectedMethod = resolveVerificationMethod(
          methods,
          verificationError.verificationType,
        )
        setVerification({
          availableMethods: methods,
          selectedMethod,
          verificationType: getVerificationTypeForMethod(selectedMethod),
          action: verificationError.action,
          otpSent: selectedMethod !== "totp",
        })
        return
      }
      toast.error(
        error instanceof Error ? error.message : "Unable to submit bridge",
      )
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
    <section className="container mx-auto flex min-h-[90dvh] max-w-4xl flex-col overflow-x-hidden px-4 pb-28 pt-4 md:px-6 md:pb-14 md:pt-20">
      <FlowHeader
        title={view === "review" ? "Review bridge" : "Bridge"}
        onBack={() =>
          view === "review" ? setView("compose") : router.back()
        }
        className="mb-6 md:mb-8"
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
          sources={sources}
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
  )
}
