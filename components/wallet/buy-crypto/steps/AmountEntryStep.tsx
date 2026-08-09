"use client";

import {
  CreditCard,
  Landmark,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import type { PaymentRail } from "@/lib/payment-rails";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumberWithCommas } from "@/lib/format-number-with-comma";
import SummaryPill from "@/components/wallet/shared/FlowSummaryPill";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import Keypad from "@/components/Keypad";

interface AmountEntryStepProps {
  asset: string | null;
  networkName: string | null;
  selectedChain?: { name: string } | null;
  amount: string;
  fiatCurrency: string;
  fiatSymbol: string;
  decimals: number;
  cryptoAmountValue: number;
  exchangeRate: number;
  isRateLoading: boolean;
  isAmountValid: boolean;
  paymentRail: PaymentRail;
  paymentMethodLabel: string;
  onKeypadPress: (val: string) => void;
  onContinue: () => void;
  onAmountChange?: (value: string) => void;
}

// Validation schema
const amountSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .regex(/^\d+(\.\d{0,2})?$/, "Invalid amount format (max 2 decimal places)")
    .refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
});

type AmountFormValues = z.infer<typeof amountSchema>;

// Quick amount suggestions - exactly 6 amounts
const QUICK_AMOUNTS = [500, 2000, 5000, 10000, 25000, 50000];

export function AmountEntryStep({
  asset,
  selectedChain,
  amount,
  fiatCurrency,
  fiatSymbol,
  isRateLoading,
  isAmountValid,
  paymentRail,
  paymentMethodLabel,
  onKeypadPress,
  onContinue,
  onAmountChange,
}: AmountEntryStepProps) {
  // Form for desktop
  const form = useForm<AmountFormValues>({
    resolver: zodResolver(amountSchema),
    defaultValues: {
      amount: amount || "",
    },
  });

  const handleAmountChange = (value: string) => {
    onAmountChange?.(value);
    form.setValue("amount", value);
  };

  const handleQuickAmount = (value: number) => {
    const amountStr = value.toString();
    handleAmountChange(amountStr);
  };

  const handleFormSubmit = (data: AmountFormValues) => {
    if (parseFloat(data.amount) > 0) {
      onContinue();
    }
  };

  const displayAmount = amount ? formatNumberWithCommas(amount) : "0";

  // Quick amount buttons component
  // Minimalist design
  const QuickAmountButtons = () => (
    <div className="space-y-3">
      <p className="text-center text-[11px] font-medium text-gray-400 uppercase tracking-wider">
        or choose amount
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {QUICK_AMOUNTS.map((quickAmount) => (
          <button
            key={quickAmount}
            type="button"
            onClick={() => handleQuickAmount(quickAmount)}
            className={cn(
              "cursor-pointer",
              "rounded-full px-4 py-2 text-sm font-medium transition-all",
              "border",
              amount === quickAmount.toString()
                ? "border-primary-60 bg-primary-70/10 text-primary-60"
                : "border-black/10 bg-white text-gray-700 hover:border-primary-60/30 hover:bg-primary-70/5 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-300",
              "active:scale-95",
            )}
          >
            {fiatSymbol}
            {formatNumberWithCommas(quickAmount.toString())}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-200px)] md:min-h-[500px]">
      <div className="flex-1 overflow-y-auto md:px-0">
        <SummaryPill
          asset={asset}
          selectedChain={selectedChain}
          amount={amount}
          fiatCurrency={fiatCurrency}
        />

        {/* Mobile View */}
        <div className="block w-full lg:hidden">
          {/* Amount Display */}
          <div className="mb-4 mt-8 text-center">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-xl font-bold text-gray-400">
                {fiatCurrency}
              </span>
              <span className="text-2xl font-bold text-black dark:text-white">
                {displayAmount}
              </span>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="mb-6">
            <QuickAmountButtons />
          </div>

          {/* Informational until additional payment rails are enabled. */}
          <div className="mb-4 w-full">
            <div
              className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-secondary-50"
              aria-label={`Payment method: ${paymentMethodLabel}`}
            >
              <span className="text-[11px] font-medium text-gray-500">
                Payment method
              </span>
              <div className="flex items-center gap-2 text-xs font-bold">
                {paymentRail === "card" && (
                  <CreditCard className="h-4 w-4 text-primary-70" />
                )}
                {paymentRail === "bank_transfer" && (
                  <Landmark className="h-4 w-4 text-primary-70" />
                )}
                {paymentRail === "mobile_money" && (
                  <Smartphone className="h-4 w-4 text-primary-70" />
                )}
                {paymentMethodLabel}
              </div>
            </div>
          </div>

          {/* Keypad */}
          <div className="w-full pb-4">
            <Keypad onPress={onKeypadPress} />
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden w-full lg:block">
          <div className="mt-6 rounded-2xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-secondary-50">
            <Form {...form}>
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
                              {fiatCurrency}
                            </span>
                          </div>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-12 rounded-2xl border-black/5 bg-gray-95 pl-12 text-center placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                handleAmountChange(e.target.value);
                              }}
                            />
                          </FormControl>
                        </div>
                        <FormMessage className="text-center text-sm" />
                      </FormItem>
                    )}
                  />

                  <QuickAmountButtons />
                </div>
              </form>
            </Form>
          </div>

          {/* Desktop payment method display */}
          <div className="mt-4 w-full">
            <div
              className="flex w-full items-center justify-between rounded-xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-secondary-50"
              aria-label={`Payment method: ${paymentMethodLabel}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gray-100 p-2 dark:bg-secondary-60/60">
                  {paymentRail === "card" && (
                    <CreditCard className="h-4 w-4 text-primary-70" />
                  )}
                  {paymentRail === "bank_transfer" && (
                    <Landmark className="h-4 w-4 text-primary-70" />
                  )}
                  {paymentRail === "mobile_money" && (
                    <Smartphone className="h-4 w-4 text-primary-70" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <p className="text-sm font-semibold">{paymentMethodLabel}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Continue Button - Below payment method */}
          <FlowActionFooter
            sticky={false}
            className="mt-6 w-full"
            onClick={onContinue}
            disabled={!isAmountValid || isRateLoading}
            buttonClassName={cn(!isAmountValid && "from-gray-400 to-gray-500")}
            showShimmer={isAmountValid && !isRateLoading}
          >
            {isRateLoading
              ? "Fetching Rate..."
              : isAmountValid
                ? "Select Provider"
                : "Enter Amount"}
            {isAmountValid && !isRateLoading && (
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </FlowActionFooter>
        </div>
      </div>

      {/* Mobile Sticky Footer */}
      <FlowActionFooter
        className="lg:hidden"
        onClick={onContinue}
        disabled={!isAmountValid || isRateLoading}
        buttonClassName={cn(!isAmountValid && "from-gray-400 to-gray-500")}
        textClassName="text-sm"
        showShimmer={isAmountValid && !isRateLoading}
        helperText="Enter the amount you want to spend • Providers will show you their best rates"
      >
        {isRateLoading
          ? "Fetching Rate..."
          : isAmountValid
            ? "Select Provider"
            : "Enter Amount"}
        {isAmountValid && !isRateLoading && (
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        )}
      </FlowActionFooter>
    </div>
  );
}
