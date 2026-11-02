import { useEffect, useState } from "react";
import priceService from "@/services/price-service";

export interface UseExchangeRateOptions {
  preferProviderRate?: boolean;
}

export function useExchangeRate(
  fiatCurrency: string,
  asset: string | null,
  options?: UseExchangeRateOptions,
) {
  const preferProviderRate = options?.preferProviderRate ?? false;
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  // Start non-USD currencies in a loading state. This lets callers render the
  // known USD value immediately instead of briefly labelling a 1:1 placeholder
  // as the user's local currency.
  const [isLoading, setIsLoading] = useState(
    () => !["USD", "USDC", "USDT"].includes(fiatCurrency.toUpperCase()),
  );

  useEffect(() => {
    let isCancelled = false;

    const fetchRate = async () => {
      setIsLoading(true);
      try {
        const rate = preferProviderRate
          ? await priceService.getMainWalletExchangeRate(fiatCurrency)
          : await priceService.getFiatExchangeRate(fiatCurrency);
        if (!isCancelled && rate && rate > 0) {
          setExchangeRate(rate);
        }
      } catch (err) {
        console.error("Rate update failed:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };
    fetchRate();

    return () => {
      isCancelled = true;
    };
  }, [fiatCurrency, asset, preferProviderRate]);

  return { exchangeRate, isRateLoading: isLoading };
}
