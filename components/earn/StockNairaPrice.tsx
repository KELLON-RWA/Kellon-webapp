"use client";

import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { formatCurrencyAmount } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

interface StockNairaPriceProps {
  usdPrice: number;
  className?: string;
}

export default function StockNairaPrice({
  usdPrice,
  className,
}: StockNairaPriceProps) {
  const { exchangeRate, isRateLoading } = useExchangeRate("NGN", null);

  if (isRateLoading || exchangeRate <= 0 || !Number.isFinite(usdPrice)) {
    return (
      <p className={cn("text-xs text-gray-30 dark:text-gray-40", className)}>
        Converting to NGN...
      </p>
    );
  }

  return (
    <p
      className={cn(
        "text-sm font-medium tabular-nums text-gray-30 dark:text-gray-40",
        className,
      )}
    >
      Approximately {formatCurrencyAmount(usdPrice * exchangeRate, "NGN")}
    </p>
  );
}
