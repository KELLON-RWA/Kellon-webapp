import { describe, expect, it } from "vitest";
import type { StockListing } from "@/services/api/stocks";
import { getStockSearchResults } from "./stock-search";

const stock = (
  symbol: string,
  provider: string,
  name: string,
): StockListing => ({ symbol, provider, name, price: 200, currency: "USD" });
const apple = [
  stock("AAPLc", "base_b20", "Apple Inc. Tokenized Stock"),
  stock("AAPLB", "pancakeswap", "Apple bStock"),
  stock("AAPLx", "solana_xstocks", "Apple xStock"),
];

describe("unified stock search", () => {
  it("shows one Apple result linking to the unified company page", () => {
    expect(getStockSearchResults(apple, "app")).toEqual([
      {
        id: "stock:AAPL",
        label: "AAPL",
        description: "Apple Inc.",
        href: "/earn/stocks/AAPL",
        type: "stock",
      },
    ]);
  });

  it.each(["aapl", "AAPLc", "AAPLB", "AAPLx", "solana_xstocks"])(
    "keeps %s searchable without a provider-specific destination",
    (query) => {
      expect(getStockSearchResults(apple, query)).toHaveLength(1);
      expect(getStockSearchResults(apple, query)[0].href).toBe(
        "/earn/stocks/AAPL",
      );
    },
  );

  it("applies the limit after deduplication, leaving room for other companies", () => {
    const listings = [
      ...apple,
      stock("NVDAc", "base_b20", "NVIDIA Stock"),
      stock("NVDAx", "solana_xstocks", "NVIDIA xStock"),
      stock("TSLAb", "pancakeswap", "Tesla bStock"),
    ];
    expect(
      getStockSearchResults(listings, "stock", 3).map((result) => result.label),
    ).toEqual(["AAPL", "NVDA", "TSLA"]);
  });

  it("deduplicates real-world assets without classifying them as equities", () => {
    const listings = [
      stock("GNTb", "pancakeswap", "Nigerian Treasury Bills Fund"),
      stock("GNTc", "base_b20", "Nigerian Treasury Bills Fund"),
    ];
    expect(getStockSearchResults(listings, "treasury")).toEqual([
      expect.objectContaining({
        id: "rwa:GNT",
        type: "rwa",
        href: "/earn/stocks/GNT",
      }),
    ]);
  });

  it("handles whitespace, empty queries, and empty catalogs", () => {
    expect(getStockSearchResults(apple, " APP ")).toHaveLength(1);
    expect(getStockSearchResults(apple, " ")).toEqual([]);
    expect(getStockSearchResults([], "apple")).toEqual([]);
  });

  it("does not collapse distinct companies or mutate provider listings", () => {
    const original = structuredClone(apple);
    const results = getStockSearchResults(
      [...apple, stock("AMZNx", "solana_xstocks", "Amazon xStock")],
      "stock",
    );
    expect(results.map((result) => result.label)).toEqual(["AAPL", "AMZN"]);
    expect(apple).toEqual(original);
  });
});
