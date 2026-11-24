import { describe, expect, it } from "vitest";
import { getUnderlyingTicker } from "./stock-catalog";

describe("getUnderlyingTicker", () => {
  it("normalizes base, bsc, and xstock symbols", () => {
    expect(getUnderlyingTicker("AAPL")).toBe("AAPL");
    expect(getUnderlyingTicker("AAPLc")).toBe("AAPL");
    expect(getUnderlyingTicker("AAPLB")).toBe("AAPL");
    expect(getUnderlyingTicker("bAAPL")).toBe("AAPL");
    expect(getUnderlyingTicker("AAPLx", "solana_xstocks")).toBe("AAPL");
    expect(getUnderlyingTicker("AMC")).toBe("AMC");
    expect(getUnderlyingTicker("amc")).toBe("AMC");
    expect(getUnderlyingTicker("AMCc")).toBe("AMC");
    expect(getUnderlyingTicker("AMCc", "base_b20")).toBe("AMC");
    expect(getUnderlyingTicker("INTC")).toBe("INTC");
    expect(getUnderlyingTicker("intc")).toBe("INTC");
    expect(getUnderlyingTicker("INTCc")).toBe("INTC");
    expect(getUnderlyingTicker("BNC")).toBe("BNC");
    expect(getUnderlyingTicker("BNCc")).toBe("BNC");
  });

  it("normalizes ondo tickers to underlying instrument ticker", () => {
    expect(getUnderlyingTicker("AAPLON")).toBe("AAPL");
    expect(getUnderlyingTicker("AAPLON", "ondo")).toBe("AAPL");
    expect(getUnderlyingTicker("AMZNON", "ondo")).toBe("AMZN");
    expect(getUnderlyingTicker("NVDAON")).toBe("NVDA");
    expect(getUnderlyingTicker("TSLAON", "ondo_finance")).toBe("TSLA");
    expect(getUnderlyingTicker("SPYON", "ondo")).toBe("SPY");
  });

  it("does not strip ON from unrelated tickers when provider is not ondo", () => {
    expect(getUnderlyingTicker("AON")).toBe("AON");
  });
});
