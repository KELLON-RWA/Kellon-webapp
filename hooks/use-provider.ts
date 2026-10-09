import { useEffect, useState } from "react";
import {
  supportsProviderAsset,
  supportsProviderNetwork,
} from "@/lib/provider-network-support";
import {
  providerService,
  type PaymentProvider,
} from "@/services/api/payment-providers";

interface Provider {
  id: string;
  name: string;
  logo: string;
  deliveryTime: string;
  fee: string;
  isRecommended?: boolean;
  features: string[];
}

export function useProviders(
  country: string | null,
  asset: string | null,
  networkName: string | null,
  currency: string | null,
  type: "buy" | "sell" = "buy",
) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchProviders = async () => {
      if (!country || !asset || !networkName || !currency) {
        setProviders([]);
        setSelectedProviderId("");
        return;
      }
      setIsLoading(true);
      try {
        const [response, feesResponse] = await Promise.all([
          // Discover enabled providers for the corridor, then apply the
          // current network policy below. This avoids stale provider network
          // records hiding a provider before its live quote is requested.
          providerService.listProviders({
            country,
            currency,
            type,
          }),
          providerService.getProviderFees().catch(() => null),
        ]);

        if (cancelled) return;

        if (response.success && response.data) {
          const mapped = response.data
            .filter(
              (p: PaymentProvider) =>
                supportsProviderNetwork(
                  p.slug || p.name || "",
                  networkName,
                  type,
                ) && supportsProviderAsset(p.slug || p.name || "", asset),
            )
            .map((p: PaymentProvider) => {
              const providerKey = String(p.slug || p.name || "").toLowerCase();
              const fees = p.fees || feesResponse?.data?.[providerKey];
              const percentage = Number(fees?.percentage || 0);
              const fixed = Number(fees?.fixed || 0);
              const feeParts = [
                percentage > 0 ? `${percentage}%` : null,
                fixed > 0 ? `${fixed} fixed` : null,
              ].filter(Boolean);

              return {
                id: p.id,
                name: p.name,
                logo: p.logo || "",
                deliveryTime: p.processingTime || "Instant",
                fee: feeParts.length ? feeParts.join(" + ") : "No fee",
                features: p.features || [],
                isRecommended: p.metadata?.isRecommended || false,
              };
            });
          setProviders(mapped);
          setSelectedProviderId((currentProviderId) => {
            if (!mapped.length) {
              return "";
            }

            if (mapped.some((provider) => provider.id === currentProviderId)) {
              return currentProviderId;
            }

            return "";
          });
        } else {
          setProviders([]);
          setSelectedProviderId("");
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch providers:", error);
        setProviders([]);
        setSelectedProviderId("");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    fetchProviders();

    return () => {
      cancelled = true;
    };
  }, [country, asset, networkName, currency, type]);

  return {
    providers,
    selectedProviderId,
    setSelectedProviderId,
    isLoadingProviders: isLoading,
  };
}
