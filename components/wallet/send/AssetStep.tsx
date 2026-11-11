"use client";

import { useMemo } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import ChainIcon from "@/components/wallet/ChainIcon";
import FlowEmptyState from "@/components/wallet/shared/FlowEmptyState";
import { getChainLabel } from "@/lib/chains";
import { cn } from "@/lib/utils";
import type { RecipientKind, SendableAsset, SendableAssetGroup } from "./send-types";
import { formatAssetAmount, groupSendableAssets } from "./send-utils";
import NetworkPicker from "./NetworkPicker";

interface AssetStepProps {
  sendableAssets: SendableAsset[];
  selectedAsset: SendableAsset | null;
  recipientKind?: RecipientKind;
  onSelectAsset: (assetKey: string) => void;
  onOpenAddFunds: () => void;
}

function preferredNetwork(
  group: SendableAssetGroup,
  recipientKind?: RecipientKind,
): SendableAsset | null {
  if (!group?.assets || group.assets.length === 0) return null;

  if (recipientKind === "solana") {
    const solanaAsset = group.assets.find(
      (asset) => asset.chain.toLowerCase() === "solana",
    );
    if (solanaAsset) return solanaAsset;
  } else if (recipientKind === "stellar") {
    const stellarAsset = group.assets.find(
      (asset) => asset.chain.toLowerCase() === "stellar",
    );
    if (stellarAsset) return stellarAsset;
  } else if (recipientKind === "evm") {
    const evmAsset = group.assets.find(
      (asset) =>
        asset.chain.toLowerCase() !== "solana" &&
        asset.chain.toLowerCase() !== "stellar",
    );
    if (evmAsset) return evmAsset;
  }

  return group.assets.reduce(
    (best, asset) => (asset.amount > best.amount ? asset : best),
    group.assets[0],
  );
}

export default function AssetStep({
  sendableAssets,
  selectedAsset,
  recipientKind,
  onSelectAsset,
  onOpenAddFunds,
}: AssetStepProps) {
  const groups = useMemo(
    () => groupSendableAssets(sendableAssets),
    [sendableAssets],
  );
  const activeGroup =
    groups.find((group) => group.symbol === selectedAsset?.symbol) ||
    groups[0];
  const selectedNetwork =
    activeGroup && selectedAsset?.symbol === activeGroup.symbol
      ? selectedAsset
      : activeGroup
        ? preferredNetwork(activeGroup, recipientKind)
        : null;

  if (!sendableAssets.length) {
    return (
      <FlowEmptyState
        className="h-full md:min-h-[300px]"
        icon={<Wallet className="h-6 w-6" />}
        title="No sendable assets"
        titleClassName="text-base font-semibold text-black dark:text-white"
        text="Fund your wallet with USDC or USDT before sending."
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
    <div className="flex h-full min-w-0 flex-col gap-5">
      <div>
        <p className="mb-2 text-xs font-light capitalize text-gray-500 dark:text-gray-400">
          Send from
        </p>
        <div
          className={cn(
            "grid gap-3",
            groups.length === 1
              ? "grid-cols-1"
              : groups.length === 2
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3",
          )}
        >
          {groups.map((group) => {
            const isSelected = group.symbol === activeGroup?.symbol;

            return (
              <button
                key={group.symbol}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  const preferred = preferredNetwork(group, recipientKind);
                  if (preferred?.key) onSelectAsset(preferred.key);
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
            <NetworkPicker
              symbol={activeGroup.symbol}
              networks={activeGroup.assets}
              selectedNetwork={selectedNetwork}
              onSelectNetwork={onSelectAsset}
            />
          ) : (
            <div className="flex h-14 items-center gap-3 rounded-xl border border-black/5 bg-gray-95 px-3 dark:border-white/10 dark:bg-secondary-60">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <ChainIcon
                  name={selectedNetwork.chain}
                  size={28}
                  className="!h-7 !w-7 shrink-0"
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-black dark:text-white">
                {getChainLabel(selectedNetwork.chain)}
              </span>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {formatAssetAmount(selectedNetwork.amount)} {activeGroup.symbol}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
