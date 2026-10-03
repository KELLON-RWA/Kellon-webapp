import { describe, expect, it } from "vitest";
import { normalizeBridgeAmount } from "./bridge";

describe("normalizeBridgeAmount", () => {
  it("truncates bridge amounts to CCTP's six-decimal precision", () => {
    expect(normalizeBridgeAmount("2.1703870000000003")).toBe("2.170387");
    expect(normalizeBridgeAmount("2.1703879")).toBe("2.170387");
  });

  it("retains valid precision without rounding up a maximum balance", () => {
    expect(normalizeBridgeAmount("2.170387")).toBe("2.170387");
    expect(normalizeBridgeAmount(1.0000009)).toBe("1");
    expect(normalizeBridgeAmount("12")).toBe("12");
  });
});
