import type { z } from "zod";
import type { AssetType } from "@/types/db";
import type { amountSchema, recipientSchema } from "./send-utils";

export type SendStep = "recipient" | "asset" | "amount" | "review";
export type RecipientKind = "email" | "tag" | "evm" | "stellar" | "unknown";

export interface SendableAsset {
  id: string;
  key: string;
  symbol: string;
  name: string;
  amount: number;
  chain: string;
  assetType: AssetType;
}

export interface VerifiedRecipient {
  id: string;
  name?: string | null;
  addresses?: Record<string, string | null | undefined> | null;
  identifier: string;
}

export interface RecentRecipient {
  value: string;
  method: string;
}

export type RecipientFormValues = z.infer<typeof recipientSchema>;
export type AmountFormValues = z.infer<typeof amountSchema>;
