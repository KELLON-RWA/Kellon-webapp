// components/BuyCryptoFlow/steps/ProviderSelectionStep.tsx
import { Globe, ArrowRight, Loader2, Check, AlertCircle, Home, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import SummaryPill from "@/components/wallet/shared/FlowSummaryPill";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useState } from "react";

interface Provider {
  id: string;
  name: string;
  logo: string;
  deliveryTime: string;
  fee: string;
  isRecommended?: boolean;
  features: string[];
}

interface ProviderRateDetails {
  cryptoAmount: number | null;
  rawRate: number | null;
}

function hasUsableProviderRate(
  rateDetails: ProviderRateDetails | null | undefined,
) {
  return Boolean(
    rateDetails?.rawRate &&
      rateDetails.rawRate > 0 &&
      rateDetails.cryptoAmount &&
      rateDetails.cryptoAmount > 0,
  );
}

interface ProviderSelectionStepProps {
  asset: string | null;
  networkName: string | null;
  selectedChain?: { name: string } | null;
  amount: string;
  providers: Provider[];
  selectedProviderId: string;
  fiatCurrency: string;
  fiatSymbol: string;
  decimals: number;
  cryptoAmountValue: number;
  paymentMethodLabel: string;
  onSelectProvider: (id: string) => void;
  onContinue: () => void;
  providerRates: Record<string, ProviderRateDetails | null>;
  isRatesLoading: boolean;
  requiresRefundAccount?: boolean;
  country?: string | null;
  onGoHome: () => void;
  onChangeSelection: () => void;
}

export function ProviderSelectionStep({
  asset,
  selectedChain,
  amount,
  providers,
  selectedProviderId,
  onSelectProvider,
  onContinue,
  providerRates,
  isRatesLoading,
  fiatCurrency,
  requiresRefundAccount = false,
  country,
  onGoHome,
  onChangeSelection,
}: ProviderSelectionStepProps) {
  const visibleProviders = isRatesLoading
    ? providers
    : providers.filter((provider) =>
        hasUsableProviderRate(providerRates[provider.id]),
      );
  const visibleProviderCount = visibleProviders.length;
  const selectedProvider = visibleProviders.find(
    (p) => p.id === selectedProviderId,
  );
  const hasValidSelection = selectedProviderId && selectedProvider;
  const selectedProviderRate = selectedProviderId
    ? providerRates[selectedProviderId]
    : null;
  const hasSelectedProviderRate = hasUsableProviderRate(selectedProviderRate);
  const isSelectedRatePending =
    Boolean(hasValidSelection) &&
    (isRatesLoading || selectedProviderRate === undefined);
  const canContinue =
    Boolean(hasValidSelection) && hasSelectedProviderRate && !isRatesLoading;
  const hasNoProviders = !isRatesLoading && providers.length === 0;
  const hasNoLiveRates =
    !isRatesLoading && providers.length > 0 && visibleProviderCount === 0;

  // Track image loading errors per provider
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (providerId: string) => {
    setImageErrors((prev) => ({ ...prev, [providerId]: true }));
  };

  const shouldShowIcon = (provider: Provider) => {
    return imageErrors[provider.id] || !provider.logo;
  };

  // Helper to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-200px)] md:min-h-[500px]">
      <div className="flex-1 overflow-y-auto md:px-0 animate-in fade-in slide-in-from-bottom-4">
        <SummaryPill
          asset={asset}
          selectedChain={selectedChain}
          amount={amount}
          fiatCurrency={fiatCurrency}
        />

        <div className="mt-6 md:mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider">
              Recommended Providers
            </h3>
            <span className="text-[9px] md:text-[10px] text-gray-400">
              {isRatesLoading ? providers.length : visibleProviderCount} options
            </span>
          </div>

          <div className="space-y-3 md:space-y-4">
            {visibleProviders.map((provider) => {
              const rateDetails = providerRates[provider.id];
              const estimatedAmount = rateDetails?.cryptoAmount;
              const rawRate = rateDetails?.rawRate;
              const isLoadingRate = isRatesLoading && rateDetails === undefined;
              const isSelected = selectedProviderId === provider.id;
              const showFallbackIcon = shouldShowIcon(provider);

              return (
                <button
                  key={provider.id}
                  onClick={() => onSelectProvider(provider.id)}
                  className={cn(
                    "cursor-pointer",
                    "w-full p-4 md:p-5 rounded-2xl border transition-all text-left relative",
                    "hover:shadow-md active:scale-[0.99]",
                    isSelected
                      ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                      : "border-black/5 dark:border-white/10 bg-white dark:bg-secondary-60/40 hover:border-primary-60/30",
                  )}
                >
                  {/* Recommended Badge */}
                  {provider.isRecommended && (
                    <div className="absolute -top-2 -right-2">
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] md:text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        Recommended
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-primary-60 to to-secondary-50 dark:from-primary-70/10 dark:to-primary-60/10 flex items-center justify-center overflow-hidden">
                        {!showFallbackIcon ? (
                          <div className="relative w-full h-full">
                            <Image
                              fill
                              src={provider.logo}
                              alt={provider.name}
                              className="object-contain p-1.5 md:p-2"
                              onError={() => handleImageError(provider.id)}
                              sizes="(max-width: 768px) 40px, 48px"
                            />
                          </div>
                        ) : (
                          <Globe className="w-5 h-5 md:w-6 md:h-6 text-primary-60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm md:text-base truncate">
                            {provider.name}
                          </p>
                          {isSelected && (
                            <Check className="w-3 h-3 text-primary-60 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">
                          {provider.deliveryTime}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {isLoadingRate ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                            <span className="text-xs text-gray-400">
                              Estimating...
                            </span>
                          </div>
                        </div>
                      ) : estimatedAmount && estimatedAmount > 0 ? (
                        <>
                          <p className="font-bold text-sm md:text-base text-primary-60">
                            {estimatedAmount?.toFixed(6)} {asset}
                          </p>
                          {rawRate && (
                            <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5">
                              1 {asset} ≈ {formatCurrency(rawRate)}{" "}
                              {fiatCurrency}
                            </p>
                          )}
                          <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5">
                            Fee: {provider.fee}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-sm md:text-base text-gray-400">
                            Rate pending
                          </p>
                          <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5">
                            Fee: {provider.fee}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  {provider.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                      {provider.features.slice(0, 3).map((f) => (
                        <span
                          key={f}
                          className="px-2 py-0.5 bg-gray-100 dark:bg-white/5 rounded-full text-[8px] md:text-[9px] font-medium text-gray-600 dark:text-gray-400"
                        >
                          {f}
                        </span>
                      ))}
                      {provider.features.length > 3 && (
                        <span className="px-2 py-0.5 text-[8px] md:text-[9px] font-medium text-gray-400">
                          +{provider.features.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* No providers message */}
          {(hasNoProviders || hasNoLiveRates) && (
            <div className="rounded-2xl border border-dashed border-black/10 bg-gray-50/80 px-5 py-8 text-center dark:border-white/10 dark:bg-secondary-60/30">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-70/10 text-primary-60">
                {hasNoProviders ? (
                  <MapPin className="h-7 w-7" />
                ) : (
                  <AlertCircle className="h-7 w-7" />
                )}
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">
                {hasNoProviders
                  ? `Purchases are not available in ${country || "this country"} yet`
                  : "No providers have a live rate right now"}
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-gray-500 dark:text-gray-400">
                {hasNoProviders
                  ? "This service is not available for your current residence."
                  : "Try a different amount, asset, or network, then check again."}
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                {hasNoProviders ? (
                  <Button
                    type="button"
                    onClick={onGoHome}
                    variant="flow"
                    size="action"
                    className="w-full max-w-xs text-xs"
                  >
                    <Home className="relative z-10 h-4 w-4" />
                    <span className="relative z-10">Go to home</span>
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                  </Button>
                ) : null}
                {!hasNoProviders ? (
                  <button
                    type="button"
                    onClick={onChangeSelection}
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-primary-60/40 hover:text-primary-60 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
                  >
                    Change asset or network
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Footer with Review Button */}
      {!hasNoProviders && (
      <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t  pt-6 pb-4 px-4 md:px-0 mt-6 border-t border-black/5 dark:border-white/5">
        <div className="max-w-md mx-auto md:max-w-full">
          {/* Selection summary (only when provider selected) */}
          {hasValidSelection && selectedProviderRate && (
            <div className="mb-3 p-3 rounded-xl bg-primary-70/5 border border-primary-60/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  Selected Provider
                </span>
                <span className="font-semibold text-primary-70">
                  {selectedProvider.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-600 dark:text-gray-400">
                  Est. Receive
                </span>
                <span className="font-medium">
                  {selectedProviderRate.cryptoAmount?.toFixed(6)} {asset}
                </span>
              </div>
            </div>
          )}

          <FlowActionFooter
            sticky={false}
            onClick={onContinue}
            disabled={!canContinue}
            buttonClassName={cn(!canContinue && "from-gray-400 to-gray-500")}
            showShimmer={canContinue}
          >
            {!hasValidSelection ? (
              "Select a Provider to Continue"
            ) : isSelectedRatePending ? (
              "Fetching Rate..."
            ) : !hasSelectedProviderRate ? (
              "Rate Unavailable"
            ) : (
              <>
                {requiresRefundAccount ? "Select Bank" : "Review Order"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </FlowActionFooter>

          {/* Help text */}
          <p className="text-center text-[10px] md:text-xs text-gray-400 mt-3">
            Comparing live rates from{" "}
            {isRatesLoading ? providers.length : visibleProviderCount} providers
            • Best rate will be applied
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
