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
  it("uses BSC for PancakeSwap and Base for other stock providers", () => {
    expect(getStockSettlementChain("pancakeswap")).toBe("bsc");
    expect(getStockSettlementChain("PANCAKESWAP")).toBe("bsc");
    expect(getStockSettlementChain("ondo")).toBe("base");
  });
});
