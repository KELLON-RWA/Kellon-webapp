import {
  Cake,
  Gift,
  Heart,
  PartyPopper,
  HandHeart,
  Gem,
  TreePine,
  Rocket,
  Palmtree,
  Apple,
  MoonStar,
  Moon,
} from "lucide-react";
import { AssetType, type Asset, type User } from "@/types/db";
import { getAssetName } from "@/lib/dashboard-utils";

export type GiftStep = "intro" | "style" | "details" | "review";

export interface GiftAssetOption {
  key: string;
  symbol: string;
  name: string;
  chain: string;
  amount: number;
  assetType: AssetType;
}

export interface GiftTemplate {
  id: string;
  title: string;
  gradient: string;
  accent: string;
  textClassName: string;
  Icon: typeof Gift;
}

export const GIFT_STEPS: GiftStep[] = ["intro", "style", "details", "review"];

export const GIFT_TEMPLATES: GiftTemplate[] = [
  {
    id: "custom",
    title: "Custom",
    gradient: "from-[#5b4df5] to-[#4f46e5]",
    accent: "#c319b5",
    textClassName: "text-white",
    Icon: Gift,
  },
  {
    id: "birthday",
    title: "Birthday",
    gradient: "from-[#ec4899] to-[#db2777]",
    accent: "#ec4899",
    textClassName: "text-white",
    Icon: Cake,
  },
  {
    id: "love",
    title: "Love",
    gradient: "from-[#f43f5e] to-[#ef4444]",
    accent: "#f43f5e",
    textClassName: "text-white",
    Icon: Heart,
  },
  {
    id: "congrats",
    title: "Congrats",
    gradient: "from-[#10b981] to-[#14b8a6]",
    accent: "#10b981",
    textClassName: "text-white",
    Icon: PartyPopper,
  },
  {
    id: "thank-you",
    title: "Thank You",
    gradient: "from-[#f59e0b] to-[#f97316]",
    accent: "#f59e0b",
    textClassName: "text-white",
    Icon: HandHeart,
  },
  {
    id: "anniversary",
    title: "Anniversary",
    gradient: "from-[#d4af37] to-[#c99700]",
    accent: "#d4af37",
    textClassName: "text-white",
    Icon: Gem,
  },
  {
    id: "christmas",
    title: "Christmas",
    gradient: "from-[#dc2626] to-[#991b1b]",
    accent: "#dc2626",
    textClassName: "text-white",
    Icon: TreePine,
  },
  {
    id: "new-year",
    title: "New Year",
    gradient: "from-[#18181b] to-[#0f172a]",
    accent: "#18181b",
    textClassName: "text-white",
    Icon: Rocket,
  },
  {
    id: "holidays",
    title: "Holidays",
    gradient: "from-[#14b8a6] to-[#0f766e]",
    accent: "#14b8a6",
    textClassName: "text-white",
    Icon: Palmtree,
  },
  {
    id: "thanksgiving",
    title: "Thanksgiving",
    gradient: "from-[#ea580c] to-[#d97706]",
    accent: "#ea580c",
    textClassName: "text-white",
    Icon: Apple,
  },
  {
    id: "ramadan",
    title: "Ramadan",
    gradient: "from-[#059669] to-[#047857]",
    accent: "#059669",
    textClassName: "text-white",
    Icon: MoonStar,
  },
  {
    id: "eid",
    title: "Eid al-Fitr",
    gradient: "from-[#14b8a6] to-[#06b6d4]",
    accent: "#14b8a6",
    textClassName: "text-white",
    Icon: Moon,
  },
];

export function parseGiftAssetAmount(amount: Asset["amount"]): number {
  const parsed = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getGiftAssetOptions(assets: Asset[] = []): GiftAssetOption[] {
  return assets
    .filter(
      (asset): asset is Asset =>
        Boolean(asset?.symbol && asset?.chain) &&
        asset.assetType === AssetType.CRYPTO &&
        !["avalanche", "avax"].includes((asset.chain || "").toLowerCase()),
    )
    .map((asset) => {
      const symbol = asset.symbol.toUpperCase();
      return {
        key: [asset.id, symbol, asset.chain].filter(Boolean).join(":"),
        symbol,
        name: getAssetName(symbol),
        chain: asset.chain || "base",
        amount: parseGiftAssetAmount(asset.amount),
        assetType: asset.assetType,
      };
    })
    .filter((asset) => asset.amount > 0 && ["USDC", "USDT"].includes(asset.symbol))
    .sort((left, right) => {
      if (left.symbol !== right.symbol) return left.symbol.localeCompare(right.symbol);
      return left.chain.localeCompare(right.chain);
    });
}

export function formatGiftAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: 6,
  }).format(value);
}

export function isGiftRecipientEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isGiftRecipientTag(value: string): boolean {
  return /^@?[a-zA-Z0-9_.-]{3,}$/.test(value.trim());
}

export function getGiftSelfIdentifiers(profile: User): Set<string> {
  const identifiers = new Set<string>();
  const profileWithUsername = profile as User & { username?: string | null };

  if (profile.email) identifiers.add(profile.email.toLowerCase());
  if (profile.tag) {
    identifiers.add(profile.tag.toLowerCase());
    identifiers.add(`@${profile.tag.replace(/^@/, "")}`.toLowerCase());
  }
  if (profileWithUsername.username) {
    identifiers.add(profileWithUsername.username.toLowerCase());
    identifiers.add(
      `@${profileWithUsername.username.replace(/^@/, "")}`.toLowerCase(),
    );
  }

  return identifiers;
}
