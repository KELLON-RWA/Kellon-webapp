const ONDO_TICKER_REGEX =
  /^(AAPL|AMZN|NVDA|TSLA|GOOGL|MSFT|META|COIN|AVGO|AMD|NFLX|INTC|QCOM|SPY|QQQ|BABA|ORCL|DIS|PYPL|UBER|ABNB|CRM|PLTR|ARM|MSTR)ON$/i;

/** Underlying company ticker shared by the unified catalog and global search. */
export function getUnderlyingTicker(symbol: string, provider?: string): string {
  const raw = symbol.trim();
  const isOndo =
    Boolean(provider?.toLowerCase().includes("ondo")) ||
    ONDO_TICKER_REGEX.test(raw) ||
    (/on$/i.test(raw) && raw.length > 3 && Boolean(provider?.toLowerCase().includes("ondo")));
  const withoutOndoSuffix =
    isOndo && /on$/i.test(raw) ? raw.slice(0, -2) : raw;
  const withoutProviderSuffix = /[bc]$/i.test(withoutOndoSuffix)
    ? withoutOndoSuffix.slice(0, -1)
    : withoutOndoSuffix;
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
