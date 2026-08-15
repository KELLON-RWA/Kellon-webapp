import { getAssetName } from "@/lib/dashboard-utils";
import { AssetType, type Asset, type User } from "@/types/db";
import {
  HIDDEN_INVOICE_CHAINS,
  type InvoiceAssetGroup,
  type InvoiceAssetOption,
  type InvoiceFormValues,
} from "./types";

export function getInvoiceAssetOptions(assets: Asset[]): InvoiceAssetOption[] {
  const options = assets
    .filter(
      (asset) =>
        asset.assetType === AssetType.CRYPTO &&
        !HIDDEN_INVOICE_CHAINS.has((asset.chain || "").toLowerCase()),
    )
    .map((asset) => {
      const symbol = asset.symbol.toUpperCase();
      const chain = (asset.chain || "base").toLowerCase();

      return {
        key: `${symbol}:${chain}`,
        symbol,
        name: getAssetName(symbol),
        iconUrl: getAssetIcon(symbol),
        chain,
        assetType: asset.assetType,
      };
    });

  if (options.length > 0) {
    return Array.from(
      new Map(options.map((asset) => [asset.key, asset])).values(),
    );
  }

  return [
    {
      key: "USDC:base",
      symbol: "USDC",
      name: getAssetName("USDC"),
      iconUrl: getAssetIcon("USDC"),
      chain: "base",
      assetType: AssetType.CRYPTO,
    },
    {
      key: "USDT:base",
      symbol: "USDT",
      name: getAssetName("USDT"),
      iconUrl: getAssetIcon("USDT"),
      chain: "base",
      assetType: AssetType.CRYPTO,
    },
  ];
}

export function getInvoiceAssetGroups(
  assets: InvoiceAssetOption[],
): InvoiceAssetGroup[] {
  const groups = new Map<string, InvoiceAssetGroup>();

  assets.forEach((asset) => {
    const existingGroup = groups.get(asset.symbol);

    if (existingGroup) {
      existingGroup.chains.push(asset);
      return;
    }

    groups.set(asset.symbol, {
      symbol: asset.symbol,
      name: asset.name,
      iconUrl: asset.iconUrl,
      chains: [asset],
    });
  });

  return Array.from(groups.values());
}

export function getAssetIcon(symbol: string): string {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
}

export function getExpiryDate(preset: InvoiceFormValues["expiryPreset"]): Date {
  const expiresAt = new Date();

  switch (preset) {
    case "1h":
      expiresAt.setHours(expiresAt.getHours() + 1);
      break;
    case "1d":
      expiresAt.setDate(expiresAt.getDate() + 1);
      break;
    case "3d":
      expiresAt.setDate(expiresAt.getDate() + 3);
      break;
    case "7d":
      expiresAt.setDate(expiresAt.getDate() + 7);
      break;
    case "30d":
      expiresAt.setDate(expiresAt.getDate() + 30);
      break;
  }

  return expiresAt;
}

export function formatChain(chain: string): string {
  return chain.charAt(0).toUpperCase() + chain.slice(1).toLowerCase();
}

export function isInvoiceCustomerContactEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getInvoiceCustomerContactLabel(value: string): string {
  const contact = value.trim();

  if (!contact) return "Email/Kellon Tag";
  return isInvoiceCustomerContactEmail(contact) ? "Email" : "Kellon Tag";
}

export function getInvoiceSelfIdentifiers(profile: User): Set<string> {
  const identifiers = new Set<string>();
  const profileWithUsername = profile as User & {
    username?: string | null;
  };

  if (profile.id) identifiers.add(profile.id.toLowerCase());
  if (profile.email) identifiers.add(profile.email.toLowerCase());
  if (profileWithUsername.username) {
    identifiers.add(profileWithUsername.username.toLowerCase());
    identifiers.add(
      `@${profileWithUsername.username.replace(/^@/, "")}`.toLowerCase(),
    );
  }
  if (profile.tag) {
    identifiers.add(profile.tag.toLowerCase());
    identifiers.add(`@${profile.tag.replace(/^@/, "")}`.toLowerCase());
  }

  return identifiers;
}
