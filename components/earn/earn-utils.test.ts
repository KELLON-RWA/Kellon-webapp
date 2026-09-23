import { describe, expect, it } from "vitest";
import type { Asset, User } from "@/types/db";
import {
  getMaxUsableBalanceForChain,
  getStockSettlementChain,
} from "./earn-utils";

function profileWithAssets(
  assets: Array<Pick<Asset, "symbol" | "chain" | "amount">>,
): User {
  return {
    id: "user-1",
    assets: assets.map((asset, index) => ({
      id: `asset-${index}`,
      assetType: "CRYPTO" as Asset["assetType"],
      ...asset,
    })),
  };
}

describe("Earn chain balances", () => {
  it("uses only USDC held on the requested settlement chain", () => {
    const profile = profileWithAssets([
      { symbol: "USDC", chain: "base", amount: "12.5" },
      { symbol: "USDC", chain: "ethereum", amount: 4 },
      { symbol: "USDC", chain: "polygon", amount: 20 },
      { symbol: "USDT", chain: "base", amount: 30 },
    ]);

    expect(getMaxUsableBalanceForChain(profile, "USDC", "BASE")).toBe(12.5);
    expect(getMaxUsableBalanceForChain(profile, "USDC", "ethereum")).toBe(4);
  });
});

describe("getStockSettlementChain", () => {
  it("uses BNB for PancakeSwap and Base for legacy providers", () => {
    expect(getStockSettlementChain("pancakeswap")).toBe("bnb");
    expect(getStockSettlementChain("PANCAKESWAP")).toBe("bnb");
    expect(getStockSettlementChain("ondo")).toBe("base");
  });

  it("honors the settlement network supplied by a stock provider", () => {
    expect(getStockSettlementChain("xstocks", "solana")).toBe("solana");
    expect(getStockSettlementChain("provider", "BSC")).toBe("bnb");
    expect(getStockSettlementChain("provider", "Polygon Amoy")).toBe("polygon");
  });
});
