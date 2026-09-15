"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useWallets } from "@privy-io/react-auth"
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Loader2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal"
import ChainIcon from "@/components/wallet/ChainIcon"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSmartAccount, setStickyTransferMeta, setStickyVerificationCode } from "@/hooks/useSmartAccount"
import {
  getBridgeSources,
  normalizeBridgeChain,
  type BridgeAssetOption,
  type BridgeSymbol,
} from "@/lib/bridge-assets"
import { getChainLabel } from "@/lib/chains"
import { cn } from "@/lib/utils"
import {
  bridgeService,
  type BridgeProvider,
  type FundingPlan,
} from "@/services/api/bridge"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import type { BridgeVerification, EvmSmartAccountClient } from "./types"
import { formatBridgeBalance } from "./utils"

export interface BridgeFundingRequest {
  symbol: string
  targetChain: string
  requiredAmount: number
  targetBalance: number
}

interface BridgeFundingOverlayProps {
  profile: User
  request: BridgeFundingRequest | null
  onOpenChange: (open: boolean) => void
  onSubmitted?: () => void
}

type FundingSetup = {
  symbol: BridgeSymbol
  targetChain: string
  targetBalance: number
  requiredAmount: number
  deficit: number
  sources: BridgeAssetOption[]
}

type SubmittedBridge = {
  provider: BridgeProvider
  txHash: string
  sourceChain: string
}

type FundingSourceStatus =
  | "planned"
  | "signing"
  | "submitted"
  | "completed"
  | "attention"

type FundingSourceExecution = {
  amount: number
  status: FundingSourceStatus
  txHash?: string
}

const COMPLETE_STATUSES = new Set(["done", "success", "completed"])
const TERMINAL_STATUSES = new Set([
  ...COMPLETE_STATUSES,
  "failed",
  "expired",
  "refunded",
])

async function waitForBridge(bridge: SubmittedBridge, setup: FundingSetup) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 8_000))
    try {
      const result = await bridgeService.getStatus({
        provider: bridge.provider,
        txHash: bridge.txHash,
        fromChain: bridge.sourceChain,
        toChain: setup.targetChain,
        symbol: setup.symbol,
      })
      const status = (result.status || "").toLowerCase()
      if (TERMINAL_STATUSES.has(status)) return COMPLETE_STATUSES.has(status)
    } catch {
      // A temporary provider failure should not stop status reconciliation.
    }
  }
  return false
}

function getFundingSetup(
  profile: User,
  request: BridgeFundingRequest | null,
): FundingSetup | null {
  if (!request) return null
  const symbol = request.symbol.toUpperCase()
  if (symbol !== "USDC" && symbol !== "USDT") return null

  const targetChain = normalizeBridgeChain(request.targetChain)
  const requiredAmount = Math.max(0, request.requiredAmount)
  const targetBalance = Math.max(0, request.targetBalance)
  const sources = getBridgeSources(profile.assets || []).filter(
    (source) => source.symbol === symbol,
  )
  return {
    symbol,
    targetChain,
    targetBalance,
    requiredAmount,
    deficit: Math.max(0, requiredAmount - targetBalance),
    sources,
  }
}

export default function BridgeFundingOverlay({
  profile,
  request,
  onOpenChange,
  onSubmitted,
}: BridgeFundingOverlayProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const queryClient = useQueryClient()
  const { wallets, ready: walletsReady } = useWallets()
  const { getSmartAccountClient } = useSmartAccount()
  const setup = useMemo(() => getFundingSetup(profile, request), [profile, request])
  const availableSources = useMemo(
    () =>
      (setup?.sources || []).filter(
        (source) =>
          source.chainType === "evm" &&
          source.chainKey !== setup?.targetChain,
      ),
    [setup?.sources, setup?.targetChain],
  )
  const availableSourceChains = useMemo(
    () => availableSources.map((source) => source.chainKey),
    [availableSources],
  )
  const setupKey = setup
    ? `${setup.symbol}:${setup.targetChain}:${setup.requiredAmount}:${setup.targetBalance}:${availableSourceChains.join(",")}`
    : ""
  const [sourceSelection, setSourceSelection] = useState<{
    setupKey: string
    chains: string[]
  }>({ setupKey: "", chains: [] })
  const selectedSourceChains = useMemo(
    () =>
      sourceSelection.setupKey === setupKey ? sourceSelection.chains : [],
    [setupKey, sourceSelection],
  )
  const [plan, setPlan] = useState<FundingPlan | null>(null)
  const [view, setView] = useState<"plan" | "review" | "submitted">("plan")
  const [isLoadingPlan, setIsLoadingPlan] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [verification, setVerification] = useState<BridgeVerification | null>(null)
  const [sourceExecutions, setSourceExecutions] = useState<
    Record<string, FundingSourceExecution>
  >({})
  const submittedSourcesRef = useRef(new Map<string, SubmittedBridge>())

  useEffect(() => {
    setPlan(null)
    setView("plan")
    setVerification(null)
    setSourceExecutions({})
    submittedSourcesRef.current.clear()
    if (
      !setup ||
      setup.deficit <= 0 ||
      selectedSourceChains.length === 0
    ) {
      setIsLoadingPlan(false)
      return
    }

    let cancelled = false
    setIsLoadingPlan(true)
    bridgeService
      .calculatePlan({
        symbol: setup.symbol,
        amount: String(setup.requiredAmount),
        selectedChains: [setup.targetChain, ...selectedSourceChains],
        targetChain: setup.targetChain,
      })
      .then((nextPlan) => {
        if (cancelled) return
        setPlan(nextPlan)
        setSourceExecutions(
          Object.fromEntries(
            nextPlan.sources
              .filter(
                (source) =>
                  normalizeBridgeChain(source.chain) !== setup.targetChain &&
                  Number(source.amount) > 0,
              )
              .map((source) => [
                normalizeBridgeChain(source.chain),
                { amount: Number(source.amount), status: "planned" as const },
              ]),
          ),
        )
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to calculate a funding plan",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlan(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedSourceChains, setup])

  const toggleSourceChain = (chain: string) => {
    if (view !== "plan" || isLoadingPlan) return
    setSourceSelection((current) => {
      const currentChains =
        current.setupKey === setupKey ? current.chains : []
      return {
        setupKey,
        chains: currentChains.includes(chain)
          ? currentChains.filter((item) => item !== chain)
          : [...currentChains, chain],
      }
    })
  }

  const close = () => onOpenChange(false)
  const shortfall = Number(plan?.shortfall || 0)
  const alreadyOnTarget = Math.min(
    setup?.requiredAmount || 0,
    setup?.targetBalance || 0,
  )
  const bridgeSources = useMemo(
    () =>
      (plan?.sources || []).filter(
        (source) =>
          normalizeBridgeChain(source.chain) !== setup?.targetChain &&
          Number(source.amount) > 0,
      ),
    [plan?.sources, setup?.targetChain],
  )
  const canExecute = Boolean(
    setup &&
      plan &&
      !plan.insufficientBalances &&
      shortfall <= 0 &&
      bridgeSources.length > 0,
  )

  const updateSourceExecution = (
    chain: string,
    update: Partial<FundingSourceExecution>,
  ) => {
    const normalizedChain = normalizeBridgeChain(chain)
    setSourceExecutions((current) => ({
      ...current,
      [normalizedChain]: {
        amount:
          current[normalizedChain]?.amount ||
          Number(
            bridgeSources.find(
              (source) =>
                normalizeBridgeChain(source.chain) === normalizedChain,
            )?.amount || 0,
          ),
        status: current[normalizedChain]?.status || "planned",
        ...update,
      },
    }))
  }

  const reconcileBalances = async (bridges: SubmittedBridge[]) => {
    await queryClient.invalidateQueries({ queryKey: ["user-session"] })
    if (bridges.length > 0) {
      await Promise.allSettled(
        bridges.map(async (bridge) => {
          const completed = await waitForBridge(bridge, setup!)
          updateSourceExecution(bridge.sourceChain, {
            status: completed ? "completed" : "attention",
          })
          return completed
        }),
      )
      await queryClient.invalidateQueries({ queryKey: ["user-session"] })
      await queryClient.invalidateQueries({ queryKey: ["transactions"] })
      onSubmitted?.()
    }
  }

  const executeFundingPlan = async (code?: string) => {
    if (!setup || !plan || !canExecute) return
    setIsSubmitting(true)
    let activeSourceChain: string | null = null

    try {
      if (!walletsReady) {
        throw new Error("Wallet is still loading. Please try again.")
      }
      const embeddedWallet = wallets.find(
        (wallet) =>
          wallet.walletClientType === "privy" && wallet.address.startsWith("0x"),
      )
      if (!embeddedWallet) {
        throw new Error("Your embedded wallet is unavailable. Please log in again.")
      }

      if (code && verification) {
        setStickyVerificationCode({ type: verification.selectedMethod, code })
      } else {
        setStickyVerificationCode(null)
      }

      const execution = await bridgeService.executePlan(plan, setup.targetChain)
      if (execution.steps.length === 0) {
        toast.success("The required funds are already on the destination network")
        await reconcileBalances([])
        onSubmitted?.()
        close()
        return
      }

      const submitted: SubmittedBridge[] = []
      for (const step of execution.steps) {
        const normalizedSourceChain = normalizeBridgeChain(step.sourceChain)
        activeSourceChain = normalizedSourceChain
        const previousSubmission = submittedSourcesRef.current.get(
          normalizedSourceChain,
        )
        if (previousSubmission) {
          updateSourceExecution(normalizedSourceChain, {
            status: "submitted",
            txHash: previousSubmission.txHash,
          })
          submitted.push(previousSubmission)
          activeSourceChain = null
          continue
        }

        updateSourceExecution(normalizedSourceChain, { status: "signing" })

        const transactions = [step.approveTx, step.bridgeTx].filter(Boolean)
        if (transactions.some((transaction) => transaction?.serializedTx)) {
          throw new Error(
            "A selected source requires a signer that is not available on web yet.",
          )
        }
        if (transactions.some((transaction) => !transaction?.to)) {
          throw new Error("The backend returned incomplete bridge instructions.")
        }

        const smartAccount = await getSmartAccountClient(
          embeddedWallet,
          normalizedSourceChain,
        )
        if (!smartAccount) {
          throw new Error(
            `Could not initialize your ${getChainLabel(step.sourceChain)} account.`,
          )
        }

        const sourceAmount = Number(
          plan.sources.find(
            (source) =>
              normalizeBridgeChain(source.chain) ===
              normalizeBridgeChain(step.sourceChain),
          )?.amount || 0,
        )
        setStickyTransferMeta({
          amount: sourceAmount,
          symbol: setup.symbol,
          toAddress: step.bridgeTx.to || "",
        })

        const hash = await (
          smartAccount as unknown as EvmSmartAccountClient
        ).sendTransaction({
          account: smartAccount.account,
          chain: smartAccount.chain,
          calls: transactions.map((transaction) => ({
            to: transaction!.to as `0x${string}`,
            data: transaction!.data as `0x${string}` | undefined,
            value: BigInt(transaction!.value || 0),
          })),
        })

        if (step.bridgeProvider === "lifi" || step.bridgeProvider === "allbridge") {
          const submittedBridge = {
            provider: step.bridgeProvider,
            txHash: hash,
            sourceChain: normalizedSourceChain,
          }
          submittedSourcesRef.current.set(
            normalizedSourceChain,
            submittedBridge,
          )
          updateSourceExecution(normalizedSourceChain, {
            status: "submitted",
            txHash: hash,
          })
          submitted.push(submittedBridge)
        }
        activeSourceChain = null
      }

      setVerification(null)
      setView("submitted")
      toast.success("Bridge transactions submitted", {
        description: `${bridgeSources.length} source network${bridgeSources.length === 1 ? " is" : "s are"} funding ${getChainLabel(setup.targetChain)}.`,
      })
      void reconcileBalances(submitted)
    } catch (error) {
      const verificationError = findTransferVerificationRequiredError(error)
      if (verificationError) {
        if (activeSourceChain) {
          updateSourceExecution(activeSourceChain, { status: "planned" })
        }
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
      if (activeSourceChain) {
        updateSourceExecution(activeSourceChain, { status: "attention" })
      }
      toast.error(
        error instanceof Error ? error.message : "Unable to submit bridge plan",
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
      await transferService.requestOTP(verification.action || "transfer", channel)
      setVerification((current) =>
        current ? { ...current, selectedMethod: method, otpSent: true } : current,
      )
      toast.success("Verification code sent")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send code")
    } finally {
      setIsResending(false)
    }
  }

  const content = setup ? (
    <div className="min-w-0 overflow-hidden px-5 py-5 md:px-8 md:py-7">
      <div className="mb-5 flex min-w-0 items-start gap-3">
        {view === "review" ? (
          <button
            type="button"
            onClick={() => setView("plan")}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-gray-95 text-black dark:border-white/10 dark:bg-secondary-50 dark:text-white"
            aria-label="Back to funding plan"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-70/10 text-primary-60">
            {view === "submitted" ? (
              <Check className="h-4 w-4" />
            ) : (
              <ArrowLeftRight className="h-4 w-4" />
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-black dark:text-white">
            {view === "review"
              ? "Review funding plan"
              : view === "submitted"
                ? "Bridge submitted"
                : "Bridge & Fund Wallet"}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Fund {formatBridgeBalance(setup.requiredAmount)} {setup.symbol} on{" "}
            {getChainLabel(setup.targetChain)} from other chains.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-gray-95 text-black dark:border-white/10 dark:bg-secondary-50 dark:text-white"
          aria-label="Close bridge funding"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {view === "submitted" ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Your funds are moving to {getChainLabel(setup.targetChain)}.
          </p>
          <div className="mt-3 space-y-2">
            {bridgeSources.map((source) => {
              const normalizedChain = normalizeBridgeChain(source.chain)
              return (
                <SourceExecutionRow
                  key={normalizedChain}
                  chain={normalizedChain}
                  execution={sourceExecutions[normalizedChain] || {
                    amount: Number(source.amount),
                    status: "planned",
                  }}
                  symbol={setup.symbol}
                />
              )
            })}
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Your original transaction keeps its amount and refreshes when every
            source bridge completes.
          </p>
          <button
            type="button"
            onClick={close}
            className="mt-4 h-11 w-full cursor-pointer rounded-xl bg-primary-60 text-sm font-bold text-white"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <section className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Source networks
            </p>
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
              {availableSources.map((source) => {
                const isSelected = selectedSourceChains.includes(source.chainKey)
                return (
                  <button
                    type="button"
                    key={source.key}
                    onClick={() => toggleSourceChain(source.chainKey)}
                    disabled={view !== "plan" || isLoadingPlan}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition disabled:cursor-default",
                      isSelected
                        ? "border-primary-60/60 bg-primary-70/10"
                        : "border-black/10 bg-gray-95 hover:border-primary-60/30 dark:border-white/10 dark:bg-secondary-50",
                    )}
                  >
                    <ChainIcon name={source.chainKey} size={22} className="!h-[22px] !w-[22px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold text-black dark:text-white">
                        {getCompactChainLabel(source.chainKey)}
                      </span>
                      <span className="block truncate text-[10px] text-gray-500 dark:text-gray-400">
                        {formatBridgeBalance(source.balance)} {setup.symbol}
                      </span>
                    </span>
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary-60" aria-hidden="true" />
                    ) : null}
                  </button>
                )
              })}
            </div>
            {availableSources.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                No other supported networks have an available {setup.symbol} balance.
              </p>
            ) : selectedSourceChains.length === 0 ? (
              <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-300">
                Select at least one source network to continue.
              </p>
            ) : null}
          </section>

          <section className="mt-4 min-w-0 rounded-2xl border border-black/10 bg-gray-95/70 p-3.5 dark:border-white/10 dark:bg-secondary-50/70">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-black dark:text-white">
                {view === "review" ? "Funding summary" : "Allocation plan"}
              </p>
              {isLoadingPlan ? <Loader2 className="h-4 w-4 animate-spin text-primary-60" /> : null}
            </div>

            {isLoadingPlan ? (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Calculating the best multi-chain allocation…
              </p>
            ) : plan ? (
              <div className="mt-3 space-y-1">
                {alreadyOnTarget > 0 ? (
                  <AllocationRow
                    chain={setup.targetChain}
                    amount={alreadyOnTarget}
                    symbol={setup.symbol}
                    label="Already available"
                  />
                ) : null}
                {bridgeSources.map((source) => (
                  <AllocationRow
                    key={`${source.chain}:${source.amount}`}
                    chain={source.chain}
                    amount={Number(source.amount)}
                    symbol={setup.symbol}
                  />
                ))}
                {view === "review" ? (
                  <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
                    <SummaryRow label="Required" value={`${formatBridgeBalance(setup.requiredAmount)} ${setup.symbol}`} />
                    <SummaryRow label="Destination" value={getChainLabel(setup.targetChain)} />
                    <SummaryRow label="Amount to bridge" value={`${formatBridgeBalance(setup.deficit)} ${setup.symbol}`} />
                    {bridgeSources.length > 1 ? (
                      <p className="mt-2 text-[10px] leading-4 text-gray-500 dark:text-gray-400">
                        {bridgeSources.length} separate bridge transactions will
                        fund the destination network.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                No funding plan is available for these balances.
              </p>
            )}
          </section>

          {plan && (plan.insufficientBalances || shortfall > 0) ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-3 text-xs font-medium text-red-600 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Insufficient total balance. Short by {formatBridgeBalance(shortfall)} {setup.symbol}.
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() =>
              view === "plan" ? setView("review") : void executeFundingPlan()
            }
            disabled={!canExecute || isLoadingPlan || isSubmitting}
            className="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-50 to-primary-70 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="h-4 w-4" />
            )}
            {view === "review" ? "Initiate bridge" : "Review funding plan"}
          </button>
        </>
      )}
    </div>
  ) : null

  const verificationModal = (
    <TransferVerificationModal
      isOpen={Boolean(verification)}
      isSubmitting={isSubmitting}
      verificationType={verification?.verificationType || "email_otp"}
      availableMethods={verification?.availableMethods}
      selectedMethod={verification?.selectedMethod}
      onMethodChange={(method) =>
        setVerification((current) =>
          current
            ? {
                ...current,
                selectedMethod: method,
                verificationType: getVerificationTypeForMethod(method),
                otpSent: method === "totp",
              }
            : current,
        )
      }
      otpSent={verification?.otpSent}
      onResend={() =>
        verification ? void requestOtp(verification.selectedMethod) : undefined
      }
      isResending={isResending}
      onClose={() => setVerification(null)}
      onSubmit={(code) => void executeFundingPlan(code)}
    />
  )

  if (isDesktop) {
    return (
      <>
        <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
          <DialogContent
            showCloseButton={false}
            className="w-full overflow-hidden rounded-[28px] border-black/10 bg-white p-0 sm:max-w-2xl dark:border-white/10 dark:bg-cryptoNight"
          >
            <DialogTitle className="sr-only">Bridge and fund wallet</DialogTitle>
            <DialogDescription className="sr-only">
              Combine balances from other networks to fund this transaction.
            </DialogDescription>
            {content}
          </DialogContent>
        </Dialog>
        {verificationModal}
      </>
    )
  }

  return (
    <>
      <Drawer open={Boolean(request)} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh] rounded-t-[28px] border-white/10 bg-white dark:bg-cryptoNight">
          <DrawerTitle className="sr-only">Bridge and fund wallet</DrawerTitle>
          <DrawerDescription className="sr-only">
            Combine balances from other networks to fund this transaction.
          </DrawerDescription>
          <div className="overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
      {verificationModal}
    </>
  )
}

function AllocationRow({
  chain,
  amount,
  symbol,
  label = "Bridge",
}: {
  chain: string
  amount: number
  symbol: BridgeSymbol
  label?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2.5">
      <ChainIcon name={chain} size={24} className="!h-6 !w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-black dark:text-white">
          {getChainLabel(chain)}
        </p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="shrink-0 text-xs font-bold text-black dark:text-white">
        {formatBridgeBalance(amount)} {symbol}
      </p>
    </div>
  )
}

function SourceExecutionRow({
  chain,
  execution,
  symbol,
}: {
  chain: string
  execution: FundingSourceExecution
  symbol: BridgeSymbol
}) {
  const statusLabel: Record<FundingSourceStatus, string> = {
    planned: "Ready",
    signing: "Awaiting signature",
    submitted: "Submitted",
    completed: "Completed",
    attention: "Needs attention",
  }

  const statusClass: Record<FundingSourceStatus, string> = {
    planned: "text-gray-500 dark:text-gray-400",
    signing: "text-primary-60",
    submitted: "text-amber-600 dark:text-amber-300",
    completed: "text-emerald-600 dark:text-emerald-300",
    attention: "text-red-600 dark:text-red-300",
  }

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-secondary-50/70">
      <ChainIcon name={chain} size={24} className="!h-6 !w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-black dark:text-white">
          {getChainLabel(chain)}
        </p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          {formatBridgeBalance(execution.amount)} {symbol}
        </p>
      </div>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 text-[10px] font-semibold",
          statusClass[execution.status],
        )}
      >
        {execution.status === "signing" || execution.status === "submitted" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : execution.status === "completed" ? (
          <Check className="h-3.5 w-3.5" />
        ) : execution.status === "attention" ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : null}
        {statusLabel[execution.status]}
      </span>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-xs">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-semibold text-black dark:text-white">
        {value}
      </span>
    </div>
  )
}

function getCompactChainLabel(chain: string): string {
  return getChainLabel(chain)
    .replace(/ Smart Chain Network$/i, "")
    .replace(/ Network$/i, "")
}
