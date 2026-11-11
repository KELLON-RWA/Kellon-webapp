import { describe, expect, it } from "vitest";
import { isStablecoinSymbol, STABLECOIN_SYMBOLS } from "@/lib/dashboard-utils";
import {
  ASSET_NAMES,
  groupSendableAssets,
  getRecipientInitials,
  getRecipientKind,
  getRecipientLabel,
  isSupportedRecipient,
  recipientSchema,
} from "@/components/wallet/send/send-utils";
import type { SendableAsset } from "@/components/wallet/send/send-types";
import { AssetType } from "@/types/db";

describe("send flow recipient detection", () => {
  it("identifies Solana addresses correctly", () => {
    // Standard Solana addresses (base58, 32-44 characters, no 0, O, I, l)
    const solanaAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const solanaWallet = "98HVtsVFX9GZ7R2aF3wKj4Y8n1B6c5D7e9F2g3H4j5K6";

    expect(getRecipientKind(solanaAddress)).toBe("solana");
    expect(getRecipientKind(solanaWallet)).toBe("solana");
    expect(getRecipientLabel("solana")).toBe("Solana address");
    expect(isSupportedRecipient("solana")).toBe(true);

    const parseResult = recipientSchema.safeParse({ recipient: solanaAddress });
    expect(parseResult.success).toBe(true);
  });

  it("distinguishes between tags, emails, EVM, and Solana", () => {
    expect(getRecipientKind("alice@example.com")).toBe("email");
    expect(getRecipientKind("0x71C845170B18f972bFa8d87C6F32E2750e68f3a3")).toBe("evm");
    expect(getRecipientKind("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5")).toBe("stellar");
    expect(getRecipientKind("@satoshi")).toBe("tag");
    expect(getRecipientKind("progresso")).toBe("tag");
  });

  it("extracts correct recipient initials for user cards", () => {
    expect(getRecipientInitials("rex ojemeh", "rexojemeh@gmail.com")).toBe("RO");
    expect(getRecipientInitials("Satoshi Nakamoto", "@satoshi")).toBe("SN");
    expect(getRecipientInitials("Solo", "solo@example.com")).toBe("SO");
    expect(getRecipientInitials(null, "rexojemeh@gmail.com")).toBe("RE");
    expect(getRecipientInitials(undefined, "@kellon")).toBe("KE");
    expect(getRecipientInitials(null, null)).toBe("U");
  });
});

describe("send flow stablecoin filtering", () => {
  it("only allows USDC and USDT as stablecoins", () => {
    expect(isStablecoinSymbol("USDC")).toBe(true);
    expect(isStablecoinSymbol("USDT")).toBe(true);
    expect(isStablecoinSymbol("usdc")).toBe(true);
    expect(isStablecoinSymbol("usdt")).toBe(true);

    // Non-stablecoins must not be allowed
    expect(isStablecoinSymbol("ETH")).toBe(false);
    expect(isStablecoinSymbol("BTC")).toBe(false);
    expect(isStablecoinSymbol("SOL")).toBe(false);
    expect(isStablecoinSymbol("MUSDC")).toBe(false);
  });

  it("send asset names dictionary contains only stablecoins", () => {
    const symbols = Object.keys(ASSET_NAMES);
    expect(symbols).toEqual(["USDC", "USDT"]);
  });

  it("groupSendableAssets correctly groups stablecoin assets by symbol", () => {
    const assets: SendableAsset[] = [
      {
        id: "1",
        key: "USDC:base",
        symbol: "USDC",
        name: "USD Coin",
        amount: 50,
        chain: "Base",
        assetType: AssetType.CRYPTO,
        decimals: 6,
      },
      {
        id: "2",
        key: "USDC:polygon",
        symbol: "USDC",
        name: "USD Coin",
        amount: 25,
        chain: "Polygon",
        assetType: AssetType.CRYPTO,
        decimals: 6,
      },
      {
        id: "3",
        key: "USDT:base",
        symbol: "USDT",
        name: "Tether USD",
        amount: 100,
        chain: "Base",
        assetType: AssetType.CRYPTO,
        decimals: 6,
      },
    ];

    const groups = groupSendableAssets(assets);
    expect(groups).toHaveLength(2);
    expect(groups[0].symbol).toBe("USDC");
    expect(groups[0].balance).toBe(75);
    expect(groups[0].isMultiChain).toBe(true);
    expect(groups[1].symbol).toBe("USDT");
    expect(groups[1].balance).toBe(100);
    expect(groups[1].isMultiChain).toBe(false);
  });
});
