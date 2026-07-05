"use client"

import { ArrowRight, Eye } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter"
import type { TransferRecipient } from "@/services/api/transfers"
import type { GiftFormValues } from "../gift-types"
import type { GiftAssetOption } from "../gift-utils"
import GiftAssetAmountSection from "./GiftAssetAmountSection"
import GiftRecipientMessageSection from "./GiftRecipientMessageSection"

interface GiftDetailsStepProps {
  form: UseFormReturn<GiftFormValues>
  assets: GiftAssetOption[]
  selectedAsset: GiftAssetOption | null
  lookupMessage: string
  verifiedRecipient: TransferRecipient | null
  isVerifyingRecipient: boolean
  hasEnoughBalance: boolean
  canReview: boolean
  isCustomTemplate: boolean
  onAmountChange: (value: string) => void
  onReview: () => void
}

export default function GiftDetailsStep({
  form,
  assets,
  selectedAsset,
  lookupMessage,
  verifiedRecipient,
  isVerifyingRecipient,
  hasEnoughBalance,
  canReview,
  isCustomTemplate,
  onAmountChange,
  onReview,
}: GiftDetailsStepProps) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 md:gap-5">
      <GiftAssetAmountSection
        form={form}
        assets={assets}
        selectedAsset={selectedAsset}
        hasEnoughBalance={hasEnoughBalance}
        onAmountChange={onAmountChange}
      />
      <GiftRecipientMessageSection
        form={form}
        lookupMessage={lookupMessage}
        verifiedRecipient={verifiedRecipient}
        isVerifyingRecipient={isVerifyingRecipient}
        isCustomTemplate={isCustomTemplate}
      />

      <FlowActionFooter
        sticky={false}
        onClick={onReview}
        disabled={!canReview}
        className="mx-auto w-full max-w-xl border-0 px-0 md:hidden"
        helperText="Review the gift before sending. The recipient must be a verified Kellon user."
      >
        <Eye className="h-4 w-4" />
        Review Gift
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </FlowActionFooter>
    </section>
  )
}
