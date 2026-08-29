import type { Token } from "@/services/api/swap";
import type { Asset } from "@/types/db";
import { normalizeBridgeChain } from "./bridge-assets";
import { getActiveChains, type SupportedChainKeys } from "./chains";

export interface SwapAssetOption {
  key: string;
  symbol: string;
  name: string;
  chainKey: SupportedChainKeys;
  chainName: string;
  chainId: number;
  chainType: "evm";
  tokenAddress: `0x${string}`;
  decimals: number;
  balance: number;
  logoURI?: string;
  priceUSD?: string;
  coinKey?: string;
  verificationStatus?: string;
}

const PREFERRED_DESTINATIONS = ["USDC", "USDT", "ETH", "POL", "CELO", "BNB"];

function tokenKey(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

function getSupportedEvmChains() {
  return Object.entries(getActiveChains()).flatMap(([rawKey, chain]) =>
    chain.type === "evm" && typeof chain.id === "number"
      ? [{ key: rawKey as SupportedChainKeys, chain }]
      : [],
  );
}

export function getSwapTokens(tokens: Token[]): SwapAssetOption[] {
  const chains = new Map(
    getSupportedEvmChains().map(({ key, chain }) => [
      Number(chain.id),
      { key, chain },
    ]),
  );
  const seen = new Set<string>();

  return tokens
    .flatMap((token) => {
      const tokenWithStatus = token as Token & { verificationStatus?: string };
      const supported = chains.get(Number(token.chainId));
      if (!supported || !/^0x[a-fA-F0-9]{40}$/.test(token.address)) return [];
      const key = tokenKey(Number(token.chainId), token.address);
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          key,
          symbol: token.symbol,
          name: token.name || token.symbol,
          chainKey: supported.key,
          chainName: supported.chain.name,
          chainId: Number(token.chainId),
          chainType: "evm" as const,
          tokenAddress: token.address as `0x${string}`,
          decimals: token.decimals,
          balance: 0,
          logoURI: token.logoURI,
          priceUSD: token.priceUSD,
          coinKey: token.coinKey,
          verificationStatus: tokenWithStatus.verificationStatus,
        },
      ];
    })
    .sort((left, right) => {
      const leftVerified = left.verificationStatus === "verified" ? 0 : 1;
      const rightVerified = right.verificationStatus === "verified" ? 0 : 1;
      if (leftVerified !== rightVerified) return leftVerified - rightVerified;
      const leftPreferred = PREFERRED_DESTINATIONS.indexOf(
        left.symbol.toUpperCase(),
      );
      const rightPreferred = PREFERRED_DESTINATIONS.indexOf(
        right.symbol.toUpperCase(),
      );
      if (leftPreferred >= 0 || rightPreferred >= 0) {
        if (leftPreferred < 0) return 1;
        if (rightPreferred < 0) return -1;
        if (leftPreferred !== rightPreferred)
          return leftPreferred - rightPreferred;
      }
      return left.symbol.localeCompare(right.symbol);
    });
}

function getMetadataAddress(asset: Pick<Asset, "metadata">) {
  if (!asset.metadata || typeof asset.metadata !== "object") return null;
  const metadata = asset.metadata as Record<string, unknown>;
  for (const key of ["tokenAddress", "contractAddress", "address"]) {
    const value = metadata[key];
    if (typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)) {
      return value.toLowerCase();
    }
  }
  return null;
}

export function getSwapSources(
  assets: Array<
    Pick<Asset, "symbol" | "chain" | "amount" | "metadata"> | null | undefined
  >,
  tokens: SwapAssetOption[],
): SwapAssetOption[] {
  const balances = new Map<string, number>();

  assets.forEach((asset) => {
    if (!asset?.chain) return;
    const chainKey = normalizeBridgeChain(asset.chain);
    const amount = Number(asset.amount);
    if (!chainKey || !Number.isFinite(amount) || amount <= 0) return;

    const address = getMetadataAddress(asset);
    const candidates = tokens.filter((token) => token.chainKey === chainKey);
    const token = address
      ? candidates.find(
          (candidate) => candidate.tokenAddress.toLowerCase() === address,
        )
      : candidates.find(
          (candidate) =>
            candidate.symbol.toUpperCase() === asset.symbol.toUpperCase() &&
            candidate.coinKey?.toUpperCase() === asset.symbol.toUpperCase(),
        ) ||
        candidates.find(
          (candidate) =>
            candidate.symbol.toUpperCase() === asset.symbol.toUpperCase(),
        );
    if (!token) return;
    balances.set(token.key, (balances.get(token.key) || 0) + amount);
  });

  return tokens
    .filter((token) => balances.has(token.key))
    .map((token) => ({ ...token, balance: balances.get(token.key) || 0 }))
    .sort((left, right) => right.balance - left.balance);
}

export function getSwapDestinations(
  source: SwapAssetOption | null,
  tokens: SwapAssetOption[],
) {
  if (!source) return [];
  return tokens.filter(
    (token) => token.chainId === source.chainId && token.key !== source.key,
  );
}

export function getDefaultSwapDestination(
  source: SwapAssetOption | null,
  destinations: SwapAssetOption[],
) {
  if (!source || !destinations.length) return null;
  const preferred = source.symbol.toUpperCase() === "USDC" ? "USDT" : "USDC";
  return (
    destinations.find((token) => token.symbol.toUpperCase() === preferred) ||
    destinations[0]
  );
}
