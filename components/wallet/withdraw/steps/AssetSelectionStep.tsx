"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import CountrySelectorButton from "@/components/wallet/shared/CountrySelectorButton";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import AssetNetworkDisplay from "@/components/wallet/shared/AssetNetworkDisplay";
import FlowEmptyState from "@/components/wallet/shared/FlowEmptyState";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import ChainIcon from "@/components/wallet/ChainIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  groupWithdrawableAssets,
  type WithdrawableAsset,
} from "@/lib/withdraw-assets";

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
  const selectedMultiChainGroup = assetGroups.find(
    (group) => group.isMultiChain && group.symbol === asset,
  );
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(
    selectedMultiChainGroup?.symbol || null,
  );

  useEffect(() => {
    if (selectedMultiChainGroup) {
      setExpandedSymbol(selectedMultiChainGroup.symbol);
    }
  }, [selectedMultiChainGroup]);

  const expandedGroup = assetGroups.find(
    (group) => group.isMultiChain && group.symbol === expandedSymbol,
  );
  const selectionMatchesExpandedGroup =
    !expandedGroup ||
    (asset === expandedGroup.symbol &&
      expandedGroup.assets.some((item) => item.network.id === networkId));
  const hasValidSelection = Boolean(
    asset && networkId && selectionMatchesExpandedGroup,
  );

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
              {assetGroups.map((group) => {
                if (group.isMultiChain) {
                  const isExpanded = expandedSymbol === group.symbol;
                  const selectedNetwork =
                    asset === group.symbol
                      ? group.assets.find(
                          (item) => item.network.id === networkId,
                        )
                      : undefined;
                  const isSelected = Boolean(selectedNetwork);

                  return (
                    <div key={group.symbol} className="space-y-2">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => {
                          if (isExpanded && !selectedNetwork) {
                            setExpandedSymbol(null);
                            return;
                          }
                          setExpandedSymbol(group.symbol);
                          if (asset !== group.symbol) {
                            onSelectAssetGroup(group.symbol);
                          }
                        }}
                        className={cn(
                          "w-full cursor-pointer overflow-hidden rounded-2xl border p-4 text-left transition-all",
                          isExpanded || isSelected
                            ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                            : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                            <AssetNetworkIcon
                              symbol={group.symbol}
                              network={selectedNetwork?.network.name}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "truncate text-sm font-bold",
                                  isExpanded || isSelected
                                    ? "text-primary-60"
                                    : "text-black dark:text-white",
                                )}
                              >
                                {group.symbol}
                              </p>
                              <p className="mt-1 truncate text-xs text-gray-500">
                                {group.name} • {group.assets.length} networks
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <div className="max-w-[76px] text-right sm:max-w-none">
                              <p className="truncate text-xs font-bold text-black dark:text-white sm:text-sm">
                                {group.balance.toFixed(4)}
                              </p>
                              <p className="text-xs text-gray-500">
                                ${group.usdValue.toFixed(2)}
                              </p>
                            </div>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-gray-500 transition-transform",
                                isExpanded && "rotate-180",
                              )}
                            />
                          </div>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="rounded-2xl border border-black/5 bg-gray-50 p-3 dark:border-white/10 dark:bg-secondary-50/60">
                          <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                            Select {group.symbol} network
                          </label>
                          <Select
                            value={selectedNetwork?.network.id || ""}
                            onValueChange={(value) => {
                              const nextAsset = group.assets.find(
                                (item) => item.network.id === value,
                              );
                              if (nextAsset) onSelectAsset(nextAsset);
                            }}
                          >
                            <SelectTrigger
                              aria-label={`Select ${group.symbol} network`}
                              className="h-14 w-full rounded-xl border-black/5 bg-white px-3 text-black shadow-none focus:border-primary-60 focus:ring-2 focus:ring-primary-60/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
                            >
                              {selectedNetwork ? (
                                <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                                    <ChainIcon
                                      name={selectedNetwork.network.name}
                                      size={28}
                                      className="!h-7 !w-7 shrink-0"
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                    {selectedNetwork.network.name}
                                  </span>
                                  <span className="ml-auto shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                    {selectedNetwork.balance.toFixed(4)} {group.symbol}
                                  </span>
                                </span>
                              ) : (
                                <SelectValue placeholder="Choose network" />
                              )}
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-black/10 bg-white p-1.5 text-black shadow-xl dark:border-white/10 dark:bg-secondary-50 dark:text-white">
                              {group.assets.map((item) => (
                                <SelectItem
                                  key={item.network.id}
                                  value={item.network.id}
                                  className="min-h-14 rounded-xl py-2.5 pl-3 pr-3 focus:bg-gray-50 dark:focus:bg-secondary-60/50 [&>span:first-child]:hidden [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
                                >
                                  <span className="flex w-full min-w-0 items-center gap-3">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                                      <ChainIcon
                                        name={item.network.name}
                                        size={28}
                                        className="!h-7 !w-7 shrink-0"
                                      />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                      {item.network.name}
                                    </span>
                                    <span className="ml-auto shrink-0 pl-4 text-right text-xs text-gray-500 dark:text-gray-400">
                                      {item.balance.toFixed(4)} {group.symbol}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                const item = group.assets[0];
                const isSelected =
                  asset === item.symbol && networkId === item.network.id;

                return (
                  <button
                    key={`${item.symbol}:${item.network?.id || item.network?.name || "unknown"}`}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setExpandedSymbol(null);
                      onSelectAsset(item);
                    }}
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
