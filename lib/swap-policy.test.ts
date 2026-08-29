import { describe, expect, it } from "vitest";
import {
  isNativeSwapAddress,
  isNativeToStableSwap,
  isStableSwapToken,
} from "./swap-policy";

describe("swap policy", () => {
  it("recognizes LI.FI native token addresses", () => {
    expect(
      isNativeSwapAddress("0x0000000000000000000000000000000000000000"),
    ).toBe(true);
    expect(
      isNativeSwapAddress("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"),
    ).toBe(true);
  });

  it("allows only configured USDC and USDT contracts", () => {
    expect(
      isStableSwapToken(
        8453,
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "USDC",
      ),
    ).toBe(true);
    expect(
      isStableSwapToken(
        8453,
        "0x2222222222222222222222222222222222222222",
        "USDC",
      ),
    ).toBe(false);
  });

  it("allows native-to-stable swaps only on the same network", () => {
    const baseSwap = {
      fromChainId: 8453,
      toChainId: 8453,
      fromTokenAddress: "0x0000000000000000000000000000000000000000",
      toTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };

    expect(isNativeToStableSwap(baseSwap)).toBe(true);
    expect(isNativeToStableSwap({ ...baseSwap, fromChainId: 56 })).toBe(false);
    expect(
      isNativeToStableSwap({
        ...baseSwap,
        fromTokenAddress: baseSwap.toTokenAddress,
      }),
    ).toBe(false);
  });
});
