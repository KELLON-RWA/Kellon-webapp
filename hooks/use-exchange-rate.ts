import { useEffect, useState } from "react";
import priceService from "@/services/price-service";

export function useExchangeRate(fiatCurrency: string, asset: string | null) {
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  // Start non-USD currencies in a loading state. This lets callers render the
  // known USD value immediately instead of briefly labelling a 1:1 placeholder
  // as the user's local currency.
  const [isLoading, setIsLoading] = useState(
    () => !["USD", "USDC", "USDT"].includes(fiatCurrency.toUpperCase()),
  );

  useEffect(() => {
    const fetchRate = async () => {
      setIsLoading(true);
      try {
        const rate = await priceService.getFiatExchangeRate(fiatCurrency);
        setExchangeRate(rate);
      } catch (err) {
        console.error("Rate update failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRate();
  }, [fiatCurrency, asset]);

  return { exchangeRate, isRateLoading: isLoading };
}
