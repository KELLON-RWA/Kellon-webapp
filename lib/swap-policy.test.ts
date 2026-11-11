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

  it("allows stablecoin swaps across different chains and rejects native tokens", () => {
    const nativeToStable = {
      fromChainId: 8453,
      toChainId: 8453,
      fromTokenAddress: "0x0000000000000000000000000000000000000000",
      toTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };

    expect(isNativeToStableSwap(nativeToStable)).toBe(false);

    // Stable to native on same network is also rejected
    expect(
      isNativeToStableSwap({
        fromChainId: 8453,
        toChainId: 8453,
        fromTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        toTokenAddress: "0x0000000000000000000000000000000000000000",
      }),
    ).toBe(false);

    // Cross-chain stablecoin swap (e.g. Base USDC -> Polygon USDT) is allowed
    const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const usdtPolygon = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
    expect(
      isNativeToStableSwap({
        fromChainId: 8453,
        toChainId: 137,
        fromTokenAddress: usdc,
        toTokenAddress: usdtPolygon,
      }),
    ).toBe(true);
  });

  it("allows only different stablecoin pairs on the same network", () => {
    const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const usdt = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";
    expect(
      isNativeToStableSwap({
        fromChainId: 8453,
        toChainId: 8453,
        fromTokenAddress: usdc,
        toTokenAddress: usdt,
      }),
    ).toBe(true);
    expect(
      isNativeToStableSwap({
        fromChainId: 8453,
        toChainId: 8453,
        fromTokenAddress: usdc,
        toTokenAddress: usdc,
      }),
    ).toBe(false);
  });
});
