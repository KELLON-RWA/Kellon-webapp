import ChainIcon from "@/components/wallet/ChainIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BridgeAssetOption } from "@/lib/bridge-assets";
import { formatBridgeBalance } from "./utils";

interface NetworkSelectorProps {
  value: string;
  options: BridgeAssetOption[];
  onChange: (value: string) => void;
  showBalance?: boolean;
}

export function NetworkSelector({
  value,
  options,
  onChange,
  showBalance = false,
}: NetworkSelectorProps) {
  const selected = options.find((item) => item.key === value);

  return (
    <div className="min-w-0 w-full min-[320px]:w-auto min-[320px]:shrink-0">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label="Select network"
          className="h-12 w-full min-w-0 max-w-none rounded-2xl border-black/5 bg-gray-95 px-3 text-black shadow-none transition-all hover:bg-gray-90 focus:border-primary-60 focus:ring-2 focus:ring-primary-60/20 min-[320px]:w-[160px] min-[320px]:min-w-[160px] min-[320px]:max-w-[160px] dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:hover:bg-secondary-60/70 [&>svg]:ml-2"
        >
          {selected ? (
            <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <ChainIcon
                  name={selected.chainKey}
                  size={28}
                  className="!h-7 !w-7 shrink-0"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {selected.chainName}
                </span>
              </span>
            </span>
          ) : (
            <SelectValue placeholder="Select network" />
          )}
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-black/10 bg-white p-1.5 text-black shadow-xl dark:border-white/10 dark:bg-secondary-50 dark:text-white">
          {options.map((option) => (
            <SelectItem
              key={option.key}
              value={option.key}
              className="min-h-14 rounded-xl border border-transparent py-2.5 pl-3 pr-3 focus:border-black/5 focus:bg-gray-50 dark:focus:border-white/10 dark:focus:bg-secondary-60/50 [&>span:first-child]:hidden [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
            >
              <span className="flex w-full min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                  <ChainIcon
                    name={option.chainKey}
                    size={28}
                    className="!h-7 !w-7 shrink-0"
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {option.chainName}
                </span>
                {showBalance ? (
                  <span className="ml-auto shrink-0 pl-4 text-right text-xs text-gray-500 dark:text-gray-400">
                    {formatBridgeBalance(option.balance)} {option.symbol}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
