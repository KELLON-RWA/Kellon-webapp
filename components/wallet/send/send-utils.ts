import { AtSign, Mail, Wallet } from "lucide-react";
import * as z from "zod";
import type { Asset, Transaction } from "@/types/db";
import type { RecipientKind } from "./send-types";

export const SEND_STEPS = ["recipient", "asset", "amount", "review"] as const;

export const ASSET_NAMES: Record<string, string> = {
  USDC: "USD Coin",
  USDT: "Tether USD",
};

export const stepTitles = {
  recipient: "Who to?",
  asset: "Choose Asset",
  amount: "Enter Amount",
  review: "Review Send",
};

export const recipientSchema = z.object({
  recipient: z
    .string()
    .trim()
    .min(1, "Enter a recipient")
    .refine(
      (value) => isSupportedRecipient(getRecipientKind(value)),
      "Enter a valid email, username, @tag, EVM address, or Stellar address.",
    ),
});

export const amountSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Enter an amount")
    .regex(/^\d+(\.\d{0,6})?$/, "Enter a valid amount")
    .refine((value) => Number(value) > 0, "Amount must be greater than 0"),
});

export function parseAssetAmount(amount: Asset["amount"]): number {
  const parsed = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAssetAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: 6,
  }).format(value);
}

export function getTokenIconUrl(symbol: string): string {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
}

function getMetadataValue(
  metadata: Transaction["metadata"] | undefined,
  key: string,
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export function getRecipientKind(value: string): RecipientKind {
  const trimmed = value.trim();

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return "evm";
  if (/^G[A-Z2-7]{55}$/.test(trimmed)) return "stellar";
  if (/^@?[a-zA-Z0-9_.-]{3,}$/.test(trimmed)) return "tag";

  return "unknown";
}

export function getRecipientIcon(kind: RecipientKind) {
  if (kind === "email") return Mail;
  if (kind === "tag") return AtSign;
  return Wallet;
}

export function getRecipientLabel(kind: RecipientKind): string {
  switch (kind) {
    case "email":
      return "Email";
    case "tag":
      return "Kellon tag";
    case "evm":
      return "EVM address";
    case "stellar":
      return "Stellar address";
    default:
      return "Recipient";
  }
}

export function getRecipientPendingLabel(kind: RecipientKind): string {
  if (kind === "email" || kind === "tag") return "Ready to verify";
  if (kind === "evm" || kind === "stellar") return "Wallet address format";
  return "Check recipient";
}

export function isSupportedRecipient(kind: RecipientKind): boolean {
  return kind !== "unknown";
}

export function getRecentRecipient(transaction: Transaction) {
  const recipientEmail = getMetadataValue(
    transaction.metadata,
    "recipientEmail",
  );
  const recipientTag = getMetadataValue(transaction.metadata, "recipientTag");
  const recipientAddress =
    getMetadataValue(transaction.metadata, "recipientAddress") ||
    getMetadataValue(transaction.metadata, "address");

  if (recipientEmail) return { value: recipientEmail, method: "Email" };
  if (recipientTag) return { value: recipientTag, method: "Kellon tag" };
  if (recipientAddress) return { value: recipientAddress, method: "Address" };

  return null;
}

export function truncateMiddle(value: string, visible = 7): string {
  if (value.length <= visible * 2 + 3) return value;
  return `${value.slice(0, visible)}...${value.slice(-visible)}`;
}
