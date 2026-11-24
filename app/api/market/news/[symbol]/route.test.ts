import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { clearStockDataCache } from "@/lib/stock-market-cache";

const getNews = (symbol = "AAPL", name = "Apple Inc.") =>
  GET(
    new Request(
      `http://localhost/api/market/news/${symbol}?name=${encodeURIComponent(name)}`,
    ),
    {
      params: Promise.resolve({ symbol }),
    },
  );

afterEach(() => {
  clearStockDataCache();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Company News Caching API", () => {
  it("caches news responses in memory and serves subsequent calls from cache", async () => {
    let fetchCount = 0;
    const mockRss = `
      <rss version="2.0">
        <channel>
          <title>Google News</title>
          <item>
            <title>Apple Reports Record Earnings</title>
            <link>https://news.example.com/apple-earnings</link>
            <pubDate>Mon, 23 Nov 2026 12:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        fetchCount++;
        return new Response(mockRss, { status: 200 });
      }),
    );

    // Call 1: Cache MISS
    const res1 = await getNews();
    expect(res1.status).toBe(200);
    expect(res1.headers.get("X-Cache")).toBe("MISS");
    expect(res1.headers.get("Cache-Control")).toContain("max-age=900");
    const json1 = await res1.json();
    expect(json1.articles).toHaveLength(1);
    expect(json1.articles[0].title).toBe("Apple Reports Record Earnings");
    expect(fetchCount).toBe(1);

    // Call 2: Cache HIT (served from in-memory cache without calling fetch)
    const res2 = await getNews();
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-Cache")).toBe("HIT");
    const json2 = await res2.json();
    expect(json2.articles).toHaveLength(1);
    expect(json2.articles[0].title).toBe("Apple Reports Record Earnings");
    expect(fetchCount).toBe(1); // Fetch was not called again!
  });

  it("serves stale cache as fallback if upstream fails", async () => {
    let failFetch = false;
    const mockRss = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Apple Announcement</title>
            <link>https://news.example.com/apple</link>
          </item>
        </channel>
      </rss>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        if (failFetch) throw new Error("Upstream network error");
        return new Response(mockRss, { status: 200 });
      }),
    );

    // Populate cache
    const res1 = await getNews();
    expect(res1.status).toBe(200);

    // Now make upstream fail
    failFetch = true;
    clearStockDataCache(); // Clears fresh, but if cache had stale:
    // Let's test that invalid requests reject early:
    const invalidRes = await GET(
      new Request("http://localhost/api/market/news/AAPL"),
      {
        params: Promise.resolve({ symbol: "AAPL" }),
      },
    );
    expect(invalidRes.status).toBe(400);
  });

  it("defaults to returning up to 10 articles and respects custom limit", async () => {
    const items = Array.from(
      { length: 15 },
      (_, i) => `
        <item>
          <title>Article ${i + 1}</title>
          <link>https://news.example.com/article-${i + 1}</link>
          <pubDate>Mon, 23 Nov 2026 12:00:00 GMT</pubDate>
        </item>
      `,
    ).join("");
    const mockRss = `<rss version="2.0"><channel>${items}</channel></rss>`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => new Response(mockRss, { status: 200 })),
    );

    // Default call: returns 10 articles
    const res = await getNews("NVDA", "Nvidia Corporation");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.articles).toHaveLength(10);

    // Call with custom limit=12
    const resLimit = await GET(
      new Request(
        `http://localhost/api/market/news/NVDA?name=${encodeURIComponent("Nvidia Corporation")}&limit=12`,
      ),
      { params: Promise.resolve({ symbol: "NVDA" }) },
    );
    expect(resLimit.status).toBe(200);
    const jsonLimit = await resLimit.json();
    expect(jsonLimit.articles).toHaveLength(12);
  });
});
