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
import { getChainLabel } from "@/lib/chains";
import type { AmountFormValues, SendableAsset } from "./send-types";
import { formatAssetAmount } from "./send-utils";

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
          className="space-y-6"
        >
          <FormField
            control={amountForm.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-tight text-gray-30 dark:text-gray-40 md:text-xs">
                    Sending {selectedAsset?.symbol || "asset"} on{" "}
                    {getChainLabel(selectedAsset?.chain)}
                  </p>
                  <FormControl>
                    <div className="relative mt-3">
                      <input
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          onAmountChange(event.target.value);
                        }}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="h-16 w-full rounded-2xl border border-black/5 bg-gray-95 px-4 pr-20 text-4xl font-bold tracking-tight text-black outline-none placeholder:text-gray-60 focus-visible:ring-[3px] focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:placeholder:text-white/15 md:h-[72px] md:px-5 md:pr-24 md:text-5xl"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-30 dark:text-gray-40 md:right-5 md:text-base">
                        {selectedAsset?.symbol || "Asset"}
                      </span>
                    </div>
                  </FormControl>
                  <p className="mt-3 text-sm font-medium text-gray-20 dark:text-gray-40 md:text-base">
                    Available: {formatAssetAmount(selectedAsset?.amount || 0)}{" "}
                    {selectedAsset?.symbol}
                  </p>
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
