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

const CHAIN_ALIASES: Record<string, string> = {
  bsc: "bnb",
  binance: "bnb",
  "binance-smart-chain": "bnb",
  sol: "solana",
  xlm: "stellar",
  matic: "polygon",
};

/**
 * The backend names BNB assets "bnb" while the stocks flow asks for "bsc". Matching the raw
 * strings returned a zero balance for every PancakeSwap stock, so the buy form rejected any
 * amount as over the maximum.
 */
export function normalizeChainKey(chain: string): string {
  const lower = chain.trim().toLowerCase();
  return CHAIN_ALIASES[lower] ?? lower;
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
  const normTarget = normalizeChainKey(targetChain);
  return (profile.assets || [])
    .filter(
      (asset: Asset) =>
        asset.symbol.toUpperCase() === symbol.toUpperCase() &&
        normalizeChainKey(asset.chain ?? "") === normTarget,
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

/**
 * The execution provider is not always the stock product shown to customers.
 * Bstock listings settle through PancakeSwap, but should retain their Bstock identity in the UI.
 */
export function getStockProviderLabel(provider: string): string {
  const normalized = provider.trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (
    normalized.includes("pancake") ||
    normalized === "bstock" ||
    normalized === "bstocks"
  ) {
    return "Bstock";
  }

  return provider.replace(/[_-]+/g, " ").trim();
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

export const KNOWN_STOCK_CATEGORIES: Record<string, string> = {
  AAPL: "Technology",
  MSFT: "Technology",
  NVDA: "Technology",
  AMD: "Technology",
  INTC: "Technology",
  AVGO: "Technology",
  QCOM: "Technology",
  ARM: "Technology",
  ORCL: "Technology",
  PLTR: "Technology",
  CRM: "Technology",
  GOOGL: "Technology",
  META: "Technology",
  AMZN: "Consumer Cyclical",
  TSLA: "Automotive",
  NFLX: "Entertainment",
  COIN: "Financial Services",
  HOOD: "Financial Services",
  PYPL: "Financial Services",
  CRCL: "Financial Services",
  MSTR: "Technology",
  BABA: "Consumer Cyclical",
  UBER: "Technology",
  ABNB: "Consumer Cyclical",
  DIS: "Entertainment",
  GME: "Consumer Cyclical",
  KO: "Consumer Defensive",
  MRNA: "Healthcare",
  MRVL: "Technology",
  NOK: "Technology",
  SKHY: "Technology",
  TSM: "Technology",
  BE: "Clean Energy",
  FLNC: "Clean Energy",
  CRWV: "Technology",
  DPRI: "Energy",
  SPY: "Index ETF",
  QQQ: "Index ETF",
  TLT: "Fixed Income",
  SGOV: "Fixed Income",
  FXI: "Equity ETF",
  SOXL: "Leveraged ETF",
  DJT: "Media",
};

export function sanitizeWikidataIndustry(raw?: string): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const lower = raw.toLowerCase();
  if (
    lower.includes("technology") ||
    lower.includes("software") ||
    lower.includes("electronics") ||
    lower.includes("information technology") ||
    lower.includes("computer") ||
    lower.includes("semiconductor") ||
    lower.includes("digital")
  ) {
    return "Technology";
  }
  if (
    lower.includes("finance") ||
    lower.includes("financial") ||
    lower.includes("banking") ||
    lower.includes("crypto")
  ) {
    return "Financial Services";
  }
  if (
    lower.includes("automotive") ||
    lower.includes("automobile") ||
    lower.includes("car") ||
    lower.includes("vehicle")
  ) {
    return "Automotive";
  }
  if (
    lower.includes("energy") ||
    lower.includes("oil") ||
    lower.includes("gas") ||
    lower.includes("refining")
  ) {
    return "Energy";
  }
  if (
    lower.includes("healthcare") ||
    lower.includes("health") ||
    lower.includes("biotech") ||
    lower.includes("pharma")
  ) {
    return "Healthcare";
  }
  if (
    lower.includes("entertainment") ||
    lower.includes("media") ||
    lower.includes("streaming") ||
    lower.includes("film") ||
    lower.includes("music")
  ) {
    return "Entertainment";
  }
  if (
    lower.includes("retail") ||
    lower.includes("commerce") ||
    lower.includes("consumer")
  ) {
    return "Consumer";
  }
  if (lower.includes("telecom")) {
    return "Telecommunications";
  }

  const firstItem = raw.split(/[&,]/)[0]?.trim();
  if (!firstItem) return undefined;
  const cleaned = firstItem.replace(/\s+industry$/i, "").trim();
  if (!cleaned) return undefined;
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export interface ResolveStockCategoryParams {
  ticker?: string;
  company?: {
    sector?: string;
    industry?: string;
    facts?: Array<{ label: string; value: string }>;
  };
  officialProfile?: {
    industry?: string;
  } | null;
  wikidataProfile?: {
    industry?: string;
  } | null;
  rwaCategory?: string;
}

export function resolveStockCategory({
  ticker,
  company,
  officialProfile,
  wikidataProfile,
  rwaCategory,
}: ResolveStockCategoryParams): string {
  const normalizedTicker = ticker?.toUpperCase();
  if (normalizedTicker && KNOWN_STOCK_CATEGORIES[normalizedTicker]) {
    return KNOWN_STOCK_CATEGORIES[normalizedTicker];
  }
  if (company?.sector) {
    return company.sector
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  if (company?.facts && company.industry) {
    return company.industry;
  }
  if (officialProfile?.industry) {
    return officialProfile.industry;
  }
  if (rwaCategory) {
    return rwaCategory.charAt(0).toUpperCase() + rwaCategory.slice(1);
  }
  const fromWikidata = sanitizeWikidataIndustry(wikidataProfile?.industry);
  if (fromWikidata) {
    return fromWikidata;
  }
  if (company?.industry) {
    return company.industry;
  }
  return "Technology";
}

