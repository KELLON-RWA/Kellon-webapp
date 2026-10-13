/** Underlying company ticker shared by the unified catalog and global search. */
export function getUnderlyingTicker(symbol: string, provider?: string): string {
  const raw = symbol.trim();
  const withoutProviderSuffix = /[bc]$/i.test(raw) ? raw.slice(0, -1) : raw;
  const withoutXStockSuffix =
    provider?.toLowerCase().includes("xstock") &&
    /x$/i.test(withoutProviderSuffix)
      ? withoutProviderSuffix.slice(0, -1)
      : withoutProviderSuffix;

  return (
    withoutXStockSuffix.startsWith("b")
      ? withoutXStockSuffix.slice(1)
      : withoutXStockSuffix
  ).toUpperCase();
}
