import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;

const MAX_ARTICLES = 6;

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getRssField(item: string, field: string) {
  const match = item.match(
    new RegExp(`<${field}>([\\s\\S]*?)</${field}>`, "i"),
  );
  return match ? decodeXml(match[1].trim()) : "";
}

function parseGoogleNewsRss(xml: string) {
  return (
    xml
      .match(/<item>[\s\S]*?<\/item>/gi)
      ?.slice(0, MAX_ARTICLES)
      .flatMap((item) => {
        const title = getRssField(item, "title");
        const url = getRssField(item, "link");
        const publishedAt = getRssField(item, "pubDate");
        const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
        const source = sourceMatch
          ? decodeXml(sourceMatch[1].trim())
          : "Google News";

        return title && url ? [{ title, url, source, publishedAt }] : [];
      }) || []
  );
}

export async function GET(
  _request: Request,
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

  try {
    const query = encodeURIComponent(`${symbol} stock`);
    const response = await fetch(
      `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
      { next: { revalidate: 300 } },
    );
    if (!response.ok) throw new Error("Google News request failed");

    return NextResponse.json({
      articles: parseGoogleNewsRss(await response.text()),
      source: "Google News",
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to load Google News stories" },
      { status: 502 },
    );
  }
}
