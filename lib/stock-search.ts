import { isRwaStockListing, type StockListing } from "@/services/api/stocks";
import { getUnderlyingTicker } from "./stock-catalog";

export function getStockSearchResults(
  listings: StockListing[],
  query: string,
  limit = 6,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  const grouped = new Map<
    string,
    { ticker: string; type: "stock" | "rwa"; listings: StockListing[] }
  >();
  for (const listing of listings) {
    const ticker = getUnderlyingTicker(listing.symbol, listing.provider);
    if (!ticker) continue;
    const type = isRwaStockListing(listing) ? "rwa" : "stock";
    const key = `${type}:${ticker}`;
    const group = grouped.get(key);
    if (group) group.listings.push(listing);
    else grouped.set(key, { ticker, type, listings: [listing] });
  }

  return [...grouped.entries()]
    .filter(([, group]) =>
      [
        group.ticker,
        ...group.listings.flatMap((listing) => [
          listing.symbol,
          listing.name,
          listing.provider,
          listing.category,
          listing.rwaCategory,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .slice(0, limit)
    .map(([id, group]) => ({
      id,
      label: group.ticker,
      description: group.listings[0].name
        .replace(/\s+(?:(?:tokenized\s+)?stock|[bcx]stock)$/i, "")
        .trim(),
      href: `/earn/stocks/${encodeURIComponent(group.ticker)}`,
      type: group.type,
    }));
}
