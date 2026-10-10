import { afterEach, describe, expect, it, vi } from "vitest";
import { isRwaStockListing, stocksService } from "./stocks";
import { handleTransferResponse } from "./transfers";

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

  it("preserves the backend stranded-shares code for recovery", async () => {
    await expect(
      handleTransferResponse(
        new Response(
          JSON.stringify({
            error: {
              code: "STOCK_SHARES_STRANDED",
              message: "Move shares first",
            },
          }),
          { status: 400 },
        ),
      ),
    ).rejects.toMatchObject({
      code: "STOCK_SHARES_STRANDED",
      message: "Move shares first",
    });
  });

  it("classifies explicit real-world asset categories as RWA", () => {
    expect(isRwaStockListing({ ...listing, category: "real_estate" })).toBe(
      true,
    );
    expect(isRwaStockListing({ ...listing, rwaCategory: "treasury" })).toBe(
      true,
    );
  });

  it("recognizes the treasury fund when legacy listings omit category metadata", () => {
    expect(
      isRwaStockListing({
        ...listing,
        symbol: "GNTb",
        name: "GetEquity Nigerian Treasury Bills Fund",
      }),
    ).toBe(true);
    expect(
      isRwaStockListing({
        ...listing,
        symbol: "gNTB",
        name: "Nigerian Treasury Bills Fund",
      }),
    ).toBe(true);
    expect(
      isRwaStockListing({
        ...listing,
        symbol: "DPRI",
        name: "Dangote Petroleum Refinery IPO",
      }),
    ).toBe(false);
  });
});
