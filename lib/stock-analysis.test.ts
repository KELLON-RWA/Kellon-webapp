import { describe, expect, it } from "vitest";
import { getStockAnalysisData } from "./stock-analysis";

describe("stock-analysis", () => {
  it("returns preset data for GOOGL matching screenshot specs", () => {
    const data = getStockAnalysisData("GOOGL", "Alphabet Inc.");
    expect(data.technical.rsi).toBe(38.2);
    expect(data.technical.rsiStatus).toBe("Balanced");
    expect(data.technical.vsSma30d).toBe("-6.80%");
    expect(data.technical.range52wPosition).toBe("13% of Range");
    expect(data.technical.range52wText).toBe("$264.22 - $408.61");
    expect(data.socialPosts.length).toBe(5);
    expect(data.consensus.label).toBe("Buy (68)");
    expect(data.consensus.strongBuy).toBe(20);
    expect(data.consensus.buy).toBe(41);
    expect(data.consensus.hold).toBe(7);
    expect(data.consensus.sell).toBe(0);
    expect(data.insiderActivity[0].name).toBe("Hennessy John L.");
    expect(data.insiderActivity[0].shares).toBe("-300");
  });

  it("returns fallback data for unknown tickers", () => {
    const data = getStockAnalysisData("UNKNOWN", "Unknown Inc.", 100);
    expect(data.technical.rsi).toBe(50.0);
    expect(data.socialPosts.length).toBe(5);
    expect(data.consensus.total).toBe(45);
    expect(data.insiderActivity.length).toBeGreaterThan(0);
  });
});
