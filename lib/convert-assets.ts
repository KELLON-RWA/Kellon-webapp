import {
  getActiveChains,
  type SupportedChainKeys,
} from "./chains";
import { normalizeBridgeChain } from "./bridge-assets";
import type { Asset } from "@/types/db";

export type ConvertMode = "swap" | "bridge";

export interface ConvertAssetOption {
  key: string; // e.g. "USDC:base"
  symbol: "USDC" | "USDT";
  name: string;
  chainKey: SupportedChainKeys;
  chainName: string;
  chainId: number | string;
  chainType: "evm" | "stellar" | "solana";
  tokenAddress?: string;
  decimals: number;
  balance: number;
  mode?: ConvertMode;
}

const ASSET_NAMES = {
  USDC: "USD Coin",
  USDT: "Tether USD",
} as const;

export function getConvertKey(symbol: string, chainKey: string): string {
  return `${symbol.toUpperCase()}:${chainKey.toLowerCase()}`;
}

export function getAllConvertAssets(): ConvertAssetOption[] {
  const chains = getActiveChains();

  return Object.entries(chains).flatMap(([rawChainKey, chain]) => {
    const chainKey = rawChainKey as SupportedChainKeys;
    const entries: ConvertAssetOption[] = [];

    if (chain.usdcAddress) {
      entries.push({
        key: getConvertKey("USDC", chainKey),
        symbol: "USDC",
        name: ASSET_NAMES.USDC,
        chainKey,
        chainName: chain.name,
        chainId: chain.id,
        chainType: chain.type,
        tokenAddress: chain.usdcAddress,
        decimals: chain.id === 56 ? 18 : 6,
        balance: 0,
      });
    }

    if (chain.usdtAddress) {
      entries.push({
        key: getConvertKey("USDT", chainKey),
        symbol: "USDT",
        name: ASSET_NAMES.USDT,
        chainKey,
        chainName: chain.name,
        chainId: chain.id,
        chainType: chain.type,
        tokenAddress: chain.usdtAddress,
        decimals: chain.id === 56 ? 18 : 6,
        balance: 0,
      });
    }

    return entries;
  });
}

export function getConvertSources(
  assets: Array<Pick<Asset, "symbol" | "chain" | "amount"> | null | undefined>,
): ConvertAssetOption[] {
  const catalog = getAllConvertAssets();
  const balances = new Map<string, number>();

  assets.forEach((asset) => {
    if (!asset?.chain) return;
    const symbol = asset.symbol.toUpperCase();
    if (symbol !== "USDC" && symbol !== "USDT") return;

    const chainKey = normalizeBridgeChain(asset.chain);
    const item = catalog.find(
      (candidate) =>
        candidate.symbol === symbol &&
        normalizeBridgeChain(candidate.chainKey) === chainKey,
    );
    if (!item) return;

    const amount = Number(asset.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    balances.set(item.key, (balances.get(item.key) || 0) + amount);
  });

  return catalog
    .filter((item) => balances.has(item.key))
    .map((item) => ({ ...item, balance: balances.get(item.key) || 0 }))
    .sort((left, right) => right.balance - left.balance);
}

export function getConvertDestinations(
  source: ConvertAssetOption | null,
  filterMode?: "all" | "swap" | "bridge",
): ConvertAssetOption[] {
  if (!source) return [];
  const catalog = getAllConvertAssets();
  const modeFilter = filterMode || "all";

  const destinations: ConvertAssetOption[] = [];

  catalog.forEach((candidate) => {
    // Cannot convert to the exact same asset on the same chain
    if (
      candidate.chainKey === source.chainKey &&
      candidate.symbol === source.symbol
    ) {
      return;
    }

    // Stellar rules: only USDC is supported for cross-chain conversion in Kellon
    if (source.chainType === "stellar" || candidate.chainType === "stellar") {
      if (source.symbol !== "USDC" || candidate.symbol !== "USDC") {
        return;
      }
    }

    // Solana rules: only USDC is supported
    if (source.chainType === "solana" || candidate.chainType === "solana") {
      if (source.symbol !== "USDC" || candidate.symbol !== "USDC") {
        return;
      }
    }

    const mode = getConvertMode(source, candidate);
    if (!mode) return;

    if (modeFilter === "all" || modeFilter === mode) {
      destinations.push({
        ...candidate,
        mode,
      });
    }
  });

  return destinations.sort((left, right) => {
    // Same chain first
    if (left.chainKey === source.chainKey && right.chainKey !== source.chainKey) {
      return -1;
    }
    if (right.chainKey === source.chainKey && left.chainKey !== source.chainKey) {
      return 1;
    }
    if (left.chainName !== right.chainName) {
      return left.chainName.localeCompare(right.chainName);
    }
    return left.symbol.localeCompare(right.symbol);
  });
}

export function getConvertMode(
  source: ConvertAssetOption | null,
  destination: ConvertAssetOption | null,
): ConvertMode | null {
  if (!source || !destination) return null;
  if (
    source.chainKey === destination.chainKey &&
    source.symbol === destination.symbol
  ) {
    return null;
  }
  // Same chain, different stablecoin: Swap
  if (source.chainKey === destination.chainKey) {
    return "swap";
  }
  // Different chain, same stablecoin: Bridge
  if (source.symbol === destination.symbol) {
    return "bridge";
  }
  // Different chain, different stablecoin (e.g. Base USDC -> BNB USDT): Cross-chain Swap
  return "swap";
}

export function getDefaultConvertDestination(
  source: ConvertAssetOption | null,
  destinations: ConvertAssetOption[],
  preferredMode?: "swap" | "bridge",
): ConvertAssetOption | null {
  if (!source || !destinations.length) return null;

  if (preferredMode) {
    const matching = destinations.find((dest) => dest.mode === preferredMode);
    if (matching) return matching;
  }

  // Otherwise prefer same-network swap if available, else first destination
  const swapOption = destinations.find((dest) => dest.mode === "swap");
  return swapOption || destinations[0] || null;
}
