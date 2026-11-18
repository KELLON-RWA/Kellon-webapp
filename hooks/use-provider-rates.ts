// hooks/use-provider-rates.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveChainKey } from "@/lib/chains";
import { providerService } from "@/services/api/payment-providers";

interface ProviderRateDetails {
  quoteId?: string;
  expiresAt?: string;
  maxCryptoDebit?: string;
  cryptoAmount: number | null; // Calculated crypto amount
  fiatAmount: number | null; // Calculated fiat amount
  rawRate: number | null; // Raw rate from backend
  routeProvider?: string; // For an aggregator: the partner the route settles through
  fee?: number | string | null;
  feeCurrency?: string | null;
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
  const [revision, setRevision] = useState(0);
  const refreshQuotes = useCallback(
    () => setRevision((value) => value + 1),
    [],
  );

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
            let quoteId: string | undefined;
            let expiresAt: string | undefined;
            let maxCryptoDebit: string | undefined;
            let routeProvider: string | undefined;
            let fee: number | string | null = null;
            let feeCurrency: string | undefined;

            const providerKey = (provider.name || "").toLowerCase().replace(/[\s_-]+/g, "");
            const providerId = (provider.id || "").toLowerCase();
            const isPaycrest = providerKey.includes("paycrest") || providerId.includes("paycrest");
            const isRamphub = providerKey.includes("ramphub") || providerId.includes("ramphub");
            const isCentiiv = providerKey.includes("centiiv") || providerId.includes("centiiv");

            if (isPaycrest) {
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

              console.log("[useProviderRates] Paycrest rate response:", res);

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

              quoteId = res.data?.quoteId;
              expiresAt = res.data?.expiresAt;
              maxCryptoDebit = res.data?.maxCryptoDebit;
              fee = parseNumber(res.data?.fees);
              feeCurrency = res.data?.feeCurrency;
              if (res.success && paycrestRate) {
                rawRate = paycrestRate;
                if (rawRate > 0) {
                  if (side === "sell") {
                    cryptoAmount = amount;
                    fiatAmount =
                      parseNumber(res.data?.receiveAmount) ??
                      parseNumber(res.data?.fiatAmount) ??
                      null;
                  } else {
                    cryptoAmount = amount / rawRate;
                    fiatAmount = amount;
                  }
                }
              }
            } else if (isRamphub) {
              const cleanNetwork = (
                getActiveChainKey(networkName) ||
                networkName ||
                ""
              ).toLowerCase();
              const res = await providerService.getRamphubQuote(
                {
                  token: asset,
                  amount,
                  currency,
                  network: cleanNetwork,
                  side,
                },
                abortController.signal,
              );

              console.log("[useProviderRates] Ramphub quote response:", res);

              const rawPayload = res.data as unknown as Record<string, unknown> | undefined;
              const quoteData = (
                rawPayload?.data && typeof rawPayload.data === "object"
                  ? { ...rawPayload, ...(rawPayload.data as Record<string, unknown>) }
                  : rawPayload
              ) as Record<string, unknown> | undefined;

              const isRejected = quoteData?.available === false;
              if (res.success && quoteData && !isRejected) {
                quoteId = (quoteData.quoteId as string) || (quoteData.id as string) || undefined;
                expiresAt = quoteData.expiresAt as string | undefined;
                maxCryptoDebit = quoteData.maxCryptoDebit as string | undefined;
                routeProvider = (quoteData.provider as string) || (quoteData.routeProvider as string) || undefined;

                const extractedRate =
                  parseNumber(quoteData.rate) ??
                  parseNumber(quoteData.price) ??
                  parseNumber(quoteData.exchangeRate) ??
                  parseNumber(quoteData.unitRate);

                rawRate = extractedRate;

                fee =
                  parseNumber(quoteData.fees) ??
                  parseNumber(quoteData.fee) ??
                  null;
                feeCurrency = quoteData.feeCurrency as string | undefined;

                const recAmount =
                  parseNumber(quoteData.receiveAmount) ??
                  parseNumber(quoteData.receivedAmount) ??
                  parseNumber(quoteData.cryptoAmount) ??
                  parseNumber(quoteData.destinationAmount);

                const fAmount =
                  parseNumber(quoteData.fiatAmount) ??
                  parseNumber(quoteData.amount) ??
                  parseNumber(quoteData.sourceAmount);

                if (side === "sell") {
                  cryptoAmount = amount;
                  fiatAmount =
                    recAmount ??
                    fAmount ??
                    (rawRate && rawRate > 0 ? amount * rawRate : null);
                } else {
                  cryptoAmount =
                    recAmount ??
                    (rawRate && rawRate > 0 ? amount / rawRate : null);
                  fiatAmount = fAmount ?? amount;
                }

                if (!rawRate && cryptoAmount && cryptoAmount > 0 && fiatAmount && fiatAmount > 0) {
                  rawRate = fiatAmount / cryptoAmount;
                }
              }
            } else if (isCentiiv) {
              const res = await providerService.getCentiivQuote(
                {
                  fromAsset: side === "sell" ? asset : currency,
                  toAsset: side === "sell" ? currency || "USD" : asset,
                  amount,
                  network: networkName ?? undefined,
                },
                abortController.signal,
              );

              console.log("[useProviderRates] Centiiv quote response:", res);

              quoteId = res.data?.quoteId;
              expiresAt = res.data?.expiresAt;
              maxCryptoDebit = res.data?.maxCryptoDebit;
              fee =
                parseNumber(res.data?.fees) ??
                (res.data?.fees ? String(res.data.fees) : null);
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
                ? {
                    cryptoAmount,
                    fiatAmount,
                    rawRate,
                    quoteId,
                    expiresAt,
                    maxCryptoDebit,
                    routeProvider,
                    fee,
                    feeCurrency,
                  }
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
    revision,
  ]);

  const applyQuote = useCallback(
    (providerId: string, details: Partial<ProviderRateDetails>) => {
      // Invalidate any in-flight response that could overwrite this newer backend quote.
      requestIdRef.current += 1;
      setIsLoadingRates(false);
      setRates((prev) => ({
        ...prev,
        [providerId]: {
          cryptoAmount: null,
          fiatAmount: null,
          rawRate: null,
          ...(prev[providerId] ?? {}),
          ...details,
        },
      }));
    },
    [],
  );

  return { rates, isLoadingRates, refreshQuotes, applyQuote };
}
