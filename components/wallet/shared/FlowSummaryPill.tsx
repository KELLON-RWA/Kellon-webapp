"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ChainIcon from "@/components/wallet/ChainIcon";

export interface FlowSummaryPillProps {
  asset: string | null;
  assetIconUrl?: string | null;
  selectedChain?: { name?: string | null } | null;
  networkName?: string | null;
  amount?: string | number | null;
  amountCurrency?: string | null;
  fiatAmount?: string | number | null;
  fiatCurrency?: string | null;
  className?: string;
}

function getAssetIconUrl(asset: string) {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${asset.toLowerCase()}.png`;
}

function getChainIconName(chainName: string) {
  const normalizedName = chainName.toLowerCase();

  if (normalizedName.includes("bnb")) return "bnb";
  return chainName
    .replace(/\s+network$/i, "")
    .replace(/\s+smart\s+chain$/i, "");
}

export default function FlowSummaryPill({
  asset,
  assetIconUrl,
  selectedChain,
  networkName,
  amount,
  amountCurrency,
  fiatAmount,
  fiatCurrency,
  className,
}: FlowSummaryPillProps) {
  if (!asset) return null;

  const assetSymbol = asset.toUpperCase();
  const chainName = networkName || selectedChain?.name || null;
  const displayCurrency =
    amountCurrency !== undefined
      ? amountCurrency
      : (fiatAmount ? assetSymbol : fiatCurrency) || null;
  const amountLabel =
    amount !== null && amount !== undefined && amount !== ""
      ? `${amount}${displayCurrency ? ` ${displayCurrency}` : ""}`
      : null;

  return (
    <div
      className={cn(
        "mx-auto mb-3 flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-full border border-black/5 bg-white px-2.5 py-1 text-[11px] backdrop-blur-sm dark:border-white/10 dark:bg-secondary-50 xs:gap-1.5 xs:px-3 xs:py-1.5 sm:mb-6 sm:gap-2 sm:px-4 sm:text-xs md:mb-10 md:max-w-2xl md:gap-3 md:px-5 md:py-2.5 scrollbar-none",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-primary-70/20 blur-sm" />
          <Image
            src={assetIconUrl || getAssetIconUrl(assetSymbol)}
            alt={`${assetSymbol} logo`}
            width={14}
            height={14}
            className="relative h-3.5 w-3.5 rounded-full xs:h-4 xs:w-4 md:h-5 md:w-5"
          />
        </div>
        <span className="whitespace-nowrap font-bold uppercase text-black dark:text-white">
          {assetSymbol}
        </span>
      </div>

      {chainName ? (
        <>
          <ChevronRight className="h-2.5 w-2.5 shrink-0 text-gray-400 sm:h-3 sm:w-3 md:h-4 md:w-4" />
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <ChainIcon name={getChainIconName(chainName)} size={12} className="xs:hidden" />
            <ChainIcon name={getChainIconName(chainName)} size={14} className="hidden xs:inline-flex" />
            <span className="whitespace-nowrap font-medium text-gray-500 dark:text-gray-300">
              {chainName}
            </span>
          </div>
        </>
      ) : null}

      {amountLabel ? (
        <>
          <ChevronRight className="h-2.5 w-2.5 shrink-0 text-gray-400 sm:h-3 sm:w-3 md:h-4 md:w-4" />
          <span className="shrink-0 whitespace-nowrap font-bold text-primary-60">
            {amountLabel}
          </span>
        </>
      ) : null}

      {fiatAmount ? (
        <>
          <ChevronRight className="h-2.5 w-2.5 shrink-0 text-gray-400 sm:h-3 sm:w-3 md:h-4 md:w-4" />
          <span className="shrink-0 whitespace-nowrap font-bold text-primary-60">
            {fiatCurrency ? `${fiatCurrency} ` : ""}{fiatAmount}
          </span>
        </>
      ) : null}
    </div>
  );
}
