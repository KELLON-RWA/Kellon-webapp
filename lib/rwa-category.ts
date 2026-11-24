import type { StockListing } from "@/services/api/stocks";

export const RWA_CATEGORIES = [
  "Direct T-Bills",
  "Bond ETFs",
  "Real Estate",
  "Commodities",
];

export function getRwaCategory(listing: StockListing): string {
  const symbol = (listing.symbol || "").toUpperCase();
  const value = `${listing.symbol} ${listing.name} ${listing.category || ""} ${listing.rwaCategory || ""}`.toLowerCase();

  // Direct Sovereign T-Bills (e.g. gNTB / Nigerian Treasury Bills Fund)
  if (/gntb?|direct\s*t-?bill/i.test(symbol) || /\bnigerian treasury bills?\b/i.test(value)) {
    return "Direct T-Bills";
  }

  // Real Estate
  if (/real.?estate|reit/i.test(value)) {
    return "Real Estate";
  }

  // Commodities (Gold, Silver, Oil)
  if (/commodity|commodities|gold|silver|oil|gld|slv|iau|uso/i.test(value)) {
    return "Commodities";
  }

  // Bond & Treasury ETFs: SGOV, TLT, FXI, SHY, IEF, BIL, BND, AGG, etc.
  if (/sgov|tlt|fxi|shy|ief|bil|bnd|agg|bond|t-bill|treasury/i.test(value)) {
    return "Bond ETFs";
  }

  return "Bond ETFs";
}
