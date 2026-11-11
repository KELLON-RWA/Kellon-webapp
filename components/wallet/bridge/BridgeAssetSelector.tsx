"use client";

import { AssetLogo } from "@/components/invoices/create-invoice/AssetLogo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { getTokenIcon } from "../swap/utils";

interface BridgeAssetSelectorProps {
  value: "USDC" | "USDT";
  onChange: (value: "USDC" | "USDT") => void;
  disabled?: boolean;
}

export function BridgeAssetSelector({
  value,
  onChange,
  disabled = false,
}: BridgeAssetSelectorProps) {
  return (
    <div className="shrink-0">
      <Select
        value={value}
        onValueChange={(val) => onChange(val as "USDC" | "USDT")}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label="Select asset"
          className="h-9 shrink-0 gap-1 rounded-xl border-black/5 bg-white px-2 text-black shadow-xs transition-all hover:bg-gray-50 focus:border-primary-60 focus:ring-1 focus:ring-primary-60/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:hover:bg-secondary-60/80 [&>svg]:ml-0.5 cursor-pointer"
        >
          <span className="flex items-center gap-1.5 text-left">
            <AssetLogo src={getTokenIcon(value)} symbol={value} size="sm" />
            <span className="text-xs font-bold text-black dark:text-white">
              {value}
            </span>
          </span>
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-black/10 bg-white p-1.5 text-black shadow-xl dark:border-white/10 dark:bg-secondary-50 dark:text-white">
          <SelectItem
            value="USDC"
            className="min-h-11 rounded-xl border border-transparent py-2 pl-2.5 pr-2.5 focus:border-black/5 focus:bg-gray-50 dark:focus:border-white/10 dark:focus:bg-secondary-60/50 cursor-pointer [&>span:first-child]:hidden [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
          >
            <span className="flex items-center gap-2.5">
              <AssetLogo src={getTokenIcon("USDC")} symbol="USDC" size="sm" />
              <span className="text-sm font-bold text-black dark:text-white">
                USDC
              </span>
            </span>
          </SelectItem>
          <SelectItem
            value="USDT"
            className="min-h-11 rounded-xl border border-transparent py-2 pl-2.5 pr-2.5 focus:border-black/5 focus:bg-gray-50 dark:focus:border-white/10 dark:focus:bg-secondary-60/50 cursor-pointer [&>span:first-child]:hidden [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
          >
            <span className="flex items-center gap-2.5">
              <AssetLogo src={getTokenIcon("USDT")} symbol="USDT" size="sm" />
              <span className="text-sm font-bold text-black dark:text-white">
                USDT
              </span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export { BridgeAssetSelector as ConvertAssetSelector };
