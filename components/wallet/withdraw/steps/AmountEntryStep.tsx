"use client"

import { useEffect, useMemo } from "react"
import { ArrowRight, Delete } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { cn } from "@/lib/utils"
import { formatNumberWithCommas } from "@/lib/format-number-with-comma"
import SummaryPill from "@/components/wallet/shared/FlowSummaryPill"
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"

interface AmountEntryStepProps {
  asset: string | null
  selectedChain?: { name: string } | null
  amount: string
  assetBalance: number
  onContinue: () => void
  onAmountChange: (value: string) => void
}

type AmountFormValues = {
  amount: string
}

const FIXED_QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500]

function formatAssetAmount(value: number) {
  if (!Number.isFinite(value)) return "0"
  return value.toFixed(6).replace(/\.?0+$/, "")
}

export function WithdrawAmountEntryStep({
  asset,
  selectedChain,
  amount,
  assetBalance,
  onContinue,
  onAmountChange,
}: AmountEntryStepProps) {
  const amountSchema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .min(1, "Amount is required")
          .regex(
            /^\d+(\.\d{0,6})?$/,
            "Invalid amount format (max 6 decimal places)",
          )
          .refine((value) => Number(value) > 0, "Amount must be greater than 0")
          .refine(
            (value) => Number(value) <= assetBalance,
            `Amount cannot exceed your ${formatAssetAmount(assetBalance)} ${asset || "asset"} balance`,
          ),
      }),
    [asset, assetBalance],
  )

  const form = useForm<AmountFormValues>({
    resolver: zodResolver(amountSchema),
    defaultValues: {
      amount: amount || "",
    },
    mode: "onChange",
  })

  useEffect(() => {
    if (form.getValues("amount") !== amount) {
      form.setValue("amount", amount, { shouldValidate: true })
    }
  }, [amount, form])

  const currentAmount = form.watch("amount")
  const displayAmount = currentAmount
    ? formatNumberWithCommas(currentAmount)
    : "0"
  const isAmountValid = form.formState.isValid
  const quickAmounts = useMemo(
    () =>
      FIXED_QUICK_AMOUNTS.filter((value) => value <= assetBalance).slice(0, 6),
    [assetBalance],
  )

  const keypadKeys = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    ".",
    "0",
    "delete",
  ]

  const syncAmount = (nextValue: string) => {
    if (nextValue !== "" && !/^\d+(\.\d{0,6})?$/.test(nextValue)) {
      return
    }

    form.setValue("amount", nextValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    onAmountChange(nextValue)
  }

  const handleKeypadPress = (value: string) => {
    const currentValue = form.getValues("amount")
    let nextAmount = currentValue

    if (value === "delete") {
      nextAmount = currentValue.slice(0, -1)
    } else if (value === "." && currentValue.includes(".")) {
      return
    } else if (currentValue === "0" && value !== ".") {
      nextAmount = value
    } else {
      nextAmount = currentValue + value
    }

    syncAmount(nextAmount)
  }

  const handleFormSubmit = ({ amount: enteredAmount }: AmountFormValues) => {
    if (Number(enteredAmount) <= assetBalance) {
      onContinue()
    }
  }

  const balanceLabel =
    `${formatAssetAmount(assetBalance)} ${asset || ""}`.trim()

  return (
    <Form {...form}>
      <div className="flex h-full min-h-[calc(100dvh-200px)] flex-col md:min-h-[500px]">
        <div className="flex-1 overflow-y-auto md:px-0">
          <SummaryPill
            asset={asset}
            selectedChain={selectedChain}
            amount={currentAmount}
            amountCurrency={asset || undefined}
          />

          <div className="block w-full lg:hidden">
            <div className="mb-4 mt-8 text-center">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-xl font-bold text-gray-400">{asset}</span>
                <span className="text-2xl font-bold text-black dark:text-white">
                  {displayAmount}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Available: {balanceLabel}
                </p>
                <button
                  type="button"
                  onClick={() => syncAmount(formatAssetAmount(assetBalance))}
                  className="rounded-full border border-black/10 px-2 py-0.5 text-[11px] font-semibold text-primary-60 transition hover:border-primary-60/30 hover:bg-primary-70/5 dark:border-white/10 dark:hover:bg-white/5 cursor-pointer"
                >
                  Max
                </button>
              </div>
              {form.formState.errors.amount ? (
                <p className="mt-2 text-sm text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              ) : null}
            </div>

            {quickAmounts.length ? (
              <div className="mb-6 space-y-3">
                <p className="text-center text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  or choose amount
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {quickAmounts.map((quickAmount) => (
                    <button
                      key={quickAmount}
                      type="button"
                      onClick={() => syncAmount(formatAssetAmount(quickAmount))}
                      className={cn(
                        "cursor-pointer",
                        "rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95",
                        currentAmount === formatAssetAmount(quickAmount)
                          ? "border-primary-60 bg-primary-70/10 text-primary-60"
                          : "border-black/10 bg-white text-gray-700 hover:border-primary-60/30 hover:bg-primary-70/5 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-300",
                      )}
                    >
                      {formatNumberWithCommas(formatAssetAmount(quickAmount))}{" "}
                      {asset}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="w-full pb-4">
              <div className="grid grid-cols-3 gap-2">
                {keypadKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className="flex h-14 items-center justify-center rounded-2xl border border-black/5 bg-white text-xl font-bold transition-colors active:scale-95 hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50 cursor-pointer"
                  >
                    {key === "delete" ? (
                      <Delete className="h-6 w-6 text-gray-500" />
                    ) : (
                      key
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden w-full lg:block">
            <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-secondary-50">
              <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <div className="relative">
                          <div className="absolute left-0 top-0 flex h-full items-center justify-center rounded-l-xl border-r border-slate-200 bg-gray-100 px-4 dark:border-white/10 dark:bg-secondary-50/50">
                            <span className="text-lg font-bold text-gray-600 dark:text-gray-300">
                              {asset}
                            </span>
                          </div>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              className="h-12 rounded-2xl border-black/5 bg-gray-95 pl-16 pr-16 text-center placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
                              {...field}
                              onChange={(event) =>
                                syncAmount(event.target.value.trim())
                              }
                            />
                          </FormControl>
                          <button
                            type="button"
                            onClick={() =>
                              syncAmount(formatAssetAmount(assetBalance))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold text-primary-60 transition hover:border-primary-60/30 hover:bg-primary-70/5 dark:border-white/10 dark:hover:bg-white/5 cursor-pointer"
                          >
                            Max
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-4">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Available balance: {balanceLabel}
                          </p>
                          <FormMessage className="text-right text-sm" />
                        </div>
                      </FormItem>
                    )}
                  />

                  {quickAmounts.length ? (
                    <div className="space-y-3">
                      <p className="text-center text-[11px] font-medium uppercase tracking-wider text-gray-400">
                        or choose amount
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {quickAmounts.map((quickAmount) => (
                          <button
                            key={quickAmount}
                            type="button"
                            onClick={() =>
                              syncAmount(formatAssetAmount(quickAmount))
                            }
                            className={cn(
                              "cursor-pointer",
                              "rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95",
                              currentAmount === formatAssetAmount(quickAmount)
                                ? "border-primary-60 bg-primary-70/10 text-primary-60"
                                : "border-black/10 bg-white text-gray-700 hover:border-primary-60/30 hover:bg-primary-70/5 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-300",
                            )}
                          >
                            {formatNumberWithCommas(
                              formatAssetAmount(quickAmount),
                            )}{" "}
                            {asset}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </form>
            </div>

            <FlowActionFooter
              sticky={false}
              className="mt-6 w-full"
              onClick={form.handleSubmit(handleFormSubmit)}
              disabled={!isAmountValid}
              buttonClassName={cn(
                !isAmountValid && "from-gray-400 to-gray-500",
              )}
              textClassName="text-base"
              showShimmer={isAmountValid}
            >
              {isAmountValid ? "Select Provider" : "Enter Valid Amount"}
              {isAmountValid ? (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              ) : null}
            </FlowActionFooter>
          </div>
        </div>

        <FlowActionFooter
          className="lg:hidden"
          onClick={form.handleSubmit(handleFormSubmit)}
          disabled={!isAmountValid}
          buttonClassName={cn(!isAmountValid && "from-gray-400 to-gray-500")}
          textClassName="text-sm"
          showShimmer={isAmountValid}
        >
          {isAmountValid ? "Select Provider" : "Enter Valid Amount"}
          {isAmountValid ? (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          ) : null}
        </FlowActionFooter>
      </div>
    </Form>
  )
}
