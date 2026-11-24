import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { clearStockDataCache } from "@/lib/stock-market-cache";
const get = () =>
  GET(new Request("http://localhost/api/market/stocks/AAPL"), {
    params: Promise.resolve({ symbol: "AAPL" }),
  });
afterEach(() => {
  clearStockDataCache();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Finnhub partial data", () => {
  it("preserves quote and metrics when company profile fails", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-secret");
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("profile2")) throw new Error("Unavailable");
      return new Response(
        JSON.stringify(
          url.includes("/quote?") ? { c: 200 } : { metric: { peTTM: 20 } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await get()).json()).toMatchObject({
      quote: { current: 200 },
      profile: null,
      metrics: { peTTM: 20 },
    });
    expect(
      fetchMock.mock.calls.every(
        ([url, options]) =>
          !url.includes("test-secret") &&
          options.headers["X-Finnhub-Token"] === "test-secret",
      ),
    ).toBe(true);
  });
  it("does not present empty or error responses as available profile data", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    expect(await (await get()).json()).toMatchObject({
      quote: null,
      profile: null,
      metrics: {},
    });
  });

  it("caches market data and serves from memory on repeated calls", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-secret");
    let fetchCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      fetchCount++;
      return new Response(JSON.stringify({ metric: { peTTM: 35 } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const res1 = await get();
    expect(res1.headers.get("X-Cache")).toBe("MISS");
    expect(await res1.json()).toMatchObject({ metrics: { peTTM: 35 } });
    const countAfterFirst = fetchCount;

    const res2 = await get();
    expect(res2.headers.get("X-Cache")).toBe("HIT");
    expect(await res2.json()).toMatchObject({ metrics: { peTTM: 35 } });
    // Fetch should not have been called again!
    expect(fetchCount).toBe(countAfterFirst);
  });
});
