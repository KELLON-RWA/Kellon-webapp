export type CompanyNewsArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
  imageUrl?: string;
};

export type CompanyNewsSource = "Google News" | "Finnhub";

export function getCompanyNewsName(name: string): string {
  return name
    .replace(
      /\s+(?:(?:ondo\s+)?tokenized\s+stock|ondo\s+stock|[bcx]stock|IPO)$/i,
      "",
    )
    .trim();
}

export function getCompanyNewsQuery(symbol: string, name: string): string {
  if (symbol === "DJT")
    return '"Trump Media & Technology Group" OR "Trump Media and Technology Group"';
  if (symbol === "DPRI")
    return '"Dangote Petroleum Refinery" OR "Dangote Refinery"';
  return `"${getCompanyNewsName(name).replace(/"/g, "")}"`;
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

function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(decodeXml(value.trim()));
    if (url.protocol !== "https:" || url.username || url.password)
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function rssImage(item: string, description: string): string | undefined {
  // Only images supplied by the feed; do not scrape or guess publisher images.
  const tags =
    item.match(/<(?:media:thumbnail|media:content|enclosure)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const type = tag.match(/\btype=["']([^"']+)["']/i)?.[1];
    const medium = tag.match(/\bmedium=["']([^"']+)["']/i)?.[1];
    const url = tag.match(/\burl=["']([^"']+)["']/i)?.[1];
    if (
      /^<media:thumbnail/i.test(tag) ||
      medium === "image" ||
      type?.startsWith("image/")
    ) {
      const image = safeImageUrl(url);
      if (image) return image;
    }
  }
  return safeImageUrl(
    description.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1],
  );
}

export function parseGoogleNewsRss(
  xml: string,
  limit = 6,
): CompanyNewsArticle[] {
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
        image: rssImage(item, field("description")),
        summary: field("description")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      };
    }),
    limit,
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
      ...(typeof item.summary === "string" && item.summary.trim()
        ? { summary: item.summary.trim() }
        : {}),
      ...(safeImageUrl(item.image)
        ? { imageUrl: safeImageUrl(item.image) }
        : {}),
    });
  }
  return articles
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, limit);
}
