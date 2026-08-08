"use client";

import { ArrowRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import CountrySelectorButton from "@/components/wallet/shared/CountrySelectorButton";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import AssetNetworkDisplay from "@/components/wallet/shared/AssetNetworkDisplay";
import FlowEmptyState from "@/components/wallet/shared/FlowEmptyState";
import type { WithdrawableAsset } from "@/lib/withdraw-assets";

interface AssetSelectionStepProps {
  asset: string | null;
  networkId: string | null;
  country: string | null;
  isDetectingCountry: boolean;
  assets: WithdrawableAsset[];
  onSelectAsset: (asset: WithdrawableAsset) => void;
  onOpenCountryModal: () => void;
  onBackToWallet: () => void;
  onContinue: () => void;
}

export function WithdrawAssetSelectionStep({
  asset,
  networkId,
  country,
  isDetectingCountry,
  assets,
  onSelectAsset,
  onOpenCountryModal,
  onBackToWallet,
  onContinue,
}: AssetSelectionStepProps) {
  const hasValidSelection = Boolean(asset && networkId);

  return (
    <div className="flex h-full min-h-[calc(100dvh-200px)] flex-col md:min-h-[500px]">
      <div className="flex-1 overflow-y-auto md:px-0">
        <div className="mb-8 flex justify-center">
          <CountrySelectorButton
            country={country}
            isDetecting={isDetectingCountry}
            onClick={onOpenCountryModal}
          />
        </div>

        <section className="mb-8">
          <h3 className="mb-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Available Assets
          </h3>
          {assets.length > 0 ? (
            <div className="space-y-3">
              {assets.map((item) => {
                const isSelected =
                  asset === item.symbol && networkId === item.network.id;

                return (
                  <button
                    key={`${item.symbol}:${item.network?.id || item.network?.name || "unknown"}`}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectAsset(item)}
                    className={cn(
                      "cursor-pointer",
                      "w-full overflow-hidden rounded-2xl border p-4 text-left transition-all",
                      isSelected
                        ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                        : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <AssetNetworkDisplay
                        symbol={item.symbol}
                        assetName={item.name}
                        network={item.network?.name}
                        className="flex-1 sm:gap-4"
                        symbolClassName={cn(
                          "font-bold",
                          isSelected
                            ? "text-primary-60"
                            : "text-black dark:text-white",
                        )}
                        detailClassName="text-gray-500"
                      />

                      <div className="max-w-[76px] shrink-0 text-right sm:max-w-none">
                        <p className="truncate text-xs font-bold text-black dark:text-white sm:text-sm">
                          {item.balance.toFixed(4)}
                        </p>
                        <p className="text-xs text-gray-500">
                          ${item.usdValue.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <FlowEmptyState
              className="min-h-[260px] border-black/10 bg-white/70 dark:bg-secondary-50/40"
              icon={<Wallet className="h-6 w-6" />}
              iconClassName="border-0 bg-gray-95 text-gray-30 dark:bg-secondary-60 dark:text-gray-40"
              title="No assets available to withdraw"
              titleClassName="text-base font-bold text-black dark:text-white"
              text="Your withdrawable assets will appear here once your wallet has a balance."
              textClassName="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-40"
              action={
                <button
                  type="button"
                  onClick={onBackToWallet}
                  className="cursor-pointer rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-60/50 dark:text-white dark:hover:bg-secondary-60"
                >
                  Back to Wallet
                </button>
              }
            />
          )}
        </section>
      </div>

      {assets.length > 0 ? (
        <FlowActionFooter
          onClick={onContinue}
          disabled={!hasValidSelection}
          buttonClassName={cn(
            !hasValidSelection && "from-gray-400 to-gray-500",
          )}
          showShimmer={hasValidSelection}
        >
          {!hasValidSelection ? (
            "Select Asset to Continue"
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </FlowActionFooter>
      ) : null}
    </div>
  );
}
