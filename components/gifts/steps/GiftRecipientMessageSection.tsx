"use client"

import { Loader2 } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { TransferRecipient } from "@/services/api/transfers"
import {
  GIFT_CARD_CLASS,
  GIFT_INPUT_CLASS,
  GIFT_LABEL_CLASS,
  GIFT_SECTION_TITLE_CLASS,
  type GiftFormValues,
} from "../gift-types"

interface GiftRecipientMessageSectionProps {
  form: UseFormReturn<GiftFormValues>
  lookupMessage: string
  verifiedRecipient: TransferRecipient | null
  isVerifyingRecipient: boolean
  isCustomTemplate: boolean
}

export default function GiftRecipientMessageSection({
  form,
  lookupMessage,
  verifiedRecipient,
  isVerifyingRecipient,
  isCustomTemplate,
}: GiftRecipientMessageSectionProps) {
  const lookupTone = verifiedRecipient?.found
    ? "text-emerald-600 dark:text-emerald-400"
    : isVerifyingRecipient
      ? "text-gray-500 dark:text-gray-400"
      : "text-red-500"

  return (
    <div className="space-y-4">
      <section className={GIFT_CARD_CLASS}>
        <div className="mb-4">
          <h2 className={GIFT_SECTION_TITLE_CLASS}>Recipient Details</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Send to a verified Kellon email or tag.
          </p>
        </div>

        <FormField
          control={form.control}
          name="recipient"
          render={({ field, fieldState }) => {
            const showLookupMessage = Boolean(lookupMessage) && !fieldState.error

            return (
              <FormItem>
                <FormLabel className={GIFT_LABEL_CLASS}>
                  Username or Email
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Who is this gift for?"
                    className={cn(GIFT_INPUT_CLASS, "h-12 rounded-2xl")}
                  />
                </FormControl>
                {showLookupMessage ? (
                  <p
                    className={cn(
                      "mt-1 flex items-center gap-2 text-xs font-medium",
                      lookupTone,
                    )}
                  >
                    {isVerifyingRecipient ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {lookupMessage}
                  </p>
                ) : null}
                <FormMessage className="text-xs text-red-500" />
              </FormItem>
            )
          }}
        />

        {isCustomTemplate ? (
          <FormField
            control={form.control}
            name="cardTitle"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel className={GIFT_LABEL_CLASS}>
                  Card Title <span className="font-medium">(Optional)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={28}
                    placeholder="Gift Card"
                    className={cn(GIFT_INPUT_CLASS, "h-12 rounded-2xl")}
                  />
                </FormControl>
                <FormMessage className="text-xs text-red-500" />
              </FormItem>
            )}
          />
        ) : null}
      </section>

      <section className={GIFT_CARD_CLASS}>
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={GIFT_SECTION_TITLE_CLASS}>
                Personal Message
                <span className="font-medium text-gray-500 dark:text-gray-400">
                  {" "}
                  (Optional)
                </span>
              </FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  placeholder="Add a sweet note..."
                  rows={5}
                  maxLength={160}
                  className={cn(
                    GIFT_INPUT_CLASS,
                    "mt-4 w-full resize-none rounded-2xl p-4 leading-relaxed outline-none focus:border-primary-70",
                  )}
                />
              </FormControl>
              <FormMessage className="text-xs text-red-500" />
            </FormItem>
          )}
        />
      </section>
    </div>
  )
}
