"use client"

import { useMemo } from "react"
import type { UseFormReturn } from "react-hook-form"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon"
import ChainIcon from "@/components/wallet/ChainIcon"
import { getChainLabel } from "@/lib/chains"
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
  const assetGroups = useMemo(() => {
    const groups = new Map<string, GiftAssetOption[]>()

    assets.forEach((asset) => {
      groups.set(asset.symbol, [...(groups.get(asset.symbol) || []), asset])
    })

    return Array.from(groups.entries()).map(([symbol, options]) => ({
      symbol,
      name: options[0]?.name || symbol,
      options,
    }))
  }, [assets])
  const selectedGroup = assetGroups.find(
    (group) => group.symbol === selectedAsset?.symbol,
  )

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
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {assetGroups.map((group) => {
                    const isSelected = selectedAsset?.symbol === group.symbol

                    return (
                      <button
                        key={group.symbol}
                        type="button"
                        onClick={() => field.onChange(group.options[0]?.key)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                          isSelected
                            ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                            : "border-black/5 bg-gray-95 text-gray-600 hover:text-black dark:border-white/10 dark:bg-secondary-50 dark:text-gray-400 dark:hover:bg-secondary-60/50 dark:hover:text-white",
                        )}
                      >
                        <AssetNetworkIcon symbol={group.symbol} />
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block text-sm font-bold",
                              isSelected && "text-primary-60",
                            )}
                          >
                            {group.symbol}
                          </span>
                          <span className="block truncate text-xs opacity-70">
                            {group.name}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                {selectedGroup ? (
                  <div>
                    <FormLabel className="mb-2 block text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Network
                    </FormLabel>
                    <Select value={selectedAssetKey} onValueChange={field.onChange}>
                      <SelectTrigger
                        aria-label={`Select ${selectedGroup.symbol} network`}
                        className="h-14 w-full rounded-2xl border-black/5 bg-gray-95 px-3 text-black shadow-none focus:border-primary-60 focus:ring-2 focus:ring-primary-60/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
                      >
                        {selectedAsset ? (
                          <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                              <ChainIcon
                                name={selectedAsset.chain}
                                size={28}
                                className="!h-7 !w-7 shrink-0"
                              />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                              {getChainLabel(selectedAsset.chain)}
                            </span>
                            <span className="ml-auto shrink-0 text-xs text-gray-500 dark:text-gray-400">
                              {formatGiftAmount(selectedAsset.amount)} {selectedAsset.symbol}
                            </span>
                          </span>
                        ) : (
                          <SelectValue placeholder="Choose network" />
                        )}
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-black/10 bg-white p-1.5 text-black shadow-xl dark:border-white/10 dark:bg-secondary-50 dark:text-white">
                        {selectedGroup.options.map((asset) => (
                          <SelectItem
                            key={asset.key}
                            value={asset.key}
                            className="min-h-14 rounded-xl py-2.5 pl-3 pr-3 focus:bg-gray-50 dark:focus:bg-secondary-60/50 [&>span:first-child]:hidden [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
                          >
                            <span className="flex w-full min-w-0 items-center gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                                <ChainIcon
                                  name={asset.chain}
                                  size={28}
                                  className="!h-7 !w-7 shrink-0"
                                />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {getChainLabel(asset.chain)}
                              </span>
                              <span className="ml-auto shrink-0 pl-4 text-xs text-gray-500 dark:text-gray-400">
                                {formatGiftAmount(asset.amount)} {asset.symbol}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
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
