"use client"

import type { UseFormReturn } from "react-hook-form"
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import AssetNetworkDisplay from "@/components/wallet/shared/AssetNetworkDisplay"
import { cn } from "@/lib/utils"
import {
  GIFT_CARD_CLASS,
  GIFT_INPUT_CLASS,
  GIFT_SECTION_TITLE_CLASS,
  type GiftFormValues,
} from "../gift-types"
import {
  formatGiftAmount,
  type GiftAssetOption,
} from "../gift-utils"

interface GiftAssetAmountSectionProps {
  form: UseFormReturn<GiftFormValues>
  assets: GiftAssetOption[]
  selectedAsset: GiftAssetOption | null
  hasEnoughBalance: boolean
  onAmountChange: (value: string) => void
}

export default function GiftAssetAmountSection({
  form,
  assets,
  selectedAsset,
  hasEnoughBalance,
  onAmountChange,
}: GiftAssetAmountSectionProps) {
  const selectedAssetKey = form.watch("assetKey")
  const amount = form.watch("amount")
  const enteredAmount = Number(amount)
  const hasEnteredAmount = Number.isFinite(enteredAmount) && enteredAmount > 0
  const isOverBalance = Boolean(selectedAsset) && hasEnteredAmount && !hasEnoughBalance

  return (
    <section className={GIFT_CARD_CLASS}>
      <div className="mb-3">
        <h2 className={GIFT_SECTION_TITLE_CLASS}>Asset & Amount</h2>
        <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          Choose the asset to gift and enter how much to send.
        </p>
      </div>

      <FormField
        control={form.control}
        name="assetKey"
        render={({ field }) => (
          <FormItem>
            {assets.length > 0 ? (
              <div className="grid gap-2">
                {assets.map((asset) => {
                  const isSelected = selectedAssetKey === asset.key

                  return (
                    <button
                      key={asset.key}
                      type="button"
                      onClick={() => field.onChange(asset.key)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-left transition-all",
                        isSelected
                          ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                          : "border-black/5 bg-gray-95 text-gray-600 hover:text-black dark:border-white/10 dark:bg-secondary-50 dark:text-gray-400 dark:hover:bg-secondary-60/50 dark:hover:text-white",
                      )}
                    >
                      <AssetNetworkDisplay
                        symbol={asset.symbol}
                        assetName={asset.name}
                        network={asset.chain}
                        className="flex-1"
                        iconSize="md"
                        symbolClassName="text-base"
                        detailClassName="text-xs"
                      />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 p-6 text-center text-sm text-gray-30 dark:border-white/10 dark:text-gray-40">
                Add funds to your wallet before sending a gift.
              </div>
            )}
            <FormMessage className="text-xs text-red-500" />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem className="mt-3">
            <div className="relative">
              <FormControl>
                <Input
                  value={field.value}
                  onChange={(event) => onAmountChange(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className={cn(
                    GIFT_INPUT_CLASS,
                    "h-16 rounded-2xl pr-20 text-2xl font-semibold",
                  )}
                />
              </FormControl>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                {selectedAsset?.symbol || "Asset"}
              </span>
            </div>
            <FormMessage className="text-xs text-red-500" />
          </FormItem>
        )}
      />

      {selectedAsset ? (
        <p
          className={cn(
            "mt-3 text-xs font-medium",
            isOverBalance ? "text-red-500" : "text-gray-500 dark:text-gray-400",
          )}
        >
          {isOverBalance
            ? `Insufficient balance. Available: ${formatGiftAmount(
                selectedAsset.amount,
              )} ${selectedAsset.symbol}`
            : `Available: ${formatGiftAmount(selectedAsset.amount)} ${
                selectedAsset.symbol
              }`}
        </p>
      ) : null}
    </section>
  )
}
