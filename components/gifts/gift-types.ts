import { z } from "zod"
import { isGiftRecipientEmail, isGiftRecipientTag } from "./gift-utils"

export const GIFT_CARD_CLASS =
  "rounded-[28px] border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-secondary-50/80 md:p-5"

export const GIFT_INPUT_CLASS =
  "border-black/5 bg-gray-95 text-sm font-semibold text-black placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:placeholder:text-gray-500"

export const GIFT_SECTION_TITLE_CLASS = "text-sm font-bold text-black dark:text-white"

export const GIFT_LABEL_CLASS = "text-xs font-semibold text-gray-500 dark:text-gray-400"

export const giftFormSchema = z.object({
  templateId: z.string().min(1, "Select a gift style."),
  assetKey: z.string().min(1, "Select an asset."),
  amount: z
    .string()
    .trim()
    .min(1, "Enter an amount.")
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message: "Enter a valid amount.",
    }),
  recipient: z
    .string()
    .trim()
    .min(1, "Enter a recipient.")
    .refine(
      (value) => isGiftRecipientEmail(value) || isGiftRecipientTag(value),
      "Enter a valid email or Kellon tag.",
    ),
  cardTitle: z.string().max(28, "Card title must be 28 characters or less."),
  message: z.string().max(160, "Message must be 160 characters or less."),
})

export type GiftFormValues = z.infer<typeof giftFormSchema>
