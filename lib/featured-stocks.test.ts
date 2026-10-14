import { describe, expect, it } from "vitest";
import type { StockListing } from "@/services/api/stocks";
import { getFeaturedStocks } from "./featured-stocks";

const stock = (
  symbol: string,
  provider: string,
  name: string,
): StockListing => ({
  symbol,
  provider,
  name,
  price: 200,
  currency: "USD",
});

describe("featured stocks", () => {
  it("groups all provider variants and links to the company page", () => {
    const listings = [
      stock("AAPLc", "base_b20", "Apple Inc. Tokenized Stock"),
      stock("AAPLB", "pancakeswap", "Apple bStock"),
      stock("AAPLx", "solana_xstocks", "Apple xStock"),
    ];
    expect(getFeaturedStocks(listings)).toEqual([
      {
        ticker: "AAPL",
        name: "Apple Inc.",
        price: 200,
        href: "/earn/stocks/AAPL",
        logoUrl: expect.stringContaining("apple.com"),
      },
    ]);
    expect(listings[0].name).toBe("Apple Inc. Tokenized Stock");
  });

  it("excludes real-world assets and limits after grouping", () => {
    const listings = [
      stock("GNTb", "pancakeswap", "Treasury Bills Fund"),
      stock("AAPLc", "base_b20", "Apple Stock"),
      stock("AAPLx", "solana_xstocks", "Apple xStock"),
      ...["AMZN", "NVDA", "TSLA", "META", "MSFT"].map((ticker) =>
        stock(`${ticker}x`, "solana_xstocks", `${ticker} xStock`),
      ),
    ];
    expect(getFeaturedStocks(listings).map((s) => s.ticker)).toEqual([
      "AAPL",
      "AMZN",
      "NVDA",
      "TSLA",
      "META",
    ]);
  });

  it("preserves a supplied logo for unknown companies and handles empty data", () => {
    expect(
      getFeaturedStocks([
        {
          ...stock("XYZ", "other", "Example"),
          logoUrl: "https://example.com/logo.png",
        },
      ])[0].logoUrl,
    ).toBe("https://example.com/logo.png");
    expect(getFeaturedStocks([])).toEqual([]);
  });
});
