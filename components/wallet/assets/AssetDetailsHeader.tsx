"use client";

import { ArrowLeft, Eye, EyeOff, Info } from "lucide-react";
import Image from "next/image";
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
    <div className="mb-8 flex items-center justify-between px-0 pt-0">
      <button
        type="button"
        onClick={onBack}
        className="cursor-pointer rounded-full border border-slate-200 bg-gray-100 p-2 dark:border-none dark:bg-secondary-60/50"
      >
        <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-white" />
      </button>

      <div className="flex items-center gap-2">
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
          <Image
            src={getAssetIcon(symbol)}
            alt={symbol}
            width={24}
            height={24}
            className="object-contain p-0.5"
          />
        </span>
        <h2 className="text-lg font-bold text-black dark:text-white">
          {symbol}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleBalance}
          aria-label={isBalanceVisible ? "Hide balances" : "Show balances"}
          className="cursor-pointer rounded-full border border-black/5 bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 dark:border-none dark:bg-secondary-60/50 dark:text-gray-300"
        >
          {isBalanceVisible ? (
            <Eye className="h-5 w-5" />
          ) : (
            <EyeOff className="h-5 w-5" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenInfo}
          aria-label={`About ${symbol}`}
          className="cursor-pointer rounded-full border border-primary-60/30 bg-primary-70/10 p-2 text-primary-60 hover:bg-primary-70/15 dark:border-primary-70/50 dark:text-primary-80"
        >
          <Info className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
