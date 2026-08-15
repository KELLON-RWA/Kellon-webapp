"use client";

import { Eye, EyeOff, Info } from "lucide-react";
import Image from "next/image";
import FlowHeader, {
  FlowHeaderActionButton,
} from "@/components/wallet/shared/FlowHeader";
import { getAssetIcon } from "./asset-details-utils";

interface AssetDetailsHeaderProps {
  symbol: string;
  isBalanceVisible: boolean;
  onBack: () => void;
  onToggleBalance: () => void;
  onOpenInfo: () => void;
}

export function AssetDetailsHeader({
  symbol,
  isBalanceVisible,
  onBack,
  onToggleBalance,
  onOpenInfo,
}: AssetDetailsHeaderProps) {
  return (
    <FlowHeader
      title={
        <span className="flex items-center gap-2">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
            <Image
              src={getAssetIcon(symbol)}
              alt={symbol}
              width={24}
              height={24}
              className="object-contain p-0.5"
            />
          </span>
          <span>{symbol}</span>
        </span>
      }
      headingLevel="h2"
      onBack={onBack}
      rightContent={
        <div className="flex items-center gap-2">
          <FlowHeaderActionButton
            onClick={onToggleBalance}
            aria-label={isBalanceVisible ? "Hide balances" : "Show balances"}
          >
          {isBalanceVisible ? (
            <Eye className="h-5 w-5" />
          ) : (
            <EyeOff className="h-5 w-5" />
          )}
          </FlowHeaderActionButton>
          <FlowHeaderActionButton
            onClick={onOpenInfo}
            aria-label={`About ${symbol}`}
            className="text-primary-60 dark:text-primary-80"
          >
            <Info className="h-5 w-5" />
          </FlowHeaderActionButton>
        </div>
      }
      className="mb-8"
    />
  );
}
