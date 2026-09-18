"use client"

import { AlertCircle, ArrowRight, Check, Globe, Home, Loader2, MapPin } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"
import SummaryPill from "@/components/wallet/shared/FlowSummaryPill"
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter"
import { Button } from "@/components/ui/button"

interface Provider {
  id: string
  name: string
  logo?: string
  deliveryTime?: string
  fee?: string
  features: string[]
  isRecommended?: boolean
}

interface ProviderSelectionStepProps {
  asset: string | null
  amount: string
  amountUnit: string | null
  fiatCurrency: string
  selectedChain?: { name: string } | null
  providers: Provider[]
  selectedProviderId: string | null
  onSelectProvider: (id: string) => void
  onContinue: () => void
  providerRates: Record<
    string,
    {
      cryptoAmount: number | null
      fiatAmount: number | null
      rawRate: number | null
    } | null
  >
  isRatesLoading: boolean
  country?: string | null
  onGoHome: () => void
  onChangeSelection: () => void
}

function hasUsableProviderRate(
  rateDetails:
    | {
        cryptoAmount: number | null
        fiatAmount: number | null
        rawRate: number | null
      }
    | null
    | undefined,
) {
  return Boolean(
    rateDetails?.rawRate &&
      rateDetails.rawRate > 0 &&
      rateDetails.fiatAmount &&
      rateDetails.fiatAmount > 0,
  )
}

export function WithdrawProviderSelectionStep({
  asset,
  amount,
  amountUnit,
  fiatCurrency,
  selectedChain,
  providers,
  selectedProviderId,
  onSelectProvider,
  onContinue,
  providerRates,
  isRatesLoading,
  country,
  onGoHome,
  onChangeSelection,
}: ProviderSelectionStepProps) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const visibleProviders = isRatesLoading
    ? providers
    : providers.filter((provider) =>
        hasUsableProviderRate(providerRates[provider.id]),
      )
  const visibleProviderCount = visibleProviders.length
  const selectedProvider =
    visibleProviders.find((provider) => provider.id === selectedProviderId) ||
    null
  const selectedProviderRate = selectedProviderId
    ? providerRates[selectedProviderId]
    : null
  const hasSelectedProviderRate = hasUsableProviderRate(selectedProviderRate)
  const isSelectedRatePending =
    Boolean(selectedProvider) &&
    (isRatesLoading || selectedProviderRate === undefined)
  const canContinue =
    Boolean(selectedProvider) && hasSelectedProviderRate && !isRatesLoading
  const hasNoProviders = !isRatesLoading && providers.length === 0
  const hasNoLiveRates =
    !isRatesLoading && providers.length > 0 && visibleProviderCount === 0
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)

  return (
    <div className="flex h-full min-h-[calc(100dvh-200px)] flex-col md:min-h-[500px]">
      <div className="flex-1 overflow-y-auto md:px-0">
        <SummaryPill
          asset={asset}
          selectedChain={selectedChain}
          amount={amount}
          amountCurrency={amountUnit || undefined}
        />

        <div className="mt-6 md:mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 md:text-xs">
              Recommended Providers
            </h3>
            <span className="text-[9px] text-gray-400 md:text-[10px]">
              {isRatesLoading ? providers.length : visibleProviderCount} options
            </span>
          </div>

          <div className="space-y-3 md:space-y-4">
            {visibleProviders.map((provider) => {
              const isSelected = provider.id === selectedProviderId
              const showFallback = imageErrors[provider.id] || !provider.logo
              const rateDetails = providerRates[provider.id]
              const rawRate = rateDetails?.rawRate
              const estimatedFiat = rateDetails?.fiatAmount
              const isLoadingRate = isRatesLoading && rateDetails === undefined

              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => onSelectProvider(provider.id)}
                  className={cn(
                    "cursor-pointer",
                    "relative w-full rounded-2xl border p-4 text-left transition-all hover:shadow-md active:scale-[0.99] md:p-5",
                    isSelected
                      ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                      : "border-black/5 bg-white hover:border-primary-60/30 dark:border-white/10 dark:bg-secondary-60/40",
                  )}
                >
                  {provider.isRecommended ? (
                    <div className="absolute -right-2 -top-2">
                      <div className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[8px] font-bold text-white shadow-lg md:text-[9px]">
                        Recommended
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-60 to-secondary-50 dark:from-primary-70/10 dark:to-primary-60/10 md:h-12 md:w-12">
                        {showFallback ? (
                          <Globe className="h-5 w-5 text-primary-60 md:h-6 md:w-6" />
                        ) : (
                          <Image
                            fill
                            src={provider.logo || ""}
                            alt={provider.name}
                            className="object-contain p-2"
                            onError={() =>
                              setImageErrors((prev) => ({
                                ...prev,
                                [provider.id]: true,
                              }))
                            }
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold md:text-base">
                            {provider.name}
                          </p>
                          {isSelected ? (
                            <Check className="h-3 w-3 shrink-0 text-primary-60" />
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[10px] text-gray-500 md:text-xs">
                          {provider.deliveryTime || "Fast processing"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      {isLoadingRate ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                            <span className="text-xs text-gray-400">
                              Estimating...
                            </span>
                          </div>
                        </div>
                      ) : rawRate && estimatedFiat ? (
                        <>
                          <p className="text-sm font-bold text-primary-60 md:text-base">
                            {formatCurrency(estimatedFiat)} {fiatCurrency}
                          </p>
                          <p className="mt-0.5 text-[9px] text-gray-500 md:text-[10px]">
                            1 {asset} ≈ {formatCurrency(rawRate)} {fiatCurrency}
                          </p>
                          <p className="mt-0.5 text-[9px] text-gray-500 md:text-[10px]">
                            Fee: {provider.fee || "--"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-gray-400 md:text-base">
                            Rate pending
                          </p>
                          <p className="mt-0.5 text-[9px] text-gray-500 md:text-[10px]">
                            Fee: {provider.fee || "--"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {provider.features.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-black/5 pt-3 dark:border-white/5">
                      {provider.features.slice(0, 3).map((feature) => (
                        <span
                          key={feature}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[8px] font-medium text-gray-600 dark:bg-white/5 dark:text-gray-400 md:text-[9px]"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>

          {hasNoProviders || hasNoLiveRates ? (
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
                  ? `Withdrawals are not available in ${country || "this country"} yet`
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
          ) : null}
        </div>
      </div>

      {!hasNoProviders ? <FlowActionFooter
        onClick={onContinue}
        disabled={!canContinue}
        buttonClassName={cn(!canContinue && "from-gray-400 to-gray-500")}
        showShimmer={canContinue}
      >
        {!selectedProvider ? (
          "Select a Provider to Continue"
        ) : isSelectedRatePending ? (
          "Fetching Rate..."
        ) : !hasSelectedProviderRate ? (
          "Rate Unavailable"
        ) : (
          <>
            Select Bank
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </FlowActionFooter> : null}
    </div>
  )
}
