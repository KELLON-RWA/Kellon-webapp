"use client"

import { Loader2, Send } from "lucide-react"
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter"
import { cn } from "@/lib/utils"
import GiftCardPreview from "../GiftCardPreview"
import {
  GIFT_CARD_CLASS,
} from "../gift-types"
import { GIFT_TEMPLATES } from "../gift-utils"

interface GiftReviewStepProps {
  template: (typeof GIFT_TEMPLATES)[number]
  amount: string
  symbol: string
  chain: string
  recipient: string
  cardTitle: string
  message: string
  isSending: boolean
  canSend: boolean
  onSend: () => void
}

export default function GiftReviewStep({
  template,
  amount,
  symbol,
  chain,
  recipient,
  cardTitle,
  message,
  isSending,
  canSend,
  onSend,
}: GiftReviewStepProps) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <GiftCardPreview
          template={template}
          amount={amount || "0.00"}
          symbol={symbol}
          recipient={recipient}
          title={cardTitle}
          className="mx-auto w-full max-w-[520px] lg:max-w-none"
        />

        <div className="space-y-5">
          {message.trim() ? (
            <div className={cn(GIFT_CARD_CLASS, "relative py-7 text-center")}>
              <span
                className="absolute left-4 top-2 text-4xl font-bold opacity-30"
                style={{ color: template.accent }}
              >
                “
              </span>
              <p className="text-base font-medium leading-relaxed text-black dark:text-white">
                {message.trim()}
              </p>
              <span
                className="absolute bottom-0 right-4 text-4xl font-bold opacity-30"
                style={{ color: template.accent }}
              >
                ”
              </span>
            </div>
          ) : null}

          <div className={GIFT_CARD_CLASS}>
            <dl className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Network Fee
                </dt>
                <dd className="text-sm font-bold text-black dark:text-white">
                  Gasless (Free)
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Debit
                </dt>
                <dd className="text-sm font-bold text-black dark:text-white">
                  {amount || "0"} {symbol}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Network
                </dt>
                <dd className="text-sm font-bold text-black dark:text-white">
                  {chain}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <FlowActionFooter
        sticky={false}
        onClick={onSend}
        disabled={!canSend}
        className="mx-auto w-full max-w-xl border-0 px-0"
      >
        {isSending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Confirm & Send Gift
      </FlowActionFooter>
    </section>
  )
}
