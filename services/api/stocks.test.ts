import { afterEach, describe, expect, it, vi } from "vitest";
import { isRwaStockListing, stocksService } from "./stocks";

const listing = {
  symbol: "AAPL",
  name: "Apple Inc.",
  price: 200,
  currency: "USD",
  provider: "base_b20",
};

describe("stocks service routes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the session-preserving stock proxy routes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: [] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: [] })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await stocksService.getAvailableStocks("all");
    await stocksService.getIndices();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/stocks?provider=all",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/stocks/indices",
      expect.any(Object),
    );
  });

  it("keeps equities and ETFs in the Stock category", () => {
    expect(isRwaStockListing({ ...listing, category: "equity" })).toBe(false);
    expect(isRwaStockListing({ ...listing, category: "etf" })).toBe(false);
    expect(
      isRwaStockListing({ ...listing, rwaCategory: "tokenized_stock" }),
    ).toBe(false);
  });

  it("only classifies explicit real-world asset categories as RWA", () => {
    expect(isRwaStockListing({ ...listing, category: "real_estate" })).toBe(
      true,
    );
    expect(isRwaStockListing({ ...listing, rwaCategory: "treasury" })).toBe(
      true,
    );
  });
});
