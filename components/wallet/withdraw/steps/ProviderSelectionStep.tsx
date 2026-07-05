"use client"

import { AlertCircle, ArrowRight, Check, Globe, Loader2 } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"
import SummaryPill from "@/components/wallet/shared/FlowSummaryPill"
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter"

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
              Available Providers
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

          {!isRatesLoading && visibleProviderCount === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-secondary-60/40">
                <AlertCircle className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {providers.length === 0
                  ? "No sell providers available"
                  : "No providers with live rates"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Try another asset, network, or country.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <FlowActionFooter
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
      </FlowActionFooter>
    </div>
  )
}
