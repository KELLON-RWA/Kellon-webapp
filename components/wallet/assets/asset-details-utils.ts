import {
  CHAIN_UI_DATA,
  getChainLabel,
  type SupportedChainKeys,
} from "@/lib/chains";
import { getProviderAmount } from "@/lib/dashboard-utils";
import type { Asset, Transaction } from "@/types/db";

export interface ChainBalance {
  chain: string;
  label: string;
  amount: number;
  percentage: number;
  value: number;
  color: string;
}

export const DEFAULT_TOKEN_PRICE = 1;

export const CHAIN_ORDER: SupportedChainKeys[] = [
  "base",
  "stellar",
  "celo",
  "polygon",
  "bnb",
];

export const HIDDEN_CHAINS = new Set(["avalanche", "avax"]);

const FALLBACK_CHAIN_COLORS = [
  "#0052FF",
  "#111111",
  "#35D07F",
  "#8247E5",
  "#F3BA2F",
  "#C15CA5",
];

export function parseAmount(amount: Asset["amount"]): number {
  const parsed = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeChain(chain?: string | null): string {
  return chain?.trim().toLowerCase() || "unknown";
}

export function formatTokenAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: 6,
  }).format(value);
}

export function formatShortDate(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getTransactionChain(transaction: Transaction): string | null {
  const metadata = transaction.metadata;
  const chain =
    metadata?.chain ||
    metadata?.network ||
    metadata?.sourceChain ||
    metadata?.targetChain ||
    metadata?.fromChain ||
    metadata?.toChain;

  return typeof chain === "string" && chain.trim()
    ? normalizeChain(chain)
    : null;
}

export function getTransactionNumericAmount(
  transaction: Transaction,
): number | null {
  const providerAmount = getProviderAmount(transaction);
  if (providerAmount !== null) return providerAmount;

  const parsed =
    typeof transaction.amount === "string"
      ? Number(transaction.amount)
      : transaction.amount;

  return Number.isFinite(parsed) ? parsed : null;
}

export function getChainColor(chain: string, index: number): string {
  const normalizedChain = normalizeChain(chain) as SupportedChainKeys;
  return (
    CHAIN_UI_DATA[normalizedChain]?.color ||
    FALLBACK_CHAIN_COLORS[index % FALLBACK_CHAIN_COLORS.length]
  );
}

export function getShortChainLabel(chain: string): string {
  switch (normalizeChain(chain)) {
    case "base":
      return "Base";
    case "stellar":
      return "Stellar";
    case "celo":
      return "Celo";
    case "polygon":
      return "Polygon";
    case "bnb":
      return "BNB";
    default:
      return getChainLabel(chain).replace(" Network", "");
  }
}

export function getAssetIcon(symbol: string) {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
}
