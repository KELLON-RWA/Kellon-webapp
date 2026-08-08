"use client"

import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  findTransferVerificationRequiredError,
  getAvailableVerificationMethods,
  getOtpChannelForMethod,
  getVerificationTypeForMethod,
  resolveVerificationMethod,
  transferService,
  type VerificationMethod,
} from "@/services/api/transfers"
import { useWallets } from "@privy-io/react-auth"
import {
  useWallets as useSolanaWallets,
  useSignTransaction as useSolanaSignTransaction,
} from "@privy-io/react-auth/solana"
import {
  useSmartAccount,
  setStickyVerificationCode,
  setStickyTransferMeta,
} from "@/hooks/useSmartAccount"
import { getActiveChains } from "@/lib/chains"
import { beginOperation, endOperation } from "@/services/api"
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  type Address,
} from "viem"
import type { Asset, User } from "@/types/db"
import type {
  AmountFormValues,
  RecipientFormValues,
  SendableAsset,
  SendStep,
  VerifiedRecipient,
} from "./send-types"
import {
  ASSET_NAMES,
  SEND_STEPS,
  amountSchema,
  getRecentRecipient,
  getRecipientKind,
  isSupportedRecipient,
  parseAssetAmount,
  recipientSchema,
} from "./send-utils"

// ─── Navigation Reducer ────────────────────────────────────────────────────────
// Owns the three URL-synced pieces of navigation state: step, selectedAssetId,
// and amount. All async / ephemeral state (recipient verification, submission)
// lives in separate useState calls below, keeping concerns cleanly separated.

type NavState = {
  step: SendStep
  selectedAssetId: string
  amount: string
}

type NavAction =
  | { type: "SET_STEP"; step: SendStep }
  | { type: "SET_ASSET_ID"; assetId: string }
  | { type: "SET_AMOUNT"; amount: string }
  | { type: "RESET_FOR_RECIPIENT" }
  | {
      type: "SYNC_FROM_URL"
      params: URLSearchParams
      sendableAssets: SendableAsset[]
    }

type EvmSmartAccountClient = {
  account: unknown
  chain: unknown
  sendTransaction(args: {
    account: unknown
    chain: unknown
    to: `0x${string}`
    data: `0x${string}`
    value: bigint
  }): Promise<string>
}

function decodeRevertReason(hex: string): string | null {
  if (!hex.startsWith("0x08c379a0")) return null
  try {
    const data = hex.slice(10)
    const offset = parseInt(data.slice(0, 64), 16)
    const length = parseInt(data.slice(offset * 2, offset * 2 + 64), 16)
    const msgHex = data.slice(offset * 2 + 64, offset * 2 + 64 + length * 2)
    let result = ""
    for (let i = 0; i < msgHex.length; i += 2) {
      result += String.fromCharCode(parseInt(msgHex.slice(i, i + 2), 16))
    }
    return result
  } catch {
    return null
  }
}

function extractRevertFromError(err: unknown): string | null {
  if (!(err instanceof Error)) return null
  const msg = err.message || ""
  const hexMatch = msg.match(/0x08c379a0[0-9a-fA-F]+/)
  if (hexMatch) return decodeRevertReason(hexMatch[0])
  const details = (err as Error & { details?: string }).details
  if (details) {
    const detailMatch = details.match(/0x08c379a0[0-9a-fA-F]+/)
    if (detailMatch) return decodeRevertReason(detailMatch[0])
  }
  return null
}

const BALANCE_CHECK_RPC: Record<string, string> = {
  base: "https://mainnet.base.org",
  celo: "https://forno.celo.org",
  polygon: "https://polygon-rpc.com",
  bnb: "https://bsc-dataseed.binance.org",
  bsc: "https://bsc-dataseed.binance.org",
}

async function verifyOnChainBalance(
  chainKey: string,
  tokenAddress: string,
  accountAddress: string,
  requiredAmount: bigint,
  symbol: string,
  decimals: number,
): Promise<void> {
  const rpcUrl = BALANCE_CHECK_RPC[chainKey]
  if (!rpcUrl) return
  const client = createPublicClient({ transport: http(rpcUrl) })
  const balance = await client.readContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [accountAddress as Address],
  })
  if ((balance as bigint) < requiredAmount) {
    const available = formatUnits(balance as bigint, decimals)
    const required = formatUnits(requiredAmount, decimals)
    throw new Error(
      `Insufficient ${symbol} balance. You have ${available} ${symbol} but tried to send ${required} ${symbol}.`,
    )
  }
}

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "SET_STEP":
      return action.step === state.step
        ? state
        : { ...state, step: action.step }

    case "SET_ASSET_ID":
      return action.assetId === state.selectedAssetId
        ? state
        : { ...state, selectedAssetId: action.assetId }

    case "SET_AMOUNT":
      return action.amount === state.amount
        ? state
        : { ...state, amount: action.amount }

    // Called when the user changes the recipient input — clears all downstream
    // navigation state and resets to the first step.
    case "RESET_FOR_RECIPIENT":
      if (
        state.step === "recipient" &&
        state.selectedAssetId === "" &&
        state.amount === ""
      )
        return state
      return { step: "recipient", selectedAssetId: "", amount: "" }

    // Single atomic URL → state sync. Replaces the four competing useEffects
    // in the original implementation. Does a shallow diff and returns the same
    // state reference if nothing changed to prevent unnecessary re-renders.
    case "SYNC_FROM_URL": {
      const rawStep = action.params.get("step") as SendStep | null
      const nextStep =
        rawStep && SEND_STEPS.includes(rawStep) ? rawStep : state.step

      // Clear asset / amount when navigating back to recipient step.
      const nextAmount =
        nextStep === "recipient" ? "" : action.params.get("amount") || ""

      let nextAssetId = nextStep === "recipient" ? "" : state.selectedAssetId

      if (nextStep !== "recipient") {
        const urlSymbol = action.params.get("asset")?.toUpperCase() || ""
        const urlChain = action.params.get("network")?.toLowerCase() || ""
        if (urlSymbol || urlChain) {
          const matched = action.sendableAssets.find((a) => {
            if (urlSymbol && a.symbol !== urlSymbol) return false
            if (urlChain && a.chain.toLowerCase() !== urlChain) return false
            return Boolean(urlSymbol || urlChain)
          })
          if (matched) nextAssetId = matched.key
        }
      }

      // Bail out early – same reference means no downstream re-renders.
      if (
        nextStep === state.step &&
        nextAssetId === state.selectedAssetId &&
        nextAmount === state.amount
      )
        return state

      return {
        step: nextStep,
        selectedAssetId: nextAssetId,
        amount: nextAmount,
      }
    }

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSendFlow(profile: User) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { wallets, ready: walletsReady } = useWallets()
  const { wallets: solanaWallets, ready: solanaWalletsReady } =
    useSolanaWallets()
  const { signTransaction: signSolanaTransaction } = useSolanaSignTransaction()
  const { getSmartAccountClient } = useSmartAccount()

  // ── Forms ──────────────────────────────────────────────────────────────────
  const recipientForm = useForm<RecipientFormValues>({
    resolver: zodResolver(recipientSchema),
    defaultValues: { recipient: searchParams.get("recipient") || "" },
    mode: "onChange",
  })

  const amountForm = useForm<AmountFormValues>({
    resolver: zodResolver(amountSchema),
    defaultValues: { amount: searchParams.get("amount") || "" },
    mode: "onChange",
  })

  // ── Sendable assets (derived from profile) ─────────────────────────────────
  const sendableAssets = useMemo<SendableAsset[]>(() => {
    return (profile.assets || [])
      .filter((asset): asset is Asset => Boolean(asset?.symbol && asset?.chain))
      .map((asset) => {
        const symbol = asset.symbol.toUpperCase()
        const chain = asset.chain || ""
        return {
          id: asset.id,
          key: [asset.id, symbol, chain].filter(Boolean).join(":"),
          symbol,
          name: ASSET_NAMES[symbol] || symbol,
          amount: parseAssetAmount(asset.amount),
          chain,
          assetType: asset.assetType,
        }
      })
      .filter(
        (asset) => asset.amount > 0 && ["USDC", "USDT"].includes(asset.symbol),
      )
      .sort((a, b) => {
        if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol)
        return a.chain.localeCompare(b.chain)
      })
  }, [profile.assets])

  // ── Navigation reducer (initialised once from URL on mount) ───────────────
  const initialNavState = useMemo<NavState>(() => {
    const rawStep = searchParams.get("step") as SendStep | null
    const step = rawStep && SEND_STEPS.includes(rawStep) ? rawStep : "recipient"
    const amount = searchParams.get("amount") || ""
    const urlSymbol = searchParams.get("asset")?.toUpperCase() || ""
    const urlChain = searchParams.get("network")?.toLowerCase() || ""
    let selectedAssetId = ""
    if (urlSymbol || urlChain) {
      const matched = sendableAssets.find((a) => {
        if (urlSymbol && a.symbol !== urlSymbol) return false
        if (urlChain && a.chain.toLowerCase() !== urlChain) return false
        return true
      })
      if (matched) selectedAssetId = matched.key
    }
    return { step, selectedAssetId, amount }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [nav, dispatch] = useReducer(navReducer, initialNavState)

  // ── Single URL sync effect ─────────────────────────────────────────────────
  // Replaces the four competing useEffects in the original. One atomic dispatch
  // keeps step, selectedAssetId, and amount consistent with the URL at all
  // times — including browser back/forward navigation.
  useEffect(() => {
    dispatch({ type: "SYNC_FROM_URL", params: searchParams, sendableAssets })
  }, [searchParams, sendableAssets])

  // ── Async / ephemeral state ────────────────────────────────────────────────
  const [recipientInput, setRecipientInput] = useState(
    () => searchParams.get("recipient") || "",
  )
  const [verifiedRecipient, setVerifiedRecipient] =
    useState<VerifiedRecipient | null>(null)
  const [verifiedRecipientInput, setVerifiedRecipientInput] = useState("")
  const [isVerifyingRecipient, setIsVerifyingRecipient] = useState(false)
  const [recipientLookupMessage, setRecipientLookupMessage] = useState("")
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [verificationRequest, setVerificationRequest] = useState<{
    verificationType: "otp" | "totp"
    availableMethods: VerificationMethod[]
    selectedMethod: VerificationMethod
    action?: string
    otpSent: boolean
  } | null>(null)

  // ── Derived values ─────────────────────────────────────────────────────────
  const { step, selectedAssetId, amount } = nav

  const selectedAsset = useMemo(
    () =>
      selectedAssetId
        ? (sendableAssets.find((a) => a.key === selectedAssetId) ?? null)
        : null,
    [selectedAssetId, sendableAssets],
  )

  const recipientKind = getRecipientKind(recipientInput)
  const isRecipientValid = isSupportedRecipient(recipientKind)
  const normalizedRecipient = recipientInput.trim()
  const normalizedRecipientKey = normalizedRecipient.toLowerCase()
  const amountValue = Number(amount)
  const isAmountValid =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Boolean(selectedAsset) &&
    amountValue <= (selectedAsset?.amount ?? 0)
  const isCurrentRecipientVerified =
    Boolean(verifiedRecipient) &&
    verifiedRecipientInput === normalizedRecipientKey

  // ── URL helper (memoised — was recreated on every render in original) ─────
  const updateUrl = useCallback(
    (
      updates: Record<string, string | null>,
      options: { replace?: boolean } = {},
    ) => {
      const params = new URLSearchParams(searchParams.toString())
      let changed = false

      Object.entries(updates).forEach(([key, value]) => {
        const current = params.get(key)
        if (value === null && current !== null) {
          params.delete(key)
          changed = true
        } else if (value !== null && current !== value) {
          params.set(key, value)
          changed = true
        }
      })

      if (!changed) return
      const query = params.toString()
      const nextUrl = query ? `${pathname}?${query}` : pathname
      if (options.replace) router.replace(nextUrl, { scroll: false })
      else router.push(nextUrl, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  // ── Self-recipient detection ───────────────────────────────────────────────
  const chainAccountIdentifiers = useMemo(
    () =>
      (profile.chainAccounts || [])
        .flatMap((account) => [
          account.publicKey || "",
          account.smartAccountAddress || "",
        ])
        .filter(Boolean)
        .join("|"),
    [profile.chainAccounts],
  )

  const profileWithUsername = profile as User & { username?: string | null }

  const selfIdentifiers = useMemo(() => {
    const ids = new Set<string>()
    if (profile.id) ids.add(profile.id.toLowerCase())
    if (profile.email) ids.add(profile.email.toLowerCase())
    if (profileWithUsername.username) {
      ids.add(profileWithUsername.username.toLowerCase())
      ids.add(
        `@${profileWithUsername.username.replace(/^@/, "")}`.toLowerCase(),
      )
    }
    if (profile.tag) {
      ids.add(profile.tag.toLowerCase())
      ids.add(`@${profile.tag.replace(/^@/, "")}`.toLowerCase())
    }
    chainAccountIdentifiers
      .split("|")
      .forEach((id) => id && ids.add(id.toLowerCase()))
    return ids
  }, [
    chainAccountIdentifiers,
    profile.email,
    profile.id,
    profile.tag,
    profileWithUsername.username,
  ])

  const isSelfRecipient = useCallback(
    (value: string) => selfIdentifiers.has(value.trim().toLowerCase()),
    [selfIdentifiers],
  )

  const selfRecipientError =
    normalizedRecipient && isSelfRecipient(normalizedRecipient)
      ? "You can't send to yourself. Choose another recipient."
      : null

  // ── Recipient debounce lookup ──────────────────────────────────────────────
  // Scoped purely to async recipient state. Never touches nav state — that is
  // the key separation that eliminates the original re-render cascade.
  useEffect(() => {
    const recipient = normalizedRecipient
    const recipientKey = normalizedRecipientKey
    const kind = getRecipientKind(recipient)

    if (verifiedRecipient && verifiedRecipientInput === recipientKey) return

    setVerifiedRecipient(null)
    setVerifiedRecipientInput("")

    if (!recipient) {
      setRecipientLookupMessage("")
      return
    }

    if (isSelfRecipient(recipient)) {
      const message = "You can't send to yourself. Choose another recipient."
      setRecipientLookupMessage(message)
      recipientForm.setError("recipient", { message })
      return
    }

    if (!isSupportedRecipient(kind)) {
      setRecipientLookupMessage(
        "Enter a valid email, username, @tag, EVM address, or Stellar address.",
      )
      return
    }

    if (kind === "evm" || kind === "stellar") {
      setVerifiedRecipient({ id: recipient, identifier: recipient })
      setVerifiedRecipientInput(recipientKey)
      setRecipientLookupMessage("Wallet address will be used as entered.")
      recipientForm.clearErrors("recipient")
      return
    }

    setRecipientLookupMessage("Checking Kellon user...")
    setIsVerifyingRecipient(true)

    const timeoutId = window.setTimeout(async () => {
      try {
        const lookupValue =
          kind === "tag" ? recipient.replace(/^@/, "") : recipient.toLowerCase()
        const response = await transferService.verifyRecipient(lookupValue)
        const recipientUser = response.data

        if (!recipientUser?.found) {
          const message = "No Kellon user found for this recipient."
          setRecipientLookupMessage(message)
          recipientForm.setError("recipient", { message })
          return
        }

        setVerifiedRecipient({
          id: lookupValue,
          name: recipientUser.name,
          addresses: recipientUser.addresses,
          identifier: recipient,
        })
        setVerifiedRecipientInput(recipientKey)
        setRecipientLookupMessage(
          recipientUser.name
            ? `Verified as ${recipientUser.name}`
            : "Kellon recipient verified",
        )
        recipientForm.clearErrors("recipient")
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to verify recipient."
        setRecipientLookupMessage(message)
        recipientForm.setError("recipient", { message })
      } finally {
        setIsVerifyingRecipient(false)
      }
    }, 450)

    return () => {
      window.clearTimeout(timeoutId)
      setIsVerifyingRecipient(false)
    }
  }, [
    isSelfRecipient,
    normalizedRecipient,
    normalizedRecipientKey,
    recipientForm,
    verifiedRecipient,
    verifiedRecipientInput,
  ])

  // ── Action creators ────────────────────────────────────────────────────────

  const updateUrl_Step = useCallback(
    (nextStep: SendStep, asset?: SendableAsset | null) => {
      if (nextStep === "recipient") {
        updateUrl({
          step: nextStep,
          recipient: null,
          asset: null,
          network: null,
          amount: null,
        })
      } else {
        updateUrl({
          step: nextStep,
          recipient: recipientInput || null,
          asset: asset?.symbol ?? null,
          network: asset?.chain ?? null,
          amount: nav.amount || null,
        })
      }
    },
    [updateUrl, nav.amount, recipientInput],
  )

  // Internal helper: navigate to asset step, optionally pre-selecting an asset.
  const enterAssetStep = useCallback(
    (assetOverride?: SendableAsset | null) => {
      const target = assetOverride ?? selectedAsset ?? sendableAssets[0] ?? null
      if (target) dispatch({ type: "SET_ASSET_ID", assetId: target.key })
      dispatch({ type: "SET_STEP", step: "asset" })
      updateUrl_Step("asset", target)
    },
    [selectedAsset, sendableAssets, updateUrl_Step],
  )

  // Public step setter — mirrors updateStep from the original but is now a
  // stable useCallback to avoid stale closure issues downstream.
  const updateStep = useCallback(
    (nextStep: SendStep, assetOverride?: SendableAsset | null) => {
      const assetForUrl = assetOverride ?? selectedAsset ?? sendableAssets[0]
      dispatch({ type: "SET_STEP", step: nextStep })
      updateUrl_Step(nextStep, assetForUrl)
    },
    [selectedAsset, sendableAssets, updateUrl_Step],
  )

  const setSelectedAssetIdAction = useCallback(
    (assetId: string) => {
      dispatch({ type: "SET_ASSET_ID", assetId })
      const nextAsset = sendableAssets.find((a) => a.key === assetId)
      if (nextAsset) {
        updateUrl(
          { asset: nextAsset.symbol, network: nextAsset.chain },
          { replace: true },
        )
      }
    },
    [sendableAssets, updateUrl],
  )

  const setAmountValue = useCallback(
    (value: string) => {
      dispatch({ type: "SET_AMOUNT", amount: value })
      updateUrl({ amount: value || null }, { replace: true })
      amountForm.setValue("amount", value, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
    },
    [amountForm, updateUrl],
  )

  const handleAmountKeypadPress = useCallback(
    (value: string) => {
      const current = amountForm.getValues("amount")
      if (value === "delete") {
        setAmountValue(current.slice(0, -1))
        return
      }
      if (value === "." && current.includes(".")) return
      if (current === "0" && value !== ".") {
        setAmountValue(value)
        return
      }
      setAmountValue(`${current}${value}`)
    },
    [amountForm, setAmountValue],
  )

  const handleRecipientChange = useCallback(
    (nextRecipient: string) => {
      setRecipientInput(nextRecipient)
      if (nextRecipient.trim().toLowerCase() !== verifiedRecipientInput) {
        setVerifiedRecipient(null)
        setVerifiedRecipientInput("")
      }
      // Reset all downstream nav state atomically.
      dispatch({ type: "RESET_FOR_RECIPIENT" })
      amountForm.setValue("amount", "", {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
      updateUrl(
        {
          recipient: nextRecipient.trim() || null,
          step: "recipient",
          asset: null,
          network: null,
          amount: null,
        },
        { replace: true },
      )

      if (isSelfRecipient(nextRecipient)) {
        recipientForm.setError("recipient", {
          message: "You can't send to yourself. Choose another recipient.",
        })
      } else {
        recipientForm.clearErrors("recipient")
        void recipientForm.trigger("recipient")
      }
    },
    [
      amountForm,
      isSelfRecipient,
      recipientForm,
      updateUrl,
      verifiedRecipientInput,
    ],
  )

  const selectRecentRecipient = useCallback(
    (nextRecipient: string) => {
      setRecipientInput(nextRecipient)
      recipientForm.setValue("recipient", nextRecipient, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      if (nextRecipient.trim().toLowerCase() !== verifiedRecipientInput) {
        setVerifiedRecipient(null)
        setVerifiedRecipientInput("")
      }
      dispatch({ type: "RESET_FOR_RECIPIENT" })
      amountForm.setValue("amount", "", {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      })
      updateUrl(
        {
          recipient: nextRecipient.trim() || null,
          step: "recipient",
          asset: null,
          network: null,
          amount: null,
        },
        { replace: true },
      )
    },
    [amountForm, recipientForm, updateUrl, verifiedRecipientInput],
  )

  const verifyRecipient = useCallback(
    async (values: RecipientFormValues) => {
      const recipient = values.recipient.trim()
      const kind = getRecipientKind(recipient)

      if (isSelfRecipient(recipient)) {
        recipientForm.setError("recipient", {
          message: "You can't send to yourself. Choose another recipient.",
        })
        return
      }

      if (isCurrentRecipientVerified) {
        enterAssetStep()
        return
      }

      if (kind !== "email" && kind !== "tag") {
        setVerifiedRecipient({ id: recipient, identifier: recipient })
        setVerifiedRecipientInput(recipient.toLowerCase())
        enterAssetStep()
        return
      }

      setIsVerifyingRecipient(true)
      try {
        const lookupValue =
          kind === "tag" ? recipient.replace(/^@/, "") : recipient.toLowerCase()
        const response = await transferService.verifyRecipient(lookupValue)
        const recipientUser = response.data

        if (!recipientUser?.found) throw new Error("Recipient not found.")

        if (isSelfRecipient(recipient)) {
          recipientForm.setError("recipient", {
            message: "You can't send to yourself. Choose another recipient.",
          })
          return
        }

        setVerifiedRecipient({
          id: lookupValue,
          name: recipientUser.name,
          addresses: recipientUser.addresses,
          identifier: recipient,
        })
        setVerifiedRecipientInput(recipient.toLowerCase())
        enterAssetStep()
      } catch (error) {
        recipientForm.setError("recipient", {
          message:
            error instanceof Error
              ? error.message
              : "Unable to verify recipient.",
        })
      } finally {
        setIsVerifyingRecipient(false)
      }
    },
    [
      enterAssetStep,
      isCurrentRecipientVerified,
      isSelfRecipient,
      recipientForm,
    ],
  )

  const goBack = useCallback(() => {
    if (step === "recipient") {
      router.back()
      return
    }
    const currentIndex = SEND_STEPS.indexOf(step)
    updateStep(SEND_STEPS[Math.max(0, currentIndex - 1)])
  }, [router, step, updateStep])

  const goNext = useCallback(() => {
    if (step === "recipient") {
      void recipientForm.handleSubmit(verifyRecipient)()
      return
    }
    if (step === "asset" && selectedAsset) {
      updateStep("amount")
      return
    }
    if (step === "amount") {
      void amountForm.handleSubmit(() => {
        if (isAmountValid) updateStep("review")
      })()
    }
  }, [
    amountForm,
    isAmountValid,
    recipientForm,
    selectedAsset,
    step,
    updateStep,
    verifyRecipient,
  ])

  // ── Recent recipients ──────────────────────────────────────────────────────
  const recentRecipients = useMemo(() => {
    const seen = new Set<string>()
    return (profile.transactions || [])
      .filter((tx) => ["TRANSFER_OUT", "TRANSFER_IN"].includes(tx.type))
      .map(getRecentRecipient)
      .filter((r): r is { value: string; method: string } => Boolean(r?.value))
      .filter((r) => {
        const key = r.value.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 5)
  }, [profile.transactions])

  // ── Transfer execution ─────────────────────────────────────────────────────
  const executeTransfer = useCallback(
    async (verification?: {
      verificationCode: string
      verificationType: "otp" | "totp"
      verificationMethod: VerificationMethod
    }) => {
      if (
        !selectedAsset ||
        !isAmountValid ||
        !isRecipientValid ||
        !isCurrentRecipientVerified ||
        !verifiedRecipient
      )
        return

      setIsSubmitting(true)
      // One key for the whole send intent, so the post-MFA retry replays the same
      // transfer rather than creating a second one.
      beginOperation(Boolean(verification))
      try {
        const trimmedRecipient = recipientInput.trim()
        const chainLower = selectedAsset.chain.toLowerCase()

        const transferPayload = {
          amount: amountValue,
          symbol: selectedAsset.symbol,
          verificationCode: verification?.verificationCode,
          verificationType: verification?.verificationType,
          toAddress:
            recipientKind === "evm" || recipientKind === "stellar"
              ? trimmedRecipient
              : undefined,
          recipientEmail:
            recipientKind === "email"
              ? trimmedRecipient.toLowerCase()
              : undefined,
          recipientTag:
            recipientKind === "tag"
              ? trimmedRecipient.replace(/^@/, "")
              : undefined,
        }

        let response
        if (chainLower === "stellar") {
          response = await transferService.transferStellar(transferPayload)
        } else if (chainLower === "solana") {
          const prepRes = await transferService.prepareSolanaSponsored({
            amount: amountValue,
            symbol: selectedAsset.symbol,
            toAddress:
              recipientKind !== "email" && recipientKind !== "tag"
                ? trimmedRecipient
                : undefined,
            recipientEmail:
              recipientKind === "email"
                ? trimmedRecipient.toLowerCase()
                : undefined,
            recipientTag:
              recipientKind === "tag"
                ? trimmedRecipient.replace(/^@/, "")
                : undefined,
          })

          if (!prepRes.success || !prepRes.data) {
            throw new Error(
              prepRes.message || "Failed to prepare Solana transaction",
            )
          }

          const { serializedTx, destinationAddress } = prepRes.data

          if (!solanaWalletsReady) {
            throw new Error(
              "Solana wallet is still loading. Please try again in a moment.",
            )
          }

          const solanaWallet = solanaWallets[0]

          if (!solanaWallet) {
            throw new Error(
              "Solana wallet not found. Please connect your Solana wallet via Privy.",
            )
          }

          const binaryString = atob(serializedTx)
          const len = binaryString.length
          const txBytes = new Uint8Array(len)
          for (let i = 0; i < len; i++) {
            txBytes[i] = binaryString.charCodeAt(i)
          }

          const signResult = await signSolanaTransaction({
            transaction: txBytes,
            wallet: solanaWallet,
          })

          const signedTxBytes = signResult.signedTransaction

          if (!signedTxBytes) {
            throw new Error("Transaction signing was rejected or failed.")
          }

          let binary = ""
          const signedLen = signedTxBytes.byteLength
          for (let i = 0; i < signedLen; i++) {
            binary += String.fromCharCode(signedTxBytes[i])
          }
          const signedTxBase64 = btoa(binary)

          response = await transferService.submitSolanaSponsored({
            amount: amountValue,
            symbol: selectedAsset.symbol,
            toAddress: destinationAddress,
            signedTxBase64,
            verificationCode: verification?.verificationCode,
            verificationType: verification?.verificationType,
          })
        } else {
          // Privy is still hydrating; `wallets` is [] until it settles, so a click
          // straight after page load would otherwise read as "no wallet".
          if (!walletsReady) {
            throw new Error(
              "Wallet is still loading. Please try again in a moment.",
            )
          }

          // Must be the Privy embedded wallet specifically. External wallets are not
          // disabled in PrivyProvider, so a user with a browser extension can have one in
          // this list — and picking it by address prefix alone derives the smart account
          // from the wrong owner EOA, pointing at a Safe that holds none of their funds.
          const evmWallet = wallets.find(
            (w) => w.walletClientType === "privy" && w.address.startsWith("0x"),
          )

          if (!evmWallet) {
            throw new Error(
              "Embedded wallet not found. Please log out and log in again.",
            )
          }

          const smartAccountClient = await getSmartAccountClient(
            evmWallet,
            chainLower,
          )
          if (!smartAccountClient) {
            throw new Error("Failed to initialize smart account client.")
          }

          let destinationAddress = trimmedRecipient
          if (recipientKind === "email" || recipientKind === "tag") {
            const resolvedAddr =
              verifiedRecipient?.addresses?.smartAccounts?.[chainLower] ||
              verifiedRecipient?.addresses?.evm
            if (!resolvedAddr) {
              throw new Error(
                `The recipient has not set up a wallet on ${selectedAsset.chain} yet.`,
              )
            }
            destinationAddress = resolvedAddr
          }

          const activeChains = getActiveChains()
          const chainConfig =
            activeChains[chainLower as keyof typeof activeChains]
          if (!chainConfig) {
            throw new Error(`Unsupported EVM chain: ${selectedAsset.chain}`)
          }

          const tokenSymbol = selectedAsset.symbol.toUpperCase()
          const tokenAddress =
            tokenSymbol === "USDC"
              ? chainConfig.usdcAddress
              : chainConfig.usdtAddress

          if (!tokenAddress) {
            throw new Error(
              `Token ${tokenSymbol} not supported on ${selectedAsset.chain}`,
            )
          }

          const isBsc = chainConfig.id === 56 || chainConfig.id === 97
          const decimals = isBsc ? 18 : 6
          const amountBigInt = BigInt(Math.round(amountValue * 10 ** decimals))

          const safeAddr = (smartAccountClient.account as { address?: string })
            ?.address
          if (safeAddr) {
            await verifyOnChainBalance(
              chainLower,
              tokenAddress,
              safeAddr,
              amountBigInt,
              tokenSymbol,
              decimals,
            )
          }

          const txData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [destinationAddress as `0x${string}`, amountBigInt],
          })

          if (
            verification?.verificationCode &&
            verification?.verificationType
          ) {
            setStickyVerificationCode({
              type: verification.verificationMethod,
              code: verification.verificationCode,
            })
          } else {
            setStickyVerificationCode(null)
          }
          setStickyTransferMeta({
            amount: amountValue,
            symbol: selectedAsset.symbol,
            toAddress: destinationAddress,
          })

          try {
            const txHash = await (
              smartAccountClient as unknown as EvmSmartAccountClient
            ).sendTransaction({
              account: smartAccountClient.account,
              chain: smartAccountClient.chain,
              to: tokenAddress as `0x${string}`,
              data: txData,
              value: 0n,
            })
            setStickyVerificationCode(null)
            setStickyTransferMeta(null)
            response = {
              success: true,
              data: {
                hash: txHash,
                message: "Transfer completed successfully",
              },
            }
          } catch (err) {
            setStickyVerificationCode(null)
            setStickyTransferMeta(null)
            const revertReason = extractRevertFromError(err)
            if (revertReason) {
              const lower = revertReason.toLowerCase()
              if (
                lower.includes("exceeds balance") ||
                lower.includes("insufficient")
              ) {
                throw new Error(
                  `Insufficient ${selectedAsset.symbol} balance to complete this transfer.`,
                )
              }
              throw new Error(revertReason)
            }
            throw err
          }
        }

        setVerificationRequest(null)
        endOperation()
        toast.success(
          response.data?.message || "Transfer completed successfully",
        )
        router.push("/transactions")
      } catch (error) {
        const verificationError = findTransferVerificationRequiredError(error)
        if (verificationError) {
          const availableMethods = getAvailableVerificationMethods(
            verificationError.availableMethods,
            verificationError.verificationType,
          )
          const selectedMethod = resolveVerificationMethod(
            availableMethods,
            verificationError.verificationType,
          )
          setVerificationRequest({
            verificationType: getVerificationTypeForMethod(selectedMethod),
            availableMethods,
            selectedMethod,
            action: verificationError.action,
            // The backend sends the preferred OTP as part of the initial challenge.
            otpSent: selectedMethod !== "totp",
          })

          if (selectedMethod !== "totp") {
            toast.info(
              selectedMethod === "sms_otp"
                ? "We sent a verification code to your phone. Enter it to continue."
                : "We sent a verification code to your email. Enter it to continue.",
            )
          } else {
            toast.info("Enter your authenticator code to continue.")
          }
          return
        }
        endOperation()
        toast.error(
          error instanceof Error ? error.message : "Unable to process transfer",
        )
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      amountValue,
      getSmartAccountClient,
      isAmountValid,
      isCurrentRecipientVerified,
      isRecipientValid,
      recipientInput,
      recipientKind,
      router,
      selectedAsset,
      signSolanaTransaction,
      solanaWallets,
      solanaWalletsReady,
      verifiedRecipient,
      wallets,
      walletsReady,
    ],
  )

  const submitTransfer = useCallback(() => {
    void executeTransfer()
  }, [executeTransfer])

  const submitTransferVerification = useCallback(
    (verificationCode: string) => {
      if (!verificationRequest) return
      void executeTransfer({
        verificationCode,
        verificationType: getVerificationTypeForMethod(
          verificationRequest.selectedMethod,
        ),
        verificationMethod: verificationRequest.selectedMethod,
      })
    },
    [executeTransfer, verificationRequest],
  )

  const closeTransferVerification = useCallback(() => {
    if (isSubmitting) return
    setVerificationRequest(null)
    updateStep("review")
  }, [isSubmitting, updateStep])

  const requestTransferOtp = useCallback(
    async (method: VerificationMethod) => {
      const channel = getOtpChannelForMethod(method)
      if (!verificationRequest || !channel || isResendingVerification) return

      setIsResendingVerification(true)
      try {
        const response = await transferService.requestOTP(
          verificationRequest.action || "transfer",
          channel,
        )
        setVerificationRequest((current) =>
          current?.selectedMethod === method
            ? { ...current, otpSent: true }
            : current,
        )
        toast.success(
          response.message ||
            `Verification code sent by ${channel === "sms" ? "SMS" : "email"}.`,
        )
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to send verification code",
        )
      } finally {
        setIsResendingVerification(false)
      }
    },
    [isResendingVerification, verificationRequest],
  )

  const selectTransferVerificationMethod = useCallback(
    (method: VerificationMethod) => {
      if (!verificationRequest || method === verificationRequest.selectedMethod)
        return

      const channel = getOtpChannelForMethod(method)
      setVerificationRequest((current) =>
        current
          ? {
              ...current,
              selectedMethod: method,
              verificationType: getVerificationTypeForMethod(method),
              otpSent: channel === null,
            }
          : current,
      )
      if (channel) void requestTransferOtp(method)
    },
    [requestTransferOtp, verificationRequest],
  )

  const resendTransferVerification = useCallback(() => {
    if (verificationRequest) {
      void requestTransferOtp(verificationRequest.selectedMethod)
    }
  }, [requestTransferOtp, verificationRequest])

  // ── Computed UI state ──────────────────────────────────────────────────────
  const primaryButtonDisabled =
    (step === "recipient" &&
      (!isRecipientValid ||
        isVerifyingRecipient ||
        Boolean(selfRecipientError) ||
        !isCurrentRecipientVerified)) ||
    (step === "asset" && !selectedAsset) ||
    (step === "amount" && !isAmountValid) ||
    (step === "review" && isSubmitting)

  // ── Public API (identical surface to original hook) ───────────────────────
  return {
    amount,
    amountForm,
    amountValue,
    closeSend: () => router.push("/"),
    closeTransferVerification,
    goBack,
    goNext,
    handleAmountKeypadPress,
    handleRecipientChange,
    isAddFundsOpen,
    isAmountValid,
    isRecipientValid,
    selfRecipientError,
    isSubmitting,
    isResendingVerification,
    isVerifyingRecipient,
    primaryButtonDisabled,
    recentRecipients,
    recipientForm,
    recipientInput,
    recipientKind,
    recipientLookupMessage,
    verificationRequest,
    selectedAsset,
    selectRecentRecipient,
    sendableAssets,
    setAmount: setAmountValue,
    setIsAddFundsOpen,
    setRecipientInput: handleRecipientChange,
    setSelectedAssetId: setSelectedAssetIdAction,
    setStep: updateStep,
    step,
    submitTransfer,
    submitTransferVerification,
    selectTransferVerificationMethod,
    resendTransferVerification,
    verifiedRecipient,
    verifyRecipient,
  }
}
