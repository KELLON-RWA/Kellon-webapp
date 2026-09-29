import { getActiveChainKey } from "@/lib/chains";

/**
 * Client-side mirror of the provider network policy. The API remains the
 * source of provider records, while this prevents an outdated response from
 * exposing a provider on a network it cannot serve.
 */
const PROVIDER_NETWORK_EXCLUSIONS: Record<string, readonly string[]> = {
  centiiv: ["celo"],
  paycrest: [],
};

function normalizeProviderName(providerName: string): string {
  return providerName
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function supportsProviderNetwork(
  providerName: string,
  networkName: string | null | undefined,
): boolean {
  const providerKey = normalizeProviderName(providerName);
  const exclusions = PROVIDER_NETWORK_EXCLUSIONS[providerKey];

  // The service determines support for providers without an explicit policy.
  if (!exclusions) return true;

  const chainKey = getActiveChainKey(networkName);
  return chainKey !== null && !exclusions.includes(chainKey);
}
