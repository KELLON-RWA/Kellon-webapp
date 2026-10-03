import { describe, expect, it } from "vitest";
import {
  getBridgeSources,
  isExecutableBridgePair,
  normalizeBridgeChain,
} from "./bridge-assets";

describe("bridge assets", () => {
  it("normalizes BNB aliases", () => {
    expect(normalizeBridgeChain("BNB Smart Chain")).toBe("bnb");
    expect(normalizeBridgeChain("bsc")).toBe("bnb");
  });

  it("aggregates balances by token and chain", () => {
    const sources = getBridgeSources([
      { symbol: "USDC", chain: "Base", amount: "1" },
      { symbol: "usdc", chain: "base", amount: 2 },
    ]);

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      symbol: "USDC",
      chainKey: "base",
      balance: 3,
    });
  });

  it("allows EVM and Stellar sources to bridge between supported chains", () => {
    const sources = getBridgeSources([
      { symbol: "USDC", chain: "Base", amount: 1 },
    ]);
    const source = sources[0];
    expect(
      isExecutableBridgePair(source, {
        ...source,
        chainKey: "celo",
        chainName: "Celo",
        chainId: 42220,
      }),
    ).toBe(true);
    expect(
      isExecutableBridgePair(source, {
        ...source,
        symbol: "USDT",
        chainKey: "celo",
        chainName: "Celo",
        chainId: 42220,
      }),
    ).toBe(false);

    const stellarSource = {
      ...source,
      chainKey: "stellar" as const,
      chainName: "Stellar",
      chainId: 1,
      chainType: "stellar" as const,
    };
    expect(isExecutableBridgePair(stellarSource, source)).toBe(true);
    expect(isExecutableBridgePair(source, source)).toBe(false);
    expect(
      isExecutableBridgePair(source, {
        ...source,
        chainKey: "stellar",
        chainName: "Stellar",
        chainId: 1,
        chainType: "stellar",
      }),
    ).toBe(true);
  });
});
