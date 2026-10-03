import { describe, expect, it } from "vitest";
import { mergeLiveStockQuote } from "./StockSparkline";

describe("mergeLiveStockQuote", () => {
  it("appends a newer live quote without changing the historical input", () => {
    const values = [330, 332];
    const timestamps = [1_000, 2_000];

    expect(mergeLiveStockQuote(values, timestamps, 333.66, 3_000_000)).toEqual({
      values: [330, 332, 333.66],
      timestamps: [1_000, 2_000, 3_000],
    });
    expect(values).toEqual([330, 332]);
    expect(timestamps).toEqual([1_000, 2_000]);
  });

  it("updates the last candle when the live quote is from the same minute", () => {
    expect(
      mergeLiveStockQuote([330, 332], [1_000, 2_000], 333.66, 2_030_000),
    ).toEqual({
      values: [330, 333.66],
      timestamps: [1_000, 2_030],
    });
  });

  it("ignores an invalid live quote", () => {
    expect(mergeLiveStockQuote([330], [1_000], 0, 2_000_000)).toEqual({
      values: [330],
      timestamps: [1_000],
    });
  });

  it("does not overwrite a newer historical candle with an older quote", () => {
    expect(
      mergeLiveStockQuote([330, 334], [1_000, 3_000], 333.66, 2_000_000),
    ).toEqual({
      values: [330, 334],
      timestamps: [1_000, 3_000],
    });
  });
});
