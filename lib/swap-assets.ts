import type { Token } from "@/services/api/swap";
import type { Asset } from "@/types/db";
import { normalizeBridgeChain } from "./bridge-assets";
import { getActiveChains, type SupportedChainKeys } from "./chains";
import { isNativeSwapAddress, isStableSwapToken } from "./swap-policy";

export interface SwapAssetOption {
  key: string;
  symbol: string;
  name: string;
  chainKey: SupportedChainKeys;
  chainName: string;
  chainId: number | string;
  chainType: "evm" | "stellar" | "solana";
  tokenAddress: string;
  decimals: number;
  balance: number;
  logoURI?: string;
  priceUSD?: string;
  coinKey?: string;
  verificationStatus?: string;
  isNative?: boolean;
}

export interface NativeSwapBalance {
  chainKey: SupportedChainKeys;
  amount: number;
}

const PREFERRED_DESTINATIONS = ["USDC", "USDT"];

const NATIVE_CHAIN_ORDER: SupportedChainKeys[] = [
  "base",
  "celo",
  "polygon",
  "bnb",
  "solana",
  "stellar",
];

function tokenKey(chainId: number | string, address: string) {
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

  const catalog: SwapAssetOption[] = tokens.flatMap((token) => {
    const tokenWithStatus = token as Token & { verificationStatus?: string };
    const supported = chains.get(Number(token.chainId));
    if (!supported || !/^0x[a-fA-F0-9]{40}$/.test(token.address)) return [];
    if (
      !isNativeSwapAddress(token.address) &&
      !isStableSwapToken(Number(token.chainId), token.address, token.symbol)
    ) {
      return [];
    }
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
        tokenAddress: token.address,
        decimals: token.decimals,
        balance: 0,
        logoURI: token.logoURI,
        priceUSD: token.priceUSD,
        coinKey: token.coinKey,
        verificationStatus: tokenWithStatus.verificationStatus,
        isNative: isNativeSwapAddress(token.address),
      },
    ];
  });

  Object.entries(getActiveChains()).forEach(([rawKey, chain]) => {
    const chainKey = rawKey as SupportedChainKeys;
    const nativeAddress =
      chain.type === "evm"
        ? "0x0000000000000000000000000000000000000000"
        : `native:${chainKey}`;
    const nativeKey = tokenKey(chain.id, nativeAddress);
    if (!catalog.some((token) => token.key === nativeKey)) {
      catalog.push({
        key: nativeKey,
        symbol: chain.nativeCurrency.symbol,
        name: chain.nativeCurrency.name,
        chainKey,
        chainName: chain.name,
        chainId: chain.id,
        chainType: chain.type,
        tokenAddress: nativeAddress,
        decimals: chain.nativeCurrency.decimals,
        balance: 0,
        coinKey: chain.nativeCurrency.symbol,
        isNative: true,
      });
    }

    (["USDC", "USDT"] as const).forEach((symbol) => {
      const address = symbol === "USDC" ? chain.usdcAddress : chain.usdtAddress;
      if (!address) return;
      const key = tokenKey(chain.id, address);
      if (catalog.some((token) => token.key === key)) return;
      catalog.push({
        key,
        symbol,
        name: symbol === "USDC" ? "USD Coin" : "Tether USD",
        chainKey,
        chainName: chain.name,
        chainId: chain.id,
        chainType: chain.type,
        tokenAddress: address,
        decimals: chain.type === "stellar" ? 7 : 6,
        balance: 0,
        coinKey: symbol,
        isNative: false,
      });
    });
  });

  return catalog.sort((left, right) => {
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

export function isNativeSwapToken(token: SwapAssetOption) {
  return token.isNative === true || isNativeSwapAddress(token.tokenAddress);
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
  liveNativeBalances: NativeSwapBalance[] = [],
): SwapAssetOption[] {
  const balances = new Map<string, number>();
  const nativeTokens = tokens.filter(isNativeSwapToken);

  assets.forEach((asset) => {
    if (!asset?.chain) return;
    const chainKey = normalizeBridgeChain(asset.chain);
    const amount = Number(asset.amount);
    if (!chainKey || !Number.isFinite(amount) || amount <= 0) return;

    const address = getMetadataAddress(asset);
    const candidates = nativeTokens.filter(
      (token) => token.chainKey === chainKey,
    );
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

  liveNativeBalances.forEach(({ chainKey, amount }) => {
    if (!Number.isFinite(amount) || amount < 0) return;
    const token = nativeTokens.find(
      (candidate) => candidate.chainKey === chainKey,
    );
    if (!token) return;
    balances.set(token.key, Math.max(balances.get(token.key) || 0, amount));
  });

  return nativeTokens
    .map((token) => ({ ...token, balance: balances.get(token.key) || 0 }))
    .sort(
      (left, right) =>
        NATIVE_CHAIN_ORDER.indexOf(left.chainKey) -
        NATIVE_CHAIN_ORDER.indexOf(right.chainKey),
    );
}

export function getSwapDestinations(
  source: SwapAssetOption | null,
  tokens: SwapAssetOption[],
) {
  if (!source) return [];
  return tokens.filter(
    (token) =>
      token.chainKey === source.chainKey &&
      !isNativeSwapToken(token) &&
      ["USDC", "USDT"].includes(token.symbol.toUpperCase()),
  );
}

export function getDefaultSwapDestination(
  source: SwapAssetOption | null,
  destinations: SwapAssetOption[],
) {
  if (!source || !destinations.length) return null;
  return (
    destinations.find((token) => token.symbol.toUpperCase() === "USDC") ||
    destinations.find((token) => token.symbol.toUpperCase() === "USDT") ||
    destinations[0]
  );
}
