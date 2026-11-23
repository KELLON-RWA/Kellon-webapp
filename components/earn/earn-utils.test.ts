import { describe, expect, it } from "vitest";
import type { Asset, User } from "@/types/db";
import {
  getMaxUsableBalanceForChain,
  getStockProviderLabel,
  getStockSettlementChain,
  resolveStockCategory,
  sanitizeWikidataIndustry,
} from "./earn-utils";
import { getDisplayStockName } from "./EarnPage";

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

describe("getStockProviderLabel", () => {
  it("keeps Bstock labels separate from the PancakeSwap execution provider", () => {
    expect(getStockProviderLabel("PancakeSwap")).toBe("Bstock");
    expect(getStockProviderLabel("pancake_swap")).toBe("Bstock");
    expect(getStockProviderLabel("bstock")).toBe("Bstock");
  });

  it("preserves other provider-facing stock labels", () => {
    expect(getStockProviderLabel("Solana Xstocks")).toBe("Solana Xstocks");
  });
});

describe("getDisplayStockName", () => {
  it("replaces xStock, Ondo Stock, Ondo Tokenized Stock, bStock, and cStock with Tokenized Stock", () => {
    expect(getDisplayStockName("Anthropic xStock")).toBe("Anthropic Tokenized Stock");
    expect(getDisplayStockName("Berkshire Hathaway xStock")).toBe("Berkshire Hathaway Tokenized Stock");
    expect(getDisplayStockName("Coinbase xStock")).toBe("Coinbase Tokenized Stock");
    expect(getDisplayStockName("Apple Inc. Ondo Tokenized Stock")).toBe("Apple Inc. Tokenized Stock");
    expect(getDisplayStockName("Apple Inc. Ondo Stock")).toBe("Apple Inc. Tokenized Stock");
    expect(getDisplayStockName("Apple bStock")).toBe("Apple Tokenized Stock");
    expect(getDisplayStockName("Apple cStock")).toBe("Apple Tokenized Stock");
    expect(getDisplayStockName("Apple Inc. Tokenized Stock")).toBe("Apple Inc. Tokenized Stock");
  });

  it("leaves standard company names untouched", () => {
    expect(getDisplayStockName("AMC Entertainment")).toBe("AMC Entertainment");
    expect(getDisplayStockName("Alibaba")).toBe("Alibaba");
  });
});

describe("resolveStockCategory", () => {
  it("resolves clean stock category for Apple and other known tickers", () => {
    expect(
      resolveStockCategory({
        ticker: "AAPL",
        wikidataProfile: {
          industry:
            "software industry & consumer electronics industry & digital distribution & electronics industry & information technology industry & mobile phone industry & software development",
        },
      }),
    ).toBe("Technology");

    expect(resolveStockCategory({ ticker: "MSFT" })).toBe("Technology");
    expect(resolveStockCategory({ ticker: "NVDA" })).toBe("Technology");
    expect(resolveStockCategory({ ticker: "COIN" })).toBe("Financial Services");
    expect(resolveStockCategory({ ticker: "TSLA" })).toBe("Automotive");
  });

  it("sanitizes long Wikidata industry strings into a concise category", () => {
    expect(
      sanitizeWikidataIndustry(
        "software industry & consumer electronics industry & digital distribution & electronics industry & information technology industry & mobile phone industry & software development",
      ),
    ).toBe("Technology");

    expect(
      sanitizeWikidataIndustry("financial services & investment banking"),
    ).toBe("Financial Services");

    expect(
      sanitizeWikidataIndustry("petroleum industry & oil refinery"),
    ).toBe("Energy");
  });

  it("prioritizes company sector, facts industry, official Finnhub industry, and RWA category", () => {
    expect(
      resolveStockCategory({
        company: { sector: "Technology" },
        wikidataProfile: { industry: "some random string" },
      }),
    ).toBe("Technology");

    expect(
      resolveStockCategory({
        company: {
          facts: [{ label: "Refinery Capacity", value: "650,000 bpd" }],
          industry: "Oil & Gas Refining",
        },
      }),
    ).toBe("Oil & Gas Refining");

    expect(
      resolveStockCategory({
        officialProfile: { industry: "Semiconductors" },
      }),
    ).toBe("Semiconductors");

    expect(
      resolveStockCategory({
        rwaCategory: "treasuries",
      }),
    ).toBe("Treasuries");
  });
});

