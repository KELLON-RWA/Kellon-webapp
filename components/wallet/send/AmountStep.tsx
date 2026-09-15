"use client";

import type { UseFormReturn } from "react-hook-form";
import Keypad from "@/components/Keypad";
import BridgeDeficitButton from "@/components/wallet/bridge/BridgeDeficitButton";
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
  return (
    <div className="flex h-full flex-col gap-5 md:gap-6">
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
                  <FormControl>
                    <div className="relative">
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
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-30 dark:text-gray-40 md:hidden">
                        {selectedAsset?.symbol || "Asset"}
                      </span>
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
                <FormMessage className="text-xs" />
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

      <div className="block md:hidden">
        <Keypad onPress={onKeypadPress} />
      </div>
    </div>
  );
}
