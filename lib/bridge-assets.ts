import { getActiveChains, type SupportedChainKeys } from "./chains";
import type { Asset } from "../types/db";

export type BridgeSymbol = "USDC" | "USDT";

export interface BridgeAssetOption {
  key: string;
  symbol: BridgeSymbol;
  name: string;
  chainKey: SupportedChainKeys;
  chainName: string;
  chainId: number | string;
  chainType: "evm" | "stellar" | "solana";
  tokenAddress: string;
  decimals: number;
  balance: number;
}

const ASSET_NAMES: Record<BridgeSymbol, string> = {
  USDC: "USD Coin",
  USDT: "Tether USD",
};

export function normalizeBridgeChain(value?: string | null): string {
  const normalized = (value || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (
    [
      "bsc",
      "bnbsmartchain",
      "binance",
      "binancechain",
      "binancesmartchain",
    ].includes(normalized)
  ) {
    return "bnb";
  }
  return normalized.replace(/testnet|mainnet|network/g, "");
}

export function getBridgeDecimals(
  symbol: BridgeSymbol,
  chainKey: SupportedChainKeys,
): number {
  if (chainKey === "stellar") return 7;
  if (chainKey === "solana") return 6;
  if (chainKey === "bnb") return 18;
  return symbol === "USDC" || symbol === "USDT" ? 6 : 18;
}

export function getBridgeDestinations(): BridgeAssetOption[] {
  const chains = getActiveChains();

  return Object.entries(chains).flatMap(([rawChainKey, chain]) => {
    const chainKey = rawChainKey as SupportedChainKeys;
    const entries: BridgeAssetOption[] = [];

    if (chain.usdcAddress) {
      entries.push({
        key: `USDC:${chainKey}`,
        symbol: "USDC",
        name: ASSET_NAMES.USDC,
        chainKey,
        chainName: chain.name,
        chainId: chain.id,
        chainType: chain.type,
        tokenAddress: chain.usdcAddress,
        decimals: getBridgeDecimals("USDC", chainKey),
        balance: 0,
      });
    }

    if (chain.usdtAddress) {
      entries.push({
        key: `USDT:${chainKey}`,
        symbol: "USDT",
        name: ASSET_NAMES.USDT,
        chainKey,
        chainName: chain.name,
        chainId: chain.id,
        chainType: chain.type,
        tokenAddress: chain.usdtAddress,
        decimals: getBridgeDecimals("USDT", chainKey),
        balance: 0,
      });
    }

    return entries;
  });
}

export function getBridgeSources(
  assets: Array<Pick<Asset, "symbol" | "chain" | "amount"> | null | undefined>,
): BridgeAssetOption[] {
  const destinations = getBridgeDestinations();
  const balances = new Map<string, number>();

  assets.forEach((asset) => {
    if (!asset?.chain) return;
    const symbol = asset.symbol.toUpperCase();
    if (symbol !== "USDC" && symbol !== "USDT") return;

    const chainKey = normalizeBridgeChain(asset.chain);
    const destination = destinations.find(
      (item) =>
        item.symbol === symbol &&
        normalizeBridgeChain(item.chainKey) === chainKey,
    );
    if (!destination) return;

    const amount = Number(asset.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    balances.set(
      destination.key,
      (balances.get(destination.key) || 0) + amount,
    );
  });

  return destinations
    .filter((item) => balances.has(item.key))
    .map((item) => ({ ...item, balance: balances.get(item.key) || 0 }))
    .sort((left, right) => right.balance - left.balance);
}

export function isExecutableBridgePair(
  source: BridgeAssetOption,
  destination: BridgeAssetOption,
): boolean {
  return (
    source.symbol === destination.symbol &&
    source.chainType === "evm" &&
    destination.chainType === "evm" &&
    source.chainKey !== destination.chainKey
  );
}
