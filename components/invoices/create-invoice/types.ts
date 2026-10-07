import { z } from "zod";
import { AssetType } from "@/types/db";

export const invoiceSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,6})?$/, "Enter a valid amount")
    .refine(
      (value) => Number.isFinite(Number(value)) && Number(value) > 0,
      "Enter a valid amount",
    ),
  assetSymbol: z.string().min(1, "Select an asset"),
  chain: z.string().min(1, "Select a network"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  customerName: z
    .string()
    .trim()
    .max(100, "Name must be 100 characters or less")
    .optional(),
  customerContact: z
    .string()
    .trim()
    .max(254, "Email or Kellon tag is too long")
    .min(1, "Enter the customer's email or Kellon tag")
    .refine(
      (value) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
        /^@?[a-zA-Z0-9._-]{3,}$/.test(value),
      {
        message: "Enter a valid email or Kellon tag",
      },
    ),
  expiryPreset: z.enum(["1h", "1d", "3d", "7d", "30d"]),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export type InvoiceAssetOption = {
  key: string;
  symbol: string;
  name: string;
  iconUrl: string;
  chain: string;
  assetType: AssetType;
};

export type InvoiceAssetGroup = {
  symbol: string;
  name: string;
  iconUrl: string;
  chains: InvoiceAssetOption[];
};

export const EXPIRY_PRESETS = [
  { label: "1 Hour", value: "1h" },
  { label: "1 Day", value: "1d" },
  { label: "3 Days", value: "3d" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
] as const;

export const INVOICE_STEPS = ["amount", "details", "review"] as const;
export const HIDDEN_INVOICE_CHAINS = new Set(["avalanche", "avax"]);
export const INVOICE_CARD_CLASS =
  "rounded-[28px] border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-secondary-50/80";
export const INVOICE_INPUT_CLASS =
  "border-black/5 bg-gray-95 text-black placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white";

export type InvoiceStep = (typeof INVOICE_STEPS)[number];
