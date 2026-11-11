"use client";

import ChainIcon from "@/components/wallet/ChainIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SupportedChainKeys } from "@/lib/chains";

export interface NetworkOption {
  chainKey: string;
  chainName: string;
  balance?: number;
}

interface BridgeNetworkSelectorProps {
  value: string;
  options: NetworkOption[];
  onChange: (chainKey: string) => void;
  showBalance?: boolean;
  disabled?: boolean;
}

export function BridgeNetworkSelector({
  value,
  options,
  onChange,
  showBalance = false,
  disabled = false,
}: BridgeNetworkSelectorProps) {
  const selected = options.find((item) => item.chainKey === value);

  return (
    <div className="min-w-0 w-full min-[320px]:w-auto min-[320px]:shrink-0">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          aria-label="Select network"
          className="h-9 w-auto min-w-[95px] max-w-[130px] rounded-xl border-black/5 bg-white px-2 text-black shadow-xs transition-all hover:bg-gray-50 focus:border-primary-60 focus:ring-1 focus:ring-primary-60/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:hover:bg-secondary-60/80 [&>svg]:ml-0.5 cursor-pointer"
        >
          {selected ? (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <ChainIcon
                  name={selected.chainKey as SupportedChainKeys}
                  size={18}
                  className="!h-4.5 !w-4.5 shrink-0"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  {selected.chainName}
                </span>
              </span>
            </span>
          ) : (
            <SelectValue placeholder="Select network" />
          )}
        </SelectTrigger>
        <SelectContent className="max-h-72 rounded-2xl border-black/10 bg-white p-1.5 text-black shadow-xl dark:border-white/10 dark:bg-secondary-50 dark:text-white">
          {options.map((opt) => (
            <SelectItem
              key={opt.chainKey}
              value={opt.chainKey}
              className="min-h-11 rounded-xl border border-transparent py-2 pl-2.5 pr-2.5 focus:border-black/5 focus:bg-gray-50 dark:focus:border-white/10 dark:focus:bg-secondary-60/50 cursor-pointer [&>span:first-child]:hidden [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <ChainIcon
                      name={opt.chainKey as SupportedChainKeys}
                      size={20}
                      className="!h-5 !w-5 shrink-0"
                    />
                  </span>
                  <span className="truncate text-sm font-semibold text-black dark:text-white">
                    {opt.chainName}
                  </span>
                </div>
                {showBalance && typeof opt.balance === "number" && opt.balance > 0 ? (
                  <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {new Intl.NumberFormat("en-US", {
                      maximumFractionDigits: 4,
                    }).format(opt.balance)}
                  </span>
                ) : null}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export { BridgeNetworkSelector as ConvertNetworkSelector };
