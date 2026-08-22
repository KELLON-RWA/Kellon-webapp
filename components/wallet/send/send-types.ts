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
  tokenAddress?: string;
  decimals?: number;
  isNative?: boolean;
  isTemporaryRecoveryAsset?: boolean;
}

export interface SendableAssetGroup {
  symbol: string;
  name: string;
  assets: SendableAsset[];
  balance: number;
  isMultiChain: boolean;
}

export interface VerifiedRecipient {
  id: string;
  name?: string | null;
  addresses?: {
    stellar?: string | null;
    solana?: string | null;
    evm?: string | null;
    smartAccount?: string | null;
    smartAccounts?: Record<string, string | null> | null;
  } | null;
  identifier: string;
}

export interface RecentRecipient {
  value: string;
  method: string;
}

export type RecipientFormValues = z.infer<typeof recipientSchema>;
export type AmountFormValues = z.infer<typeof amountSchema>;
