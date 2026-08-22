"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import ChainIcon from "@/components/wallet/ChainIcon";
import AssetNetworkDisplay from "@/components/wallet/shared/AssetNetworkDisplay";
import FlowEmptyState from "@/components/wallet/shared/FlowEmptyState";
import { getChainLabel } from "@/lib/chains";
import { cn } from "@/lib/utils";
import type { SendableAsset } from "./send-types";
import {
  formatAssetAmount,
  groupSendableAssets,
} from "./send-utils";

interface AssetStepProps {
  sendableAssets: SendableAsset[];
  selectedAsset: SendableAsset | null;
  onSelectAsset: (assetKey: string) => void;
  onOpenAddFunds: () => void;
}

export default function AssetStep({
  sendableAssets,
  selectedAsset,
  onSelectAsset,
  onOpenAddFunds,
}: AssetStepProps) {
  const groups = useMemo(
    () => groupSendableAssets(sendableAssets),
    [sendableAssets],
  );
  const selectedGroup = groups.find(
    (group) => group.symbol === selectedAsset?.symbol && group.isMultiChain,
  );
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(
    selectedGroup?.symbol || null,
  );

  useEffect(() => {
    if (selectedGroup) setExpandedSymbol(selectedGroup.symbol);
  }, [selectedGroup]);

  if (!sendableAssets.length) {
    return (
      <FlowEmptyState
        className="h-full md:min-h-[300px]"
        icon={<Wallet className="h-6 w-6" />}
        title="No sendable assets"
        titleClassName="text-base font-semibold text-black dark:text-white"
        text="Syncing your wallet assets. If you recently deposited, wait a moment and try again."
        textClassName="mt-1 max-w-xs text-sm text-gray-20 dark:text-gray-40"
        action={
          <Button
            type="button"
            onClick={onOpenAddFunds}
            className="h-11 rounded-xl bg-primary-50 px-5 text-sm font-bold text-white hover:bg-primary-60"
          >
            Add Funds
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      {groups.map((group) => {
        if (group.isMultiChain) {
          const isExpanded = expandedSymbol === group.symbol;
          const selectedNetwork =
            selectedAsset?.symbol === group.symbol ? selectedAsset : null;
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
                }}
                className={cn(
                  "w-full cursor-pointer rounded-2xl border p-4 text-left transition-all",
                  isExpanded || selectedNetwork
                    ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                    : "border-black/5 bg-gray-95 dark:border-white/10 dark:bg-secondary-60/25",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <AssetNetworkIcon
                      symbol={group.symbol}
                      network={selectedNetwork?.chain}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-black dark:text-white">
                        {group.symbol}
                      </p>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {group.name} • {group.assets.length} networks
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold text-black dark:text-white">
                      {formatAssetAmount(group.balance)}
                    </span>
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
                    value={selectedNetwork?.key || ""}
                    onValueChange={onSelectAsset}
                  >
                    <SelectTrigger className="h-14 rounded-xl border-black/5 bg-white px-3 dark:border-white/10 dark:bg-secondary-60">
                      {selectedNetwork ? (
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <ChainIcon name={selectedNetwork.chain} size={28} />
                          <span className="truncate text-sm font-semibold">
                            {getChainLabel(selectedNetwork.chain)}
                          </span>
                          <span className="ml-auto text-xs text-gray-500">
                            {formatAssetAmount(selectedNetwork.amount)} {group.symbol}
                          </span>
                        </span>
                      ) : (
                        <SelectValue placeholder="Choose network" />
                      )}
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl p-1.5">
                      {group.assets.map((asset) => (
                        <SelectItem
                          key={asset.key}
                          value={asset.key}
                          className="min-h-14 rounded-xl [&>span:first-child]:hidden [&>span:last-child]:w-full"
                        >
                          <span className="flex w-full items-center gap-3">
                            <ChainIcon name={asset.chain} size={28} />
                            <span className="truncate text-sm font-semibold">
                              {getChainLabel(asset.chain)}
                            </span>
                            <span className="ml-auto text-xs text-gray-500">
                              {formatAssetAmount(asset.amount)} {group.symbol}
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

        const asset = group.assets[0];
        const isSelected = asset.key === selectedAsset?.key;
        return (
          <button
            key={asset.key}
            type="button"
            onClick={() => {
              setExpandedSymbol(null);
              onSelectAsset(asset.key);
            }}
            className={cn(
              "flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 text-left transition",
              isSelected
                ? "border-primary-70 bg-primary-99 dark:bg-primary-70/10"
                : "border-gray-80 bg-gray-95 dark:border-white/10 dark:bg-secondary-60/25",
            )}
          >
            <AssetNetworkDisplay
              symbol={asset.symbol}
              assetName={asset.name}
              network={asset.chain}
              className="flex-1"
            />
            <span className="shrink-0 text-sm font-semibold">
              {formatAssetAmount(asset.amount)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
