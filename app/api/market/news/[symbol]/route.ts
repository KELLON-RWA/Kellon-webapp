import { NextResponse } from "next/server";
import {
  getCompanyNewsName,
  normalizeCompanyNews,
  parseGoogleNewsRss,
} from "@/lib/company-news";

export const runtime = "nodejs";
export const revalidate = 300;

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
  let googleReturnedEmpty = false;
  try {
    const query = new URLSearchParams({
      q: name,
      hl: "en-US",
      gl: "US",
      ceid: "US:en",
    });
    const response = await fetch(
      `https://news.google.com/rss/search?${query}`,
      {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error("Google News request failed");
    const xml = await response.text();
    if (!/<rss[\s>]/i.test(xml)) throw new Error("Invalid Google News feed");
    const articles = parseGoogleNewsRss(xml);
    if (articles.length)
      return NextResponse.json({ articles, source: "Google News" });
    googleReturnedEmpty = true;
  } catch {
    // Google is primary. Try Finnhub only when it failed or supplied no usable stories.
  }

  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    return googleReturnedEmpty
      ? NextResponse.json({ articles: [], source: "Google News" })
      : NextResponse.json(
          { message: "Company news is temporarily unavailable" },
          { status: 502 },
        );
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
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error("Finnhub company news request failed");
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid company news response");

    return NextResponse.json({
      articles: normalizeCompanyNews(data),
      source: "Finnhub",
    });
  } catch {
    return googleReturnedEmpty
      ? NextResponse.json({ articles: [], source: "Google News" })
      : NextResponse.json(
          { message: "Company news is temporarily unavailable" },
          { status: 502 },
        );
  }
}
