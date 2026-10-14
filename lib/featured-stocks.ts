import { isRwaStockListing, type StockListing } from "@/services/api/stocks";
import { getUnderlyingTicker } from "./stock-catalog";
import { getCompanyLogoUrl } from "./stock-branding";

/** Match the unified catalog's company grouping while retaining its first quote. */
export function getFeaturedStocks(listings: StockListing[]) {
  const companies = new Map<string, StockListing>();
  for (const listing of listings) {
    if (isRwaStockListing(listing)) continue;
    const ticker = getUnderlyingTicker(listing.symbol, listing.provider);
    if (ticker && !companies.has(ticker)) companies.set(ticker, listing);
  }
  return [...companies.entries()].slice(0, 5).map(([ticker, listing]) => ({
    ticker,
    name: listing.name
      .replace(/\s+(?:(?:tokenized\s+)?stock|[bcx]stock)$/i, "")
      .trim(),
    price: listing.price,
    href: `/earn/stocks/${encodeURIComponent(ticker)}`,
    logoUrl: getCompanyLogoUrl(ticker) || listing.logoUrl,
  }));
}
