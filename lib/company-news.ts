export type CompanyNewsArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
};

export type CompanyNewsSource = "Google News" | "Finnhub";

export function getCompanyNewsName(name: string): string {
  return name.replace(/\s+(?:tokenized\s+stock|[bcx]stock|IPO)$/i, "").trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseGoogleNewsRss(xml: string): CompanyNewsArticle[] {
  return normalizeCompanyNews(
    (xml.match(/<item>[\s\S]*?<\/item>/gi) || []).map((item) => {
      const field = (name: string) => {
        const match = item.match(
          new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
        );
        return match ? decodeXml(match[1].trim()) : "";
      };
      const date = Date.parse(field("pubDate"));
      return {
        headline: field("title"),
        url: field("link"),
        source: field("source") || "Google News",
        datetime: Number.isFinite(date) ? date / 1000 : 0,
      };
    }),
  );
}

/** Normalize Finnhub headlines, removing invalid links and duplicate stories. */
export function normalizeCompanyNews(
  data: unknown[],
  limit = 6,
): CompanyNewsArticle[] {
  const articles: CompanyNewsArticle[] = [];
  const seen = new Set<string>();
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const title = typeof item.headline === "string" ? item.headline.trim() : "";
    const rawUrl = typeof item.url === "string" ? item.url.trim() : "";
    if (!title || !rawUrl) continue;
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      continue;
    }
    if (!["https:", "http:"].includes(url.protocol)) continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const timestamp = typeof item.datetime === "number" ? item.datetime : 0;
    const date = new Date(timestamp * 1000);
    articles.push({
      title,
      url: url.href,
      source:
        typeof item.source === "string" && item.source.trim()
          ? item.source.trim()
          : "Finnhub",
      publishedAt:
        timestamp > 0 && Number.isFinite(date.getTime())
          ? date.toISOString()
          : "",
    });
  }
  return articles
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, limit);
}
