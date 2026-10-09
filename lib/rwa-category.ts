import type { StockListing } from "@/services/api/stocks";

export const RWA_CATEGORIES = [
  "Treasury bills",
  "Real estate",
  "Commodities",
  "Bonds",
];

export function getRwaCategory(listing: StockListing) {
  const value = `${listing.name} ${listing.category || ""} ${listing.rwaCategory || ""}`;
  if (/treasury|t-bill/i.test(value)) return "Treasury bills";
  if (/real.?estate/i.test(value)) return "Real estate";
  if (/commodity|commodities|gold|silver/i.test(value)) return "Commodities";
  if (/bond/i.test(value)) return "Bonds";
  return "All RWA";
}
