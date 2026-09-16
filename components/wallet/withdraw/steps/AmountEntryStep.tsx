"use client";

import { useEffect, useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { formatNumberWithCommas } from "@/lib/format-number-with-comma";
import SummaryPill from "@/components/wallet/shared/FlowSummaryPill";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import BridgeDeficitButton from "@/components/wallet/bridge/BridgeDeficitButton";
import Keypad from "@/components/Keypad";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

interface AmountEntryStepProps {
  asset: string | null;
  selectedChain?: { name: string } | null;
  amount: string;
  assetBalance: number;
  onContinue: () => void;
  onAmountChange: (value: string) => void;
  onBridge: () => void;
}

type AmountFormValues = {
  amount: string;
};

const QUICK_PERCENTAGES = [25, 50, 75] as const;

function formatAssetAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(6).replace(/\.?0+$/, "");
}

export function WithdrawAmountEntryStep({
  asset,
  selectedChain,
  amount,
  assetBalance,
  onContinue,
  onAmountChange,
  onBridge,
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
  );

  const form = useForm<AmountFormValues>({
    resolver: zodResolver(amountSchema),
    defaultValues: {
      amount: amount || "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (form.getValues("amount") !== amount) {
      form.setValue("amount", amount, { shouldValidate: true });
    }
  }, [amount, form]);

  const currentAmount = form.watch("amount");
  const displayAmount = currentAmount
    ? formatNumberWithCommas(currentAmount)
    : "0";
  const isAmountValid = form.formState.isValid;
  const isOverBalance =
    Number.isFinite(Number(currentAmount)) &&
    Number(currentAmount) > assetBalance;
  const hasAmount = currentAmount.length > 0;
  const quickAmounts = useMemo(
    () => [
      ...QUICK_PERCENTAGES.map((percentage) => ({
        label: `${percentage}%`,
        value: formatAssetAmount((assetBalance * percentage) / 100),
      })),
      { label: "Max", value: formatAssetAmount(assetBalance) },
    ],
    [assetBalance],
  );

  const syncAmount = (nextValue: string) => {
    if (nextValue !== "" && !/^\d+(\.\d{0,6})?$/.test(nextValue)) {
      return;
    }

    form.setValue("amount", nextValue, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    onAmountChange(nextValue);
  };

  const handleKeypadPress = (value: string) => {
    const currentValue = form.getValues("amount");
    let nextAmount = currentValue;

    if (value === "clear") {
      nextAmount = "";
    } else if (value === "delete") {
      nextAmount = currentValue.slice(0, -1);
    } else if (value === "." && currentValue.includes(".")) {
      return;
    } else if (currentValue === "0" && value !== ".") {
      nextAmount = value;
    } else {
      nextAmount = currentValue + value;
    }

    syncAmount(nextAmount);
  };

  const handleFormSubmit = ({ amount: enteredAmount }: AmountFormValues) => {
    if (Number(enteredAmount) <= assetBalance) {
      onContinue();
    }
  };

  const balanceLabel =
    `${formatAssetAmount(assetBalance)} ${asset || ""}`.trim();

  const QuickAmountButtons = () => (
    <div className="grid grid-cols-4 gap-3">
      {quickAmounts.map((quickAmount) => (
        <button
          key={quickAmount.label}
          type="button"
          onClick={() => syncAmount(quickAmount.value)}
          className={cn(
            "h-14 cursor-pointer rounded-2xl border text-sm font-medium transition-all md:h-16 md:text-base",
            currentAmount === quickAmount.value
              ? "border-primary-60 bg-primary-70/10 text-primary-60"
              : "border-transparent bg-gray-95 text-gray-700 hover:border-primary-60/30 hover:bg-primary-70/5 dark:bg-secondary-60 dark:text-gray-300 dark:hover:bg-secondary-60/80",
            "active:scale-[0.98]",
          )}
        >
          {quickAmount.label}
        </button>
      ))}
    </div>
  );

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
            <div
              className="mb-0 mt-8 flex min-h-14 w-full items-baseline justify-center gap-2 rounded-xl px-3 py-2 text-center outline-none transition hover:bg-gray-95 focus-visible:ring-2 focus-visible:ring-primary-60/40 dark:hover:bg-white/5"
            >
              <span className="text-xl font-bold text-gray-400">{asset}</span>
              <span className="inline-flex items-center gap-2">
                <span className="text-2xl font-bold text-black dark:text-white">
                  {displayAmount}
                </span>
                <span
                  aria-hidden="true"
                  className="h-5 w-px shrink-0 animate-pulse rounded-full bg-primary-60"
                />
              </span>
            </div>
            <div className="mb-4 text-center">
              <div className="mt-0 flex items-center justify-center gap-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {balanceLabel} available
                </p>
              </div>
              {isOverBalance ? (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <p className="text-sm text-destructive">
                    Insufficient balance. You need{" "}
                    {formatAssetAmount(Number(currentAmount) - assetBalance)}{" "}
                    more {asset || "asset"}.
                  </p>
                  <BridgeDeficitButton onClick={onBridge} />
                </div>
              ) : form.formState.errors.amount ? (
                <p className="mt-2 text-sm text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              ) : null}
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
                              className="h-12 rounded-2xl border-black/5 bg-gray-95 pl-16 text-center placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
                              {...field}
                              onChange={(event) =>
                                syncAmount(event.target.value.trim())
                              }
                            />
                          </FormControl>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-4">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {balanceLabel} available
                          </p>
                          <FormMessage className="text-right text-xs font-medium" />
                        </div>
                        {isOverBalance ? (
                          <div className="mt-3 flex justify-end">
                            <BridgeDeficitButton onClick={onBridge} />
                          </div>
                        ) : null}
                      </FormItem>
                    )}
                  />

                  <QuickAmountButtons />
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

        <div className="mt-auto space-y-4 lg:hidden">
          {hasAmount ? (
            <FlowActionFooter
              sticky={false}
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
          ) : (
            <QuickAmountButtons />
          )}
          <Keypad
            onPress={handleKeypadPress}
            className="gap-3"
            buttonClassName="h-14 rounded-2xl bg-white dark:bg-secondary-60"
          />
        </div>
      </div>
    </Form>
  );
}
