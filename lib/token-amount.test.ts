import { describe, expect, it } from "vitest";
import { clampDust, formatMaxInputAmount } from "./token-amount";
import { parseUnits } from "viem";

describe("token-amount", () => {
  describe("formatMaxInputAmount", () => {
    it("truncates float balances down so clicking MAX never rounds up", () => {
      // 1.4175711614398763 rounds UP in JS float, but formatMaxInputAmount truncates down
      const maxStr = formatMaxInputAmount(1.4175711614398763, 6);
      expect(maxStr).toBe("1.417571");

      const onChain = 1417571161439876279n;
      const parsed = parseUnits(maxStr, 18);
      // Must be strictly less than or equal to on-chain balance
      expect(parsed <= onChain).toBe(true);
    });

    it("handles zero, empty, and negative values cleanly", () => {
      expect(formatMaxInputAmount(0)).toBe("0");
      expect(formatMaxInputAmount("")).toBe("0");
      expect(formatMaxInputAmount(null)).toBe("0");
      expect(formatMaxInputAmount(undefined)).toBe("0");
      expect(formatMaxInputAmount(-5)).toBe("0");
    });

    it("strips trailing zeros cleanly", () => {
      expect(formatMaxInputAmount("1.500000", 6)).toBe("1.5");
      expect(formatMaxInputAmount(2.0, 6)).toBe("2");
    });

    it("preserves exact integer amounts", () => {
      expect(formatMaxInputAmount(100, 6)).toBe("100");
      expect(formatMaxInputAmount("500", 6)).toBe("500");
    });
  });

  describe("clampDust", () => {
    it("clamps requested amount to balance when difference is within rounding dust", () => {
      const onChain = 1417571161439876279n;
      const requestedWith21WeiOvershoot = 1417571161439876300n; // 21 wei difference

      const clamped = clampDust(requestedWith21WeiOvershoot, onChain, 18);
      expect(clamped).toBe(onChain);
    });

    it("does not clamp when requested exceeds balance by more than dust threshold", () => {
      const onChain = 1000000000000000000n; // 1 token
      const requested = 2000000000000000000n; // 2 tokens

      const clamped = clampDust(requested, onChain, 18);
      expect(clamped).toBe(requested);
      expect(onChain < clamped).toBe(true);
    });
  });
});
