"use client"

import { ArrowRight, Eye } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter"
import type { TransferRecipient } from "@/services/api/transfers"
import {
  GIFT_CARD_CLASS,
  type GiftFormValues,
} from "../gift-types"
import type { GiftAssetOption } from "../gift-utils"
import GiftAssetAmountSection from "./GiftAssetAmountSection"
import GiftRecipientMessageSection from "./GiftRecipientMessageSection"
import GiftTemplateGrid from "./GiftTemplateGrid"

interface GiftDesktopFormProps {
  form: UseFormReturn<GiftFormValues>
  assets: GiftAssetOption[]
  selectedAsset: GiftAssetOption | null
  selectedTemplateId: string
  lookupMessage: string
  verifiedRecipient: TransferRecipient | null
  isVerifyingRecipient: boolean
  hasEnoughBalance: boolean
  canReview: boolean
  isCustomTemplate: boolean
  onSelectTemplate: (id: string) => void
  onAmountChange: (value: string) => void
  onReview: () => void
}

export default function GiftDesktopForm({
  form,
  assets,
  selectedAsset,
  selectedTemplateId,
  lookupMessage,
  verifiedRecipient,
  isVerifyingRecipient,
  hasEnoughBalance,
  canReview,
  isCustomTemplate,
  onSelectTemplate,
  onAmountChange,
  onReview,
}: GiftDesktopFormProps) {
  return (
    <section className="hidden w-full flex-1 flex-col gap-5 md:flex">
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <section className={GIFT_CARD_CLASS}>
            <h2 className="mb-4 text-sm font-bold text-black dark:text-white">
              Pick a Style
            </h2>
            <GiftTemplateGrid
              selectedTemplateId={selectedTemplateId}
              onSelect={onSelectTemplate}
              compact
            />
          </section>
          <GiftAssetAmountSection
            form={form}
            assets={assets}
            selectedAsset={selectedAsset}
            hasEnoughBalance={hasEnoughBalance}
            onAmountChange={onAmountChange}
          />
        </div>

        <div className="space-y-5">
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
            className="w-full border-0 px-0"
            helperText="Review the gift before sending. The recipient must be a verified Kellon user."
          >
            <Eye className="h-4 w-4" />
            Review Gift
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </FlowActionFooter>
        </div>
      </div>
    </section>
  )
}
