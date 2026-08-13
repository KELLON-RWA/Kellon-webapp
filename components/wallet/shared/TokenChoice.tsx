import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetLogo } from "@/components/invoices/create-invoice/AssetLogo";

interface TokenChoiceProps {
  symbol: string;
  name: string;
  iconUrl: string;
  selected: boolean;
  onClick: () => void;
}

export default function TokenChoice({
  symbol,
  name,
  iconUrl,
  selected,
  onClick,
}: TokenChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-all",
        selected
          ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
          : "border-black/5 bg-gray-95 text-gray-600 hover:text-black dark:border-white/10 dark:bg-secondary-50 dark:text-gray-400 dark:hover:bg-secondary-60/50 dark:hover:text-white",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <AssetLogo src={iconUrl} symbol={symbol} />
        <span className="min-w-0">
          <span
            className={cn(
              "block text-sm font-bold",
              selected && "text-primary-60",
            )}
          >
            {symbol}
          </span>
          <span className="block truncate text-xs opacity-70">{name}</span>
        </span>
      </span>

      {selected ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-70" />
      ) : null}
    </button>
  );
}
