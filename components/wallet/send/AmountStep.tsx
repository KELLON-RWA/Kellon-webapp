"use client";

import type { UseFormReturn } from "react-hook-form";
import Keypad from "@/components/Keypad";
import BridgeDeficitButton from "@/components/wallet/bridge/BridgeDeficitButton";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import { formatNumberWithCommas } from "@/lib/format-number-with-comma";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import type { AmountFormValues, SendableAsset } from "./send-types";

interface AmountStepProps {
  amountForm: UseFormReturn<AmountFormValues>;
  amount: string;
  selectedAsset: SendableAsset | null;
  isAmountValid: boolean;
  onAmountChange: (value: string) => void;
  onKeypadPress: (value: string) => void;
  onReview: () => void;
  onBridge: () => void;
}

const QUICK_PERCENTAGES = [25, 50, 75] as const;

function formatAssetAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(6).replace(/\.?0+$/, "");
}

export default function AmountStep({
  amountForm,
  amount,
  selectedAsset,
  isAmountValid,
  onAmountChange,
  onKeypadPress,
  onReview,
  onBridge,
}: AmountStepProps) {
  const amountValue = Number(amount);
  const isOverBalance =
    Boolean(selectedAsset) &&
    Number.isFinite(amountValue) &&
    amountValue > (selectedAsset?.amount || 0);
  const hasAmount = amount.length > 0;
  const quickAmounts = [
    ...QUICK_PERCENTAGES.map((percentage) => ({
      label: `${percentage}%`,
      value: formatAssetAmount(((selectedAsset?.amount || 0) * percentage) / 100),
    })),
    { label: "Max", value: formatAssetAmount(selectedAsset?.amount || 0) },
  ];

  const QuickAmountButtons = () => (
    <div className="grid grid-cols-4 gap-3">
      {quickAmounts.map((quickAmount) => (
        <button
          key={quickAmount.label}
          type="button"
          onClick={() => onAmountChange(quickAmount.value)}
          className={cn(
            "h-14 rounded-2xl border text-sm font-medium transition active:scale-[0.98]",
            amount === quickAmount.value
              ? "border-primary-60 bg-primary-70/10 text-primary-60"
              : "border-transparent bg-gray-95 text-gray-700 dark:bg-secondary-60 dark:text-gray-300",
          )}
        >
          {quickAmount.label}
        </button>
      ))}
    </div>
  );
  return (
    <div className="flex min-h-[calc(100dvh-230px)] flex-col gap-5 md:min-h-0 md:gap-6">
      <Form {...amountForm}>
        <form
          onSubmit={amountForm.handleSubmit(() => {
            if (isAmountValid) onReview();
          })}
          className="space-y-0"
        >
          <FormField
            control={amountForm.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <div>
                  <div
                    className="flex min-h-14 w-full items-baseline justify-center gap-2 rounded-xl px-3 py-2 text-center outline-none transition hover:bg-gray-95 focus-visible:ring-2 focus-visible:ring-primary-60/40 dark:hover:bg-white/5 md:hidden"
                  >
                    <span className="text-xl font-bold text-gray-400">
                      {selectedAsset?.symbol || "Asset"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-2xl font-bold text-black dark:text-white">
                        {amount ? formatNumberWithCommas(amount) : "0"}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-5 w-px shrink-0 animate-pulse rounded-full bg-primary-60"
                      />
                    </span>
                  </div>
                  <FormControl>
                    <div className="relative hidden md:block">
                      <div className="absolute left-0 top-0 hidden h-full items-center justify-center rounded-l-xl border-r border-slate-200 bg-gray-100 px-4 dark:border-white/10 dark:bg-secondary-50/50 md:flex">
                        <span className="text-lg font-bold text-gray-600 dark:text-gray-300">
                          {selectedAsset?.symbol || "Asset"}
                        </span>
                      </div>
                      <input
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          onAmountChange(event.target.value);
                        }}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="h-16 w-full rounded-2xl border border-black/5 bg-gray-95 px-4 pr-20 text-4xl font-bold tracking-tight text-black outline-none placeholder:text-gray-60 focus-visible:ring-[3px] focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:placeholder:text-white/15 md:h-12 md:pl-16 md:pr-16 md:text-center md:text-base"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onAmountChange(String(selectedAsset?.amount || 0))
                        }
                        className="absolute right-2 top-1/2 hidden -translate-y-1/2 cursor-pointer rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold text-primary-60 transition hover:border-primary-60/30 hover:bg-primary-70/5 dark:border-white/10 dark:hover:bg-white/5 md:block"
                      >
                        Max
                      </button>
                    </div>
                  </FormControl>
                </div>
                <FormMessage className="hidden text-xs md:block" />
              </FormItem>
            )}
          />
        </form>
      </Form>

      {amount && !isAmountValid ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-red-500">
            Enter an amount greater than zero and within your balance.
          </p>
          {isOverBalance ? <BridgeDeficitButton onClick={onBridge} /> : null}
        </div>
      ) : null}

      <div className="mt-auto space-y-4 md:hidden">
        {hasAmount ? (
          <FlowActionFooter
            sticky={false}
            onClick={() => {
              amountForm.handleSubmit(() => {
                if (isAmountValid) onReview();
              })();
            }}
            disabled={!isAmountValid}
            buttonClassName={!isAmountValid ? "from-gray-400 to-gray-500" : undefined}
            textClassName="text-sm"
            showShimmer={isAmountValid}
          >
            {isAmountValid ? "Review Send" : "Enter Valid Amount"}
          </FlowActionFooter>
        ) : (
          <QuickAmountButtons />
        )}
        <Keypad
          onPress={onKeypadPress}
          className="gap-3"
          buttonClassName="h-14 rounded-2xl bg-white dark:bg-secondary-60"
        />
      </div>
    </div>
  );
}
