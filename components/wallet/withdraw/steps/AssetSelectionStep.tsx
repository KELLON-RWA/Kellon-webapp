"use client";

import { useEffect, useMemo } from "react";
import { ArrowRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import CountrySelectorButton from "@/components/wallet/shared/CountrySelectorButton";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import FlowEmptyState from "@/components/wallet/shared/FlowEmptyState";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import ChainIcon from "@/components/wallet/ChainIcon";
import { getChainLabel } from "@/lib/chains";
import { formatAssetAmount } from "@/components/wallet/send/send-utils";
import {
  groupWithdrawableAssets,
  type WithdrawableAsset,
  type WithdrawableAssetGroup,
} from "@/lib/withdraw-assets";
import WithdrawNetworkPicker from "./WithdrawNetworkPicker";

interface AssetSelectionStepProps {
  asset: string | null;
  networkId: string | null;
  country: string | null;
  isDetectingCountry: boolean;
  assets: WithdrawableAsset[];
  onSelectAssetGroup: (symbol: string) => void;
  onSelectAsset: (asset: WithdrawableAsset) => void;
  onOpenCountryModal: () => void;
  onBackToWallet: () => void;
  onContinue: () => void;
}

function preferredNetwork(group: WithdrawableAssetGroup): WithdrawableAsset {
  return group.assets.reduce((best, asset) =>
    asset.balance > best.balance ? asset : best,
  );
}

export function WithdrawAssetSelectionStep({
  asset,
  networkId,
  country,
  isDetectingCountry,
  assets,
  onSelectAssetGroup,
  onSelectAsset,
  onOpenCountryModal,
  onBackToWallet,
  onContinue,
}: AssetSelectionStepProps) {
  const assetGroups = useMemo(() => groupWithdrawableAssets(assets), [assets]);

  const activeGroup =
    assetGroups.find((group) => group.symbol === asset) || assetGroups[0];

  const selectedNetwork =
    activeGroup && asset === activeGroup.symbol
      ? activeGroup.assets.find((item) => item.network.id === networkId) ||
        preferredNetwork(activeGroup)
      : activeGroup
        ? preferredNetwork(activeGroup)
        : null;

  // Auto-select initial preferred asset & network if not yet selected
  useEffect(() => {
    if (activeGroup && selectedNetwork && (!asset || !networkId)) {
      onSelectAsset(selectedNetwork);
    }
  }, [activeGroup, selectedNetwork, asset, networkId, onSelectAsset]);

  const hasValidSelection = Boolean(
    asset &&
      networkId &&
      assets.some(
        (a) => a.symbol === asset && a.network.id === networkId,
      ),
  );

  return (
    <div className="flex h-full min-h-[calc(100dvh-200px)] flex-col md:min-h-[500px]">
      <div className="flex-1 overflow-y-auto md:px-0">
        <div className="mb-6 flex justify-center">
          <CountrySelectorButton
            country={country}
            isDetecting={isDetectingCountry}
            onClick={onOpenCountryModal}
          />
        </div>

        {assets.length === 0 ? (
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
        ) : (
          <div className="flex min-w-0 flex-col gap-5">
            <div>
              <p className="mb-2 text-xs font-light capitalize text-gray-500 dark:text-gray-400">
                Withdraw from
              </p>
              <div
                className={cn(
                  "grid gap-3",
                  assetGroups.length === 1
                    ? "grid-cols-1"
                    : assetGroups.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3",
                )}
              >
                {assetGroups.map((group) => {
                  const isSelected = group.symbol === activeGroup?.symbol;

                  return (
                    <button
                      key={group.symbol}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        onSelectAssetGroup(group.symbol);
                        onSelectAsset(preferredNetwork(group));
                      }}
                      className={cn(
                        "flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                        isSelected
                          ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                          : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
                      )}
                    >
                      <AssetNetworkIcon symbol={group.symbol} />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate text-sm font-bold",
                            isSelected
                              ? "text-primary-60"
                              : "text-black dark:text-white",
                          )}
                        >
                          {group.symbol}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-gray-500">
                          {formatAssetAmount(group.balance)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeGroup && selectedNetwork ? (
              <div className="pt-1">
                <label className="mb-2 block text-xs font-light capitalize text-gray-500 dark:text-gray-400">
                  Network
                </label>

                {activeGroup.isMultiChain ? (
                  <WithdrawNetworkPicker
                    symbol={activeGroup.symbol}
                    networks={activeGroup.assets}
                    selectedNetwork={selectedNetwork}
                    onSelectNetwork={onSelectAsset}
                  />
                ) : (
                  <div className="flex h-14 items-center gap-3 rounded-xl border border-black/5 bg-gray-95 px-3 dark:border-white/10 dark:bg-secondary-60">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                      <ChainIcon
                        name={selectedNetwork.network.name}
                        size={28}
                        className="!h-7 !w-7 shrink-0"
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-black dark:text-white">
                      {getChainLabel(selectedNetwork.network.name)}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {formatAssetAmount(selectedNetwork.balance)} {activeGroup.symbol}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
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
