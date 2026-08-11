// hooks/use-provider-rates.ts
import { useEffect, useRef, useState } from "react";
import { providerService } from "@/services/api/payment-providers";

interface ProviderRateDetails {
  cryptoAmount: number | null; // Calculated crypto amount
  fiatAmount: number | null; // Calculated fiat amount
  rawRate: number | null; // Raw rate from backend
}

type ProviderRatesMap = Record<string, ProviderRateDetails | null>;

const RATE_FETCH_DEBOUNCE_MS = 450;

interface UseProviderRatesParams {
  providers: { id: string; name: string }[];
  asset: string | null;
  amount: number;
  currency: string | null;
  networkName: string | null;
  isAmountValid: boolean;
  isLoadingProviders: boolean;
  side?: "buy" | "sell";
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useProviderRates({
  providers,
  asset,
  amount,
  currency,
  networkName,
  isAmountValid,
  isLoadingProviders,
  side = "buy",
}: UseProviderRatesParams) {
  const [rates, setRates] = useState<ProviderRatesMap>({});
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (
      isLoadingProviders ||
      !isAmountValid ||
      !asset ||
      !currency ||
      !networkName ||
      providers.length === 0
    ) {
      if (Object.keys(rates).length > 0) setRates({});
      setIsLoadingRates(false);
      return;
    }

    let isCancelled = false;
    const abortController = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoadingRates(true);
    setRates({});

    const fetchRates = async () => {
      const newRates: ProviderRatesMap = {};

      try {
        const ratePromises = providers.map(async (provider) => {
          try {
            let cryptoAmount: number | null = null;
            let fiatAmount: number | null = null;
            let rawRate: number | null = null;

            if (provider.name.toLowerCase() === "paycrest") {
              // Paycrest's amount parameter is denominated in the token, while
              // the buy flow amount is fiat. Fetch a one-token base rate and
              // calculate the user's fiat quote locally, as the mobile app does.
              const paycrestQuoteAmount = side === "buy" ? 1 : amount;
              const res = await providerService.getPaycrestRate(
                {
                  token: asset,
                  amount: paycrestQuoteAmount,
                  currency: currency,
                  network: networkName,
                  side,
                },
                abortController.signal,
              );

              const paycrestRate =
                parseNumber(res.data?.rate) ??
                parseNumber(res.data?.price) ??
                parseNumber(res.data?.data?.rate) ??
                parseNumber(res.data?.data?.price) ??
                parseNumber(
                  side === "sell" ? res.data?.sell?.rate : res.data?.buy?.rate,
                ) ??
                parseNumber(
                  side === "sell"
                    ? res.data?.sell?.price
                    : res.data?.buy?.price,
                );

              if (res.success && paycrestRate) {
                rawRate = paycrestRate;
                if (rawRate > 0) {
                  if (side === "sell") {
                    cryptoAmount = amount;
                    fiatAmount =
                      parseNumber(res.data?.receiveAmount) ??
                      parseNumber(res.data?.fiatAmount) ??
                      amount * rawRate;
                  } else {
                    cryptoAmount = amount / rawRate;
                    fiatAmount = amount;
                  }
                }
              }
            } else if (provider.name.toLowerCase() === "centiiv") {
              const res = await providerService.getCentiivQuote(
                {
                  fromAsset: side === "sell" ? asset : currency,
                  toAsset: side === "sell" ? currency || "USD" : asset,
                  amount,
                  network: networkName ?? undefined,
                },
                abortController.signal,
              );

              if (res.success) {
                rawRate = res.data?.rate ? parseFloat(res.data.rate) : null;
                const estimatedAmount = res.data?.estimatedReceivableAmount
                  ? parseFloat(res.data.estimatedReceivableAmount)
                  : null;

                if (side === "sell") {
                  cryptoAmount = amount;
                  fiatAmount = estimatedAmount;
                } else {
                  cryptoAmount = estimatedAmount;
                  fiatAmount = amount;
                }
              }
            }

            newRates[provider.id] =
              cryptoAmount !== null || fiatAmount !== null || rawRate !== null
                ? { cryptoAmount, fiatAmount, rawRate }
                : null;
          } catch (error) {
            if (isAbortError(error)) return;

            console.error(`Failed to fetch rate for ${provider.name}:`, error);
            newRates[provider.id] = null;
          }
        });

        await Promise.all(ratePromises);
        if (!isCancelled && requestIdRef.current === requestId) {
          setRates(newRates);
        }
      } catch (error) {
        if (isAbortError(error)) return;

        console.error("Error fetching provider rates:", error);
      } finally {
        if (!isCancelled && requestIdRef.current === requestId) {
          setIsLoadingRates(false);
        }
      }
    };

    const debounceTimer = window.setTimeout(() => {
      fetchRates();
    }, RATE_FETCH_DEBOUNCE_MS);

    return () => {
      isCancelled = true;
      window.clearTimeout(debounceTimer);
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    providers,
    asset,
    amount,
    currency,
    networkName,
    isAmountValid,
    isLoadingProviders,
    side,
  ]);

  return { rates, isLoadingRates };
}
