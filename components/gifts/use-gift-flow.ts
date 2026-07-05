"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { useMediaQuery } from "@/hooks/use-media-query"
import { getChainLabel } from "@/lib/chains"
import { giftService } from "@/services/api/gifts"
import {
  transferService,
  type TransferRecipient,
} from "@/services/api/transfers"
import type { User } from "@/types/db"
import { giftFormSchema, type GiftFormValues } from "./gift-types"
import {
  GIFT_STEPS,
  GIFT_TEMPLATES,
  getGiftAssetOptions,
  getGiftSelfIdentifiers,
  isGiftRecipientEmail,
  isGiftRecipientTag,
  type GiftAssetOption,
  type GiftStep,
} from "./gift-utils"

type UrlUpdateOptions = {
  replace?: boolean
}

function isGiftStep(value: string | null): value is GiftStep {
  return Boolean(value && GIFT_STEPS.includes(value as GiftStep))
}

function getTemplateIdFromUrl(value: string | null): string {
  return GIFT_TEMPLATES.some((template) => template.id === value)
    ? value || "custom"
    : "custom"
}

function getAssetFromUrl(
  params: URLSearchParams,
  assets: GiftAssetOption[],
): GiftAssetOption | null {
  const urlAsset = params.get("asset")?.toUpperCase() || ""
  const urlNetwork = params.get("network")?.toLowerCase() || ""

  if (!urlAsset && !urlNetwork) return null

  return (
    assets.find((asset) => {
      if (urlAsset && asset.symbol !== urlAsset) return false
      if (urlNetwork && asset.chain.toLowerCase() !== urlNetwork) return false
      return true
    }) || null
  )
}

export function useGiftFlow(profile: User) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const previousSearchRef = useRef(searchParams.toString())

  const assets = useMemo(
    () => getGiftAssetOptions(profile.assets || []),
    [profile.assets],
  )

  const initialAssetKey = useMemo(() => {
    return getAssetFromUrl(searchParams, assets)?.key || assets[0]?.key || ""
    // Initial form values should be read once. URL changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets])

  const form = useForm<GiftFormValues>({
    resolver: zodResolver(giftFormSchema),
    mode: "onChange",
    defaultValues: {
      templateId: getTemplateIdFromUrl(searchParams.get("template")),
      assetKey: initialAssetKey,
      amount: searchParams.get("amount") || "",
      recipient: searchParams.get("recipient") || "",
      cardTitle: searchParams.get("title") || "",
      message: searchParams.get("message") || "",
    },
  })

  const [step, setStep] = useState<GiftStep>(() => {
    const urlStep = searchParams.get("step")
    return isGiftStep(urlStep) ? urlStep : "intro"
  })
  const stepRef = useRef(step)
  const [verifiedRecipient, setVerifiedRecipient] =
    useState<TransferRecipient | null>(null)
  const [verifiedRecipientInput, setVerifiedRecipientInput] = useState("")
  const [lookupMessage, setLookupMessage] = useState("")
  const [isVerifyingRecipient, setIsVerifyingRecipient] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [isExitOpen, setIsExitOpen] = useState(false)

  const selectedTemplateId = form.watch("templateId")
  const selectedAssetKey = form.watch("assetKey")
  const amount = form.watch("amount")
  const recipient = form.watch("recipient")
  const cardTitle = form.watch("cardTitle")
  const message = form.watch("message")

  const selectedTemplate =
    GIFT_TEMPLATES.find((template) => template.id === selectedTemplateId) ||
    GIFT_TEMPLATES[0]
  const selectedAsset =
    assets.find((asset) => asset.key === selectedAssetKey) || assets[0] || null
  const selectedSymbol = selectedAsset?.symbol || "USDC"
  const selectedChain = selectedAsset?.chain || "base"
  const amountValue = Number(amount)
  const normalizedRecipient = recipient.trim()
  const normalizedRecipientKey = normalizedRecipient.toLowerCase()
  const selfIdentifiers = useMemo(
    () => getGiftSelfIdentifiers(profile),
    [profile],
  )
  const isSelfRecipient =
    Boolean(normalizedRecipient) && selfIdentifiers.has(normalizedRecipientKey)
  const isEmailRecipient = isGiftRecipientEmail(normalizedRecipient)
  const isTagRecipient = isGiftRecipientTag(normalizedRecipient)
  const isRecipientFormatValid = isEmailRecipient || isTagRecipient
  const isRecipientVerified =
    Boolean(verifiedRecipient?.found) &&
    verifiedRecipientInput === normalizedRecipientKey
  const hasEnoughBalance =
    Boolean(selectedAsset) &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    amountValue <= (selectedAsset?.amount || 0)
  const canReview =
    Boolean(selectedAsset) &&
    hasEnoughBalance &&
    isRecipientFormatValid &&
    !isSelfRecipient &&
    isRecipientVerified &&
    form.formState.isValid
  const canSend = canReview && !isSending

  const indicatorSteps = isDesktop ? 2 : GIFT_STEPS.length - 1
  const indicatorCurrentStep = isDesktop
    ? step === "review"
      ? 1
      : 0
    : Math.max(0, GIFT_STEPS.indexOf(step) - 1)

  useEffect(() => {
    stepRef.current = step
  }, [step])

  const updateUrl = useCallback(
    (
      updates: Record<string, string | null>,
      options: UrlUpdateOptions = {},
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

  const updateUrlWithFormState = useCallback(
    (updates: Record<string, string | null>, options?: UrlUpdateOptions) => {
      const asset = selectedAsset

      updateUrl(
        {
          step,
          template: selectedTemplateId || "custom",
          asset: asset?.symbol || null,
          network: asset?.chain || null,
          amount: amount || null,
          recipient: normalizedRecipient || null,
          title: cardTitle.trim() || null,
          message: message.trim() || null,
          ...updates,
        },
        options,
      )
    },
    [
      amount,
      cardTitle,
      message,
      normalizedRecipient,
      selectedAsset,
      selectedTemplateId,
      step,
      updateUrl,
    ],
  )

  const updateStep = useCallback(
    (nextStep: GiftStep, options?: UrlUpdateOptions) => {
      const normalizedStep = isDesktop && nextStep === "details" ? "style" : nextStep
      setStep(normalizedStep)
      updateUrlWithFormState({ step: normalizedStep }, options)
    },
    [isDesktop, updateUrlWithFormState],
  )

  useEffect(() => {
    const currentSearch = searchParams.toString()
    const previousSearch = previousSearchRef.current
    const rawStep = searchParams.get("step")
    if (rawStep) {
      const urlStep = isGiftStep(rawStep) ? rawStep : "intro"
      const nextStep = isDesktop && urlStep === "details" ? "style" : urlStep

      if (stepRef.current !== nextStep) setStep(nextStep)
    } else if (previousSearch && !currentSearch && stepRef.current !== "intro") {
      setStep("intro")
    }

    const nextTemplateId = getTemplateIdFromUrl(searchParams.get("template"))
    if (form.getValues("templateId") !== nextTemplateId) {
      form.setValue("templateId", nextTemplateId, {
        shouldDirty: false,
        shouldValidate: true,
      })
    }

    const nextAssetKey =
      getAssetFromUrl(searchParams, assets)?.key || assets[0]?.key || ""
    if (nextAssetKey && form.getValues("assetKey") !== nextAssetKey) {
      form.setValue("assetKey", nextAssetKey, {
        shouldDirty: false,
        shouldValidate: true,
      })
    }

    const fields = [
      "amount",
      "recipient",
      "cardTitle",
      "message",
    ] as const
    const urlValues: Record<(typeof fields)[number], string> = {
      amount: searchParams.get("amount") || "",
      recipient: searchParams.get("recipient") || "",
      cardTitle: searchParams.get("title") || "",
      message: searchParams.get("message") || "",
    }

    fields.forEach((field) => {
      const nextValue = urlValues[field]
      if (form.getValues(field) !== nextValue) {
        form.setValue(field, nextValue, {
          shouldDirty: false,
          shouldValidate: true,
        })
      }
    })
    previousSearchRef.current = currentSearch
  }, [assets, form, isDesktop, searchParams])

  useEffect(() => {
    if (!selectedAssetKey && assets[0]?.key) {
      form.setValue("assetKey", assets[0].key, {
        shouldDirty: false,
        shouldValidate: true,
      })
    }
  }, [assets, form, selectedAssetKey])

  useEffect(() => {
    if (step === "intro") return

    updateUrlWithFormState({}, { replace: true })
  }, [
    amount,
    cardTitle,
    message,
    normalizedRecipient,
    selectedAsset?.chain,
    selectedAsset?.symbol,
    selectedTemplateId,
    step,
    updateUrlWithFormState,
  ])

  useEffect(() => {
    if (step !== "review") return
    if (!canReview || isVerifyingRecipient) {
      updateStep(isDesktop ? "style" : "details", { replace: true })
    }
  }, [canReview, isDesktop, isVerifyingRecipient, step, updateStep])

  useEffect(() => {
    const contact = normalizedRecipient
    const contactKey = normalizedRecipientKey

    setVerifiedRecipient(null)
    setVerifiedRecipientInput("")

    if (!contact) {
      setLookupMessage("")
      return
    }

    if (isSelfRecipient) {
      setLookupMessage("You can't send a gift to yourself.")
      return
    }

    if (!isRecipientFormatValid) {
      setLookupMessage("Enter a valid email or Kellon tag.")
      return
    }

    setLookupMessage("Checking Kellon user...")
    setIsVerifyingRecipient(true)

    const timeoutId = window.setTimeout(async () => {
      try {
        const lookupValue = isEmailRecipient
          ? contact.toLowerCase()
          : contact.replace(/^@/, "")
        const response = await transferService.verifyRecipient(lookupValue)
        const recipientUser = response.data

        if (!recipientUser?.found) {
          setLookupMessage("No Kellon user found for this contact.")
          return
        }

        setVerifiedRecipient(recipientUser)
        setVerifiedRecipientInput(contactKey)
        setLookupMessage(
          recipientUser.name
            ? `Verified as ${recipientUser.name}`
            : "Kellon recipient verified",
        )
      } catch (error) {
        setLookupMessage(
          error instanceof Error
            ? error.message
            : "Unable to verify recipient.",
        )
      } finally {
        setIsVerifyingRecipient(false)
      }
    }, 450)

    return () => {
      window.clearTimeout(timeoutId)
      setIsVerifyingRecipient(false)
    }
  }, [
    isEmailRecipient,
    isRecipientFormatValid,
    isSelfRecipient,
    normalizedRecipient,
    normalizedRecipientKey,
  ])

  const goBack = useCallback(() => {
    if (isDesktop && step === "review") {
      updateStep("style")
      return
    }

    const currentIndex = GIFT_STEPS.indexOf(step)
    if (currentIndex <= 0) {
      router.back()
      return
    }

    updateStep(GIFT_STEPS[currentIndex - 1])
  }, [isDesktop, router, step, updateStep])

  const closeFlow = useCallback(() => setIsExitOpen(true), [])
  const stayInFlow = useCallback(() => setIsExitOpen(false), [])
  const leaveFlow = useCallback(() => router.push("/"), [router])

  const handleAmountChange = useCallback(
    (value: string) => {
      const cleaned = value.replace(/[^\d.]/g, "")
      const [whole, decimal = ""] = cleaned.split(".")
      const nextValue =
        cleaned.includes(".") && decimal !== undefined
          ? `${whole}.${decimal.slice(0, 6)}`
          : whole

      form.setValue("amount", nextValue, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      updateUrlWithFormState({ amount: nextValue || null }, { replace: true })
    },
    [form, updateUrlWithFormState],
  )

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      form.setValue("templateId", templateId, {
        shouldDirty: true,
        shouldValidate: true,
      })
      updateUrlWithFormState({ template: templateId }, { replace: true })
    },
    [form, updateUrlWithFormState],
  )

  const handleReview = useCallback(async () => {
    const isValid = await form.trigger()
    if (!isValid || !canReview) return

    updateStep("review")
  }, [canReview, form, updateStep])

  const handleSendGift = useCallback(async () => {
    if (!selectedAsset || !canSend) return

    setIsSending(true)
    try {
      await giftService.sendGift({
        recipientEmail: isEmailRecipient
          ? normalizedRecipient.toLowerCase()
          : undefined,
        recipientTag: isEmailRecipient
          ? undefined
          : normalizedRecipient.replace(/^@/, ""),
        amount: amountValue,
        symbol: selectedAsset.symbol,
        chain: selectedAsset.chain,
        message: message.trim() || undefined,
        templateId: selectedTemplate.id,
        title:
          selectedTemplate.id === "custom"
            ? cardTitle.trim() || selectedTemplate.title
            : selectedTemplate.title,
      })
      setIsSuccessOpen(true)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send gift.",
      )
    } finally {
      setIsSending(false)
    }
  }, [
    amountValue,
    canSend,
    cardTitle,
    isEmailRecipient,
    message,
    normalizedRecipient,
    selectedAsset,
    selectedTemplate,
  ])

  return {
    form,
    assets,
    step,
    selectedTemplate,
    selectedTemplateId,
    selectedAsset,
    selectedSymbol,
    selectedChain,
    amount,
    normalizedRecipient,
    cardTitle,
    message,
    lookupMessage,
    verifiedRecipient,
    isVerifyingRecipient,
    hasEnoughBalance,
    canReview,
    canSend,
    isSending,
    isSuccessOpen,
    isExitOpen,
    indicatorSteps,
    indicatorCurrentStep,
    goBack,
    closeFlow,
    stayInFlow,
    leaveFlow,
    setIsSuccessOpen,
    handleAmountChange,
    handleTemplateSelect,
    handleReview,
    handleSendGift,
    goToStyle: () => updateStep("style"),
    goToDetails: () => updateStep("details"),
    successChainLabel: getChainLabel(selectedChain),
  }
}
