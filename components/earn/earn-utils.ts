import type { Asset, User, YieldOpportunity, YieldPosition } from "@/types/db";
import type { SupportedChainKeys } from "@/lib/chains";

export interface EarnBalance {
  chain: string;
  amount: number;
}

export function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatTokenAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMetricUsd(value: number): string {
  const showCents = Math.abs(value) < 1_000;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
}

export function formatApy(value: number | string): string {
  return `${toNumber(value).toFixed(2)}%`;
}

export function getProtocolName(protocol: string): string {
  return protocol
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getSymbolBalances(
  profile: User,
  symbol: string,
): EarnBalance[] {
  const byChain = new Map<string, number>();

  (profile.assets || []).forEach((asset: Asset) => {
    if (asset.symbol.toUpperCase() !== symbol.toUpperCase()) return;

    const chain = asset.chain?.toLowerCase() || "unknown";
    byChain.set(chain, (byChain.get(chain) || 0) + toNumber(asset.amount));
  });

  return [...byChain.entries()]
    .map(([chain, amount]) => ({ chain, amount }))
    .filter(({ amount }) => amount > 0)
    .sort((left, right) => right.amount - left.amount);
}

export function getMaxUsableBalance(profile: User, symbol: string): number {
  return getSymbolBalances(profile, symbol).reduce(
    (total, { amount }) => total + amount,
    0,
  );
}

export function getMaxUsableBalanceForChain(
  profile: User,
  symbol: string,
  targetChain?: string,
): number {
  if (!targetChain) return getMaxUsableBalance(profile, symbol);

  const normalizedTarget = targetChain.toLowerCase();
  return (profile.assets || [])
    .filter(
      (asset: Asset) =>
        asset.symbol.toUpperCase() === symbol.toUpperCase() &&
        asset.chain?.toLowerCase() === normalizedTarget,
    )
    .reduce((total, asset) => total + toNumber(asset.amount), 0);
}

export function getStockSettlementChain(
  provider: string,
  settlementChain?: string,
): SupportedChainKeys {
  const normalizedChain = settlementChain
    ?.trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  const chainAliases: Record<string, SupportedChainKeys> = {
    base: "base",
    basesepolia: "base",
    bnb: "bnb",
    bsc: "bnb",
    binance: "bnb",
    binancesmartchain: "bnb",
    celo: "celo",
    polygon: "polygon",
    solana: "solana",
    stellar: "stellar",
  };

  if (normalizedChain) {
    const alias = Object.keys(chainAliases).find(
      (key) =>
        normalizedChain === key || normalizedChain.startsWith(key),
    );
    if (alias) return chainAliases[alias];
  }

  return provider.toLowerCase().includes("pancake") ? "bnb" : "base";
}

export function getPositionOpportunity(
  position: YieldPosition,
  opportunities: YieldOpportunity[],
): YieldOpportunity | null {
  return (
    position.opportunity ||
    opportunities.find(
      (opportunity) => opportunity.id === position.opportunityId,
    ) ||
    null
  );
}

export function getPositionValue(position: YieldPosition): number {
  return toNumber(position.amount);
}
