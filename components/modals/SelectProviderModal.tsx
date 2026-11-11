"use client";

import { useMemo } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  getBestRateProviderId,
  getDisplayProviderRate,
  sortProvidersByRate,
} from "@/lib/provider-rate-display";
import { cn } from "@/lib/utils";
import { ProviderLogo } from "@/components/wallet/shared/ProviderLogo";

export interface FlowProvider {
  id: string;
  name: string;
  logo?: string;
  deliveryTime?: string;
  fee?: string;
  isRecommended?: boolean;
  features?: string[];
}

export interface ProviderRateDetails {
  cryptoAmount: number | null;
  fiatAmount: number | null;
  rawRate: number | null;
}

interface SelectProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: FlowProvider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
  providerRates?: Record<string, ProviderRateDetails | null>;
  isRatesLoading?: boolean;
  asset?: string | null;
  fiatCurrency?: string;
  mode?: "buy" | "withdraw";
}

function hasUsableProviderRate(
  rateDetails: ProviderRateDetails | null | undefined,
  mode: "buy" | "withdraw",
) {
  if (mode === "buy") {
    return Boolean(
      rateDetails?.rawRate &&
        rateDetails.rawRate > 0 &&
        rateDetails.cryptoAmount &&
        rateDetails.cryptoAmount > 0,
    );
  }
  return Boolean(
    rateDetails?.rawRate &&
      rateDetails.rawRate > 0 &&
      rateDetails.fiatAmount &&
      rateDetails.fiatAmount > 0,
  );
}

export function SelectProviderModal({
  isOpen,
  onClose,
  providers,
  selectedProviderId,
  onSelectProvider,
  providerRates = {},
  isRatesLoading = false,
  asset,
  fiatCurrency,
  mode = "buy",
}: SelectProviderModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const bestRateProviderId = useMemo(() => {
    return getBestRateProviderId(providers, providerRates, mode);
  }, [providers, providerRates, mode]);

  const visibleProviders = useMemo(() => {
    let list = providers;
    if (!isRatesLoading) {
      const withRates = providers.filter((provider) =>
        hasUsableProviderRate(providerRates[provider.id], mode),
      );
      if (withRates.length > 0) {
        list = withRates;
      }
    }
    return sortProvidersByRate(list, providerRates, mode);
  }, [providers, providerRates, isRatesLoading, mode]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const handleSelect = (providerId: string) => {
    onSelectProvider(providerId);
    onClose();
  };

  const content = (
    <div className="flex max-h-[85dvh] flex-col px-4 pb-6 pt-4 md:max-h-[75dvh] md:px-0 md:pb-0">
      <div className="flex items-center justify-between border-b border-black/5 pb-4 dark:border-white/10 md:px-6">
        <div>
          <h2 className="text-lg font-bold text-black dark:text-white md:text-xl">
            Select Provider
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {isRatesLoading
              ? "Updating live exchange rates..."
              : `${visibleProviders.length} payment provider${visibleProviders.length === 1 ? "" : "s"} available`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/5 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-black dark:border-white/10 dark:bg-secondary-60 dark:text-gray-400 dark:hover:bg-secondary-50 dark:hover:text-white"
          aria-label="Close provider modal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 md:px-6">
        {visibleProviders.length > 0 ? (
          <div className="space-y-3">
            {visibleProviders.map((provider) => {
              const isSelected = provider.id === selectedProviderId;
              const rateDetails = providerRates[provider.id];
              const rawRate = rateDetails?.rawRate;
              const displayRate = getDisplayProviderRate(
                provider.name,
                rawRate,
                rateDetails?.fiatAmount,
                rateDetails?.cryptoAmount,
              );
              const isLoadingRate = isRatesLoading && rateDetails === undefined;

              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSelect(provider.id)}
                  className={cn(
                    "relative flex w-full cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 text-left transition-all",
                    "hover:shadow-xs active:scale-[0.99]",
                    isSelected
                      ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                      : "border-black/5 bg-white hover:border-primary-60/30 dark:border-white/10 dark:bg-secondary-60/40",
                  )}
                >
                  {provider.id === bestRateProviderId ? (
                    <div className="absolute -right-1.5 -top-2">
                      <div className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-0.5 text-[8px] font-bold tracking-wide text-white shadow-sm md:text-[9px]">
                        Best Rate
                      </div>
                    </div>
                  ) : provider.isRecommended ? (
                    <div className="absolute -right-1.5 -top-2">
                      <div className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[8px] font-bold text-white shadow-sm md:text-[9px]">
                        Recommended
                      </div>
                    </div>
                  ) : null}

                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-60/10 to-secondary-50/10 dark:from-primary-70/10 dark:to-primary-60/10">
                      <ProviderLogo
                        name={provider.name}
                        logo={provider.logo}
                        size={44}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-black dark:text-white md:text-base">
                          {provider.name}
                        </p>
                        {isSelected ? (
                          <Check className="h-4 w-4 shrink-0 text-primary-60" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {provider.deliveryTime || "Fast processing"}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {isLoadingRate ? (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Estimating...</span>
                      </div>
                    ) : mode === "buy" && rateDetails?.cryptoAmount && rateDetails.cryptoAmount > 0 ? (
                      <div>
                        <p className="text-sm font-bold text-primary-60 md:text-base">
                          {rateDetails.cryptoAmount.toFixed(4)} {asset}
                        </p>
                        {displayRate && fiatCurrency ? (
                          <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                            1 {asset} ≈ {formatCurrency(displayRate)} {fiatCurrency}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          Fee: {provider.fee || "Free"}
                        </p>
                      </div>
                    ) : mode === "withdraw" && rateDetails?.fiatAmount && rateDetails.fiatAmount > 0 ? (
                      <div>
                        <p className="text-sm font-bold text-primary-60 md:text-base">
                          {formatCurrency(rateDetails.fiatAmount)} {fiatCurrency}
                        </p>
                        {displayRate && fiatCurrency ? (
                          <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                            1 {asset} ≈ {formatCurrency(displayRate)} {fiatCurrency}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          Fee: {provider.fee || "Free"}
                        </p>
                      </div>
                    ) : (
                      <div>
                        {displayRate && fiatCurrency ? (
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            1 {asset} ≈ {formatCurrency(displayRate)} {fiatCurrency}
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-gray-400">
                            Rate pending
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          Fee: {provider.fee || "Free"}
                        </p>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            No payment providers found for this selection.
          </div>
        )}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-0 shadow-xl outline-none dark:bg-none dark:bg-black2 sm:max-w-lg [&>button]:hidden"
        >
          <DialogTitle className="sr-only">Select Provider</DialogTitle>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92vh] rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden [&>div:first-child]:bg-gray-80 dark:[&>div:first-child]:bg-white/20">
        <DrawerTitle className="sr-only">Select Provider</DrawerTitle>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
