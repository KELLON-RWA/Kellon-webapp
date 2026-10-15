import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const get = () =>
  GET(new Request("http://localhost/api/market/stocks/AAPL"), {
    params: Promise.resolve({ symbol: "AAPL" }),
  });
afterEach(() => {
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
});
