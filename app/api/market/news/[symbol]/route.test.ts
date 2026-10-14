import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const get = (symbol = "AAPL", name = "Apple Inc.") =>
  GET(
    new Request(
      "http://localhost/api/market/news/" +
        encodeURIComponent(symbol) +
        "?" +
        new URLSearchParams({ name }),
    ),
    {
      params: Promise.resolve({ symbol }),
    },
  );

describe("company news proxy", () => {
  it("searches by company name, removing the IPO suffix", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("<rss><channel/></rss>"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FINNHUB_API_KEY", "");
    await get("DPRI", "Dangote Petroleum Refinery IPO");
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("q")).toBe(
      "Dangote Petroleum Refinery",
    );
  });
  it("requires a company name instead of silently searching the ticker", async () => {
    expect((await get("AAPL", "")).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  beforeEach(() =>
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unavailable"))),
  );
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("keeps the API key server-side and requests a seven-day range", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("<rss><channel></channel></rss>"))
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              headline: "Apple news",
              url: "https://news.example/apple",
              datetime: 100,
              source: "Reuters",
            },
          ]),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const response = await get();
    const body = await response.json();
    const [url, options] = fetchMock.mock.calls[1];
    expect(new URL(url).searchParams.get("from")).toBe("2026-10-07");
    expect(new URL(url).searchParams.get("to")).toBe("2026-10-14");
    expect(new URL(url).searchParams.get("symbol")).toBe("AAPL");
    expect(url).not.toContain("test-secret");
    expect(options.headers).toEqual({ "X-Finnhub-Token": "test-secret" });
    expect(body).toMatchObject({
      source: "Finnhub",
      articles: [{ title: "Apple news" }],
    });
    expect(JSON.stringify(body)).not.toContain("test-secret");
  });

  it("rejects invalid tickers without calling upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await get("AAPL?token=x")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an outage when Google fails and fallback credentials are missing", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "");
    expect((await get()).status).toBe(502);
  });

  it("distinguishes upstream failures from no stories", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("Google unavailable"))
        .mockResolvedValueOnce(new Response("{}", { status: 429 }))
        .mockRejectedValueOnce(new Error("Google unavailable"))
        .mockResolvedValueOnce(new Response("[]")),
    );
    expect((await get()).status).toBe(502);
    expect(await (await get()).json()).toEqual({
      source: "Finnhub",
      articles: [],
    });
  });

  it("rejects an upstream error object returned with status 200", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("Google unavailable"))
        .mockResolvedValue(
          new Response(JSON.stringify({ error: "Not authorized" })),
        ),
    );
    expect((await get()).status).toBe(502);
  });

  it("uses Google first and does not call Finnhub when Google has stories", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          "<rss><channel><item><title>Apple news</title><link>https://news.example/apple</link><source>Reuters</source><pubDate>Wed, 14 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>",
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await get()).json()).toMatchObject({
      source: "Google News",
      articles: [{ title: "Apple news", source: "Reuters" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "https://news.google.com/rss/search?",
    );
  });

  it("returns an empty Google feed when the fallback fails", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("<rss><channel/></rss>"))
        .mockRejectedValueOnce(new Error("Finnhub unavailable")),
    );
    expect(await (await get()).json()).toEqual({
      articles: [],
      source: "Google News",
    });
  });
});
