import { getActiveChainKey } from "@/lib/chains";

/**
 * Client-side mirror of the provider network policy. The API remains the
 * source of provider records, while this prevents an outdated response from
 * exposing a provider on a network it cannot serve.
 */
type ProviderFlow = "buy" | "sell";

const PROVIDER_FLOW_NETWORKS: Record<
  string,
  Partial<Record<ProviderFlow, readonly string[]>>
> = {
  centiiv: {
    buy: ["arc", "solana", "stellar"],
  },
  paycrest: {
    buy: ["base", "bnb", "celo", "polygon", "solana"],
    sell: ["base", "bnb", "celo", "polygon", "solana"],
  },
};

const PROVIDER_ASSETS: Record<string, readonly string[]> = {
  paycrest: ["usdc", "usdt"],
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
  flow: ProviderFlow = "buy",
): boolean {
  const providerKey = normalizeProviderName(providerName);
  const supportedNetworks = PROVIDER_FLOW_NETWORKS[providerKey]?.[flow];

  // The service determines support for providers without an explicit policy.
  if (!supportedNetworks) return true;

  const chainKey = getActiveChainKey(networkName);
  return chainKey !== null && supportedNetworks.includes(chainKey);
}

export function supportsProviderAsset(
  providerName: string,
  asset: string | null | undefined,
): boolean {
  const supportedAssets = PROVIDER_ASSETS[normalizeProviderName(providerName)];

  // The service determines support for providers without an explicit policy.
  if (!supportedAssets) return true;

  if (!asset) return false;
  return supportedAssets.includes(asset.toLowerCase());
}
