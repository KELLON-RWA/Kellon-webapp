import { describe, expect, it } from "vitest";
import type { Token } from "@/services/api/swap";
import {
  getDefaultSwapDestination,
  getSwapDestinations,
  getSwapSources,
  getSwapTokens,
} from "./swap-assets";

const tokens: Token[] = [
  {
    chainId: 8453,
    address: "0x1111111111111111111111111111111111111111",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    priceUSD: "1",
  },
  {
    chainId: 8453,
    address: "0x2222222222222222222222222222222222222222",
    symbol: "AERO",
    name: "Aerodrome",
    decimals: 18,
    priceUSD: "0.8",
  },
  {
    chainId: 137,
    address: "0x3333333333333333333333333333333333333333",
    symbol: "LINK",
    name: "Chainlink",
    decimals: 18,
    priceUSD: "12",
  },
  {
    chainId: 1,
    address: "0x4444444444444444444444444444444444444444",
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
    priceUSD: "9",
  },
];

describe("swap assets", () => {
  it("keeps arbitrary LI.FI tokens only on Kellon EVM chains", () => {
    const catalog = getSwapTokens(tokens);
    expect(catalog.map((token) => token.symbol)).toEqual([
      "USDC",
      "AERO",
      "LINK",
    ]);
    expect(catalog.every((token) => token.chainType === "evm")).toBe(true);
  });

  it("maps and merges funded profile assets against the LI.FI catalog", () => {
    const catalog = getSwapTokens(tokens);
    const sources = getSwapSources(
      [
        { symbol: "AERO", chain: "Base", amount: "1.25", metadata: null },
        { symbol: "aero", chain: "base-network", amount: 2, metadata: null },
        { symbol: "LINK", chain: "Polygon", amount: 0, metadata: null },
      ],
      catalog,
    );

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      symbol: "AERO",
      chainKey: "base",
      balance: 3.25,
    });
    const destinations = getSwapDestinations(sources[0], catalog);
    expect(destinations.map((token) => token.symbol)).toEqual(["USDC"]);
    expect(getDefaultSwapDestination(sources[0], destinations)?.symbol).toBe(
      "USDC",
    );
  });
});
