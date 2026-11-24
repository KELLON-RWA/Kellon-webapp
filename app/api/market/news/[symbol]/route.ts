import { NextResponse } from "next/server";
import {
  getCompanyNewsName,
  getCompanyNewsQuery,
  normalizeCompanyNews,
  parseGoogleNewsRss,
} from "@/lib/company-news";
import { extractCompanyNewsFacts } from "@/lib/company-news-facts";
import {
  getCachedNews,
  getStaleNews,
  getPendingNews,
  setCachedNews,
  setPendingNews,
  removePendingNews,
  type CachedNewsPayload,
} from "@/lib/stock-market-cache";

export const runtime = "nodejs";
export const revalidate = 900;

async function fetchCompanyNews(
  symbol: string,
  name: string,
  profileOnly: boolean,
  limit = 10,
): Promise<CachedNewsPayload> {
  let googleReturnedEmpty = false;

  try {
    const query = new URLSearchParams({
      q: profileOnly
        ? `(${getCompanyNewsQuery(symbol, name)}) (CEO OR headquartered OR founded OR employees)`
        : getCompanyNewsQuery(symbol, name),
      hl: "en-US",
      gl: "US",
      ceid: "US:en",
    });
    const response = await fetch(
      `https://news.google.com/rss/search?${query}`,
      {
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error("Google News request failed");
    const xml = await response.text();
    if (!/<rss[\s>]/i.test(xml)) throw new Error("Invalid Google News feed");
    const candidates = parseGoogleNewsRss(xml, Math.max(30, limit));
    const articles =
      symbol === "DJT"
        ? candidates.filter((article) =>
            /\bTrump Media\b|\bTMTG\b|\bDJT\b|\bTruth Social\b/i.test(
              article.title,
            ),
          )
        : candidates;

    if (profileOnly) {
      return {
        facts: extractCompanyNewsFacts(articles, name, symbol),
        source: "Google News",
      };
    }

    if (articles.length) {
      return {
        articles: articles.slice(0, limit),
        source: "Google News",
      };
    }
    googleReturnedEmpty = true;
  } catch {
    // Google is primary. Try Finnhub only when it failed or supplied no usable stories.
  }

  if (profileOnly) {
    return { facts: {}, source: "Google News" };
  }

  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    if (googleReturnedEmpty) {
      return { articles: [], source: "Google News" };
    }
    throw new Error("Finnhub token not configured");
  }

  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 7);
  const query = new URLSearchParams({
    symbol: symbol === "SKHY" ? "000660.KS" : symbol,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/company-news?${query}`,
      {
        headers: { "X-Finnhub-Token": token },
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error("Finnhub company news request failed");
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid company news response");

    return {
      articles: normalizeCompanyNews(data, limit),
      source: "Finnhub",
    };
  } catch (err) {
    if (googleReturnedEmpty) {
      return { articles: [], source: "Google News" };
    }
    throw err;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,16}$/.test(symbol)) {
    return NextResponse.json(
      { message: "Invalid stock symbol" },
      { status: 400 },
    );
  }
  const name = getCompanyNewsName(
    new URL(request.url).searchParams.get("name") || "",
  );
  if (!name || name.length > 160) {
    return NextResponse.json(
      { message: "A valid company name is required" },
      { status: 400 },
    );
  }

  const profileOnly = new URL(request.url).searchParams.get("profile") === "1";
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit =
    Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, 30)
      : 10;
  const cacheKey = `${symbol}:${name}:${profileOnly ? "facts" : `articles:${limit}`}`;

  // 1. Check in-memory cache (15-minute TTL)
  const cached = getCachedNews(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, max-age=900, stale-while-revalidate=1800",
        "X-Cache": "HIT",
      },
    });
  }

  // 2. Fetch with in-flight deduplication
  try {
    let pending = getPendingNews(cacheKey);
    if (!pending) {
      pending = fetchCompanyNews(symbol, name, profileOnly, limit).finally(() => {
        removePendingNews(cacheKey);
      });
      setPendingNews(cacheKey, pending);
    }

    const data = await pending;

    // Cache valid payload in memory
    if (
      (data.articles && data.articles.length > 0) ||
      (data.facts && Object.keys(data.facts).length > 0)
    ) {
      setCachedNews(cacheKey, data);
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=900, stale-while-revalidate=1800",
        "X-Cache": "MISS",
      },
    });
  } catch {
    const stale = getStaleNews(cacheKey);
    if (stale) {
      return NextResponse.json(stale, {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          "X-Cache": "STALE",
        },
      });
    }

    return NextResponse.json(
      { message: "Company news is temporarily unavailable" },
      { status: 502 },
    );
  }
}
