"use client";

import { CreditCard, Landmark, Smartphone, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  getBestRateProviderId,
  sortProvidersByRate,
} from "@/lib/provider-rate-display";
import {
  SelectProviderModal,
  type FlowProvider,
  type ProviderRateDetails,
} from "@/components/modals/SelectProviderModal";
import { ProviderSelectorTrigger } from "@/components/wallet/shared/ProviderSelectorTrigger";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  getMinFiatBuyAmount,
  getQuickBuyAmounts,
} from "@/lib/stablecoin-amounts";

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
  minFiatAmount?: number;
  paymentRail: PaymentRail;
  paymentMethodLabel: string;
  providers?: FlowProvider[];
  selectedProviderId?: string | null;
  onSelectProvider?: (id: string) => void;
  providerRates?: Record<string, ProviderRateDetails | null>;
  isRatesLoading?: boolean;
  onKeypadPress: (val: string) => void;
  onContinue: () => void;
  onAmountChange?: (value: string) => void;
}

export function AmountEntryStep({
  asset,
  selectedChain,
  amount,
  fiatCurrency,
  fiatSymbol,
  isRateLoading,
  isAmountValid,
  minFiatAmount,
  paymentRail,
  paymentMethodLabel,
  providers = [],
  selectedProviderId = null,
  onSelectProvider,
  providerRates = {},
  isRatesLoading = false,
  onKeypadPress,
  onContinue,
  onAmountChange,
}: AmountEntryStepProps) {
  const [isAmountEditorOpen, setIsAmountEditorOpen] = useState(false);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);

  const minAmount = minFiatAmount ?? getMinFiatBuyAmount(fiatCurrency);
  const quickAmounts = useMemo(
    () => getQuickBuyAmounts(fiatCurrency),
    [fiatCurrency],
  );

  const numAmount = parseFloat(amount);
  const isBelowMinimum =
    !isNaN(numAmount) && numAmount > 0 && numAmount < minAmount;

  const continueButtonText = isRateLoading
    ? "Fetching Rate..."
    : isAmountValid
      ? "Continue"
      : isBelowMinimum
        ? `Min ${fiatSymbol}${formatNumberWithCommas(minAmount.toString())}`
        : "Enter Amount";

  const sortedProviders = useMemo<FlowProvider[]>(() => {
    return sortProvidersByRate(providers, providerRates, "buy");
  }, [providers, providerRates]);

  const bestRateProviderId = useMemo(() => {
    return getBestRateProviderId(providers, providerRates, "buy");
  }, [providers, providerRates]);

  const selectedProvider =
    sortedProviders.find((p: FlowProvider) => p.id === selectedProviderId) ||
    sortedProviders[0] ||
    null;
  const isBestRate = Boolean(
    selectedProvider && selectedProvider.id === bestRateProviderId,
  );
  const selectedProviderRate = selectedProvider
    ? providerRates[selectedProvider.id]
    : null;
  const rateText =
    selectedProviderRate?.cryptoAmount && selectedProviderRate.cryptoAmount > 0
      ? `≈ ${selectedProviderRate.cryptoAmount.toFixed(4)} ${asset || ""}`.trim()
      : null;

  // Form for desktop
  const amountSchema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .min(1, "Amount is required")
          .regex(
            /^\d+(\.\d{0,2})?$/,
            "Invalid amount format (max 2 decimal places)",
          )
          .refine(
            (val) => Number.isFinite(Number(val)) && Number(val) >= minAmount,
            `Minimum amount is ${fiatSymbol}${formatNumberWithCommas(minAmount.toString())}`,
          ),
      }),
    [minAmount, fiatSymbol],
  );

  type AmountFormValues = z.infer<typeof amountSchema>;

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
    if (parseFloat(data.amount) >= minAmount) {
      onContinue();
    }
  };

  const displayAmount = amount ? formatNumberWithCommas(amount) : "0";

  const QuickAmountButtons = () => (
    <div className="grid grid-cols-3 gap-3">
      {quickAmounts.map((quickAmount) => (
        <button
          key={quickAmount}
          type="button"
          onClick={() => handleQuickAmount(quickAmount)}
          className={cn(
            "h-14 cursor-pointer rounded-2xl border text-sm font-medium transition-all md:h-16 md:text-base",
            amount === quickAmount.toString()
              ? "border-primary-60 bg-primary-70/10 text-primary-60"
              : "border-transparent bg-gray-95 text-gray-700 hover:border-primary-60/30 hover:bg-primary-70/5 dark:bg-secondary-60 dark:text-gray-300 dark:hover:bg-secondary-60/80",
            "active:scale-[0.98]",
          )}
        >
          {fiatSymbol}
          {formatNumberWithCommas(quickAmount.toString())}
        </button>
      ))}
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
          <button
            type="button"
            onClick={() => setIsAmountEditorOpen(true)}
            className="mb-4 mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-center outline-none transition hover:bg-gray-95 focus-visible:ring-2 focus-visible:ring-primary-60/40 dark:hover:bg-white/5"
            aria-label="Edit amount"
          >
            <span className="text-xl font-bold leading-none text-gray-400">
              {fiatCurrency}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="text-2xl font-bold leading-none text-black dark:text-white">
                {displayAmount}
              </span>
              <span
                aria-hidden="true"
                className="h-5 w-px shrink-0 self-center animate-pulse rounded-full bg-primary-60"
              />
            </span>
          </button>
          {isBelowMinimum && (
            <p className="-mt-2 mb-4 text-center text-xs font-medium text-amber-500">
              Minimum amount is {fiatSymbol}
              {formatNumberWithCommas(minAmount.toString())}
            </p>
          )}

          {/* Quick Amount Buttons */}
          <div className="mb-6">
            <QuickAmountButtons />
          </div>

          {/* Payment Provider Selection */}
          {providers.length > 0 && (
            <div className="mb-4 w-full">
              <ProviderSelectorTrigger
                selectedProvider={selectedProvider}
                onClick={() => setIsProviderModalOpen(true)}
                isRatesLoading={isRatesLoading}
                rateText={rateText}
                isBestRate={isBestRate}
              />
            </div>
          )}

          {/* Informational until additional payment rails are enabled. */}
          <div className="mb-4 w-full">
            <div
              className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white p-2.5 dark:border-white/10 dark:bg-secondary-50 xs:p-3 sm:p-4"
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
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              pattern="[0-9]*[.]?[0-9]{0,2}"
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
                        {isBelowMinimum && !form.formState.errors.amount && (
                          <p className="mt-2 text-center text-xs font-medium text-amber-500">
                            Minimum amount is {fiatSymbol}
                            {formatNumberWithCommas(minAmount.toString())}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />

                  <QuickAmountButtons />
                </div>
              </form>
            </Form>
          </div>

          {/* Desktop payment provider selection */}
          {providers.length > 0 && (
            <div className="mt-4 w-full">
              <ProviderSelectorTrigger
                selectedProvider={selectedProvider}
                onClick={() => setIsProviderModalOpen(true)}
                isRatesLoading={isRatesLoading}
                rateText={rateText}
                isBestRate={isBestRate}
              />
            </div>
          )}

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
            {continueButtonText}
            {isAmountValid && !isRateLoading && (
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </FlowActionFooter>
        </div>
      </div>

      {!isAmountEditorOpen ? (
        <FlowActionFooter
          className="lg:hidden"
          onClick={onContinue}
          disabled={!isAmountValid || isRateLoading}
          buttonClassName={cn(!isAmountValid && "from-gray-400 to-gray-500")}
          textClassName="text-sm"
          showShimmer={isAmountValid && !isRateLoading}
        >
          {continueButtonText}
          {isAmountValid && !isRateLoading && (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          )}
        </FlowActionFooter>
      ) : null}

      <Drawer open={isAmountEditorOpen} onOpenChange={setIsAmountEditorOpen}>
        <DrawerContent className="lg:hidden rounded-t-[28px] border-black/5 bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 dark:border-white/10 dark:bg-none dark:bg-secondary-50 [&>div:first-child]:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Enter amount</DrawerTitle>
          </DrawerHeader>
          <div className="mx-auto w-full max-w-md">
            <FlowActionFooter
              sticky={false}
              className="mb-4"
              onClick={() => {
                setIsAmountEditorOpen(false);
                onContinue();
              }}
              disabled={!isAmountValid || isRateLoading}
              buttonClassName={cn(
                !isAmountValid && "from-gray-400 to-gray-500",
              )}
              textClassName="text-sm"
              showShimmer={isAmountValid && !isRateLoading}
            >
              {continueButtonText}
              {isAmountValid && !isRateLoading && (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </FlowActionFooter>
            {isBelowMinimum && (
              <p className="-mt-2 mb-3 text-center text-xs font-medium text-amber-500">
                Minimum amount is {fiatSymbol}
                {formatNumberWithCommas(minAmount.toString())}
              </p>
            )}
            <Keypad
              onPress={onKeypadPress}
              className="gap-3"
              buttonClassName="h-14 rounded-2xl bg-white dark:bg-secondary-60"
            />
          </div>
        </DrawerContent>
      </Drawer>

      <SelectProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        providers={sortedProviders}
        selectedProviderId={selectedProviderId || null}
        onSelectProvider={(id) => onSelectProvider?.(id)}
        providerRates={providerRates}
        isRatesLoading={isRatesLoading}
        asset={asset}
        fiatCurrency={fiatCurrency}
        mode="buy"
      />
    </div>
  );
}
