import { describe, expect, it } from "vitest";
import type { Token } from "@/services/api/swap";
import {
  getDefaultSwapDestination,
  getSwapDestinations,
  getSwapSources,
  getSwapTokens,
  isNativeSwapToken,
} from "./swap-assets";

const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";

const tokens: Token[] = [
  {
    chainId: 8453,
    address: NATIVE_ADDRESS,
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    priceUSD: "3000",
  },
  {
    chainId: 8453,
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    priceUSD: "1",
  },
  {
    chainId: 8453,
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    symbol: "USDT",
    name: "Tether USD",
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
    address: NATIVE_ADDRESS,
    symbol: "POL",
    name: "Polygon Ecosystem Token",
    decimals: 18,
    priceUSD: "0.4",
  },
  {
    chainId: 1,
    address: NATIVE_ADDRESS,
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    priceUSD: "3000",
  },
];

describe("swap assets", () => {
  it("keeps only native tokens and configured stablecoins on Kellon chains", () => {
    const catalog = getSwapTokens(tokens);

    const nativeTokens = catalog
      .filter(isNativeSwapToken)
      .map((token) => `${token.chainKey}:${token.symbol}`);
    expect(nativeTokens).toHaveLength(6);
    expect(nativeTokens).toEqual(
      expect.arrayContaining([
        "base:ETH",
        "bnb:BNB",
        "celo:CELO",
        "polygon:POL",
        "solana:SOL",
        "stellar:XLM",
      ]),
    );
    expect(catalog.some((token) => token.symbol === "AERO")).toBe(false);
    expect(
      new Set(catalog.map((token) => token.chainType)),
    ).toEqual(new Set(["evm", "solana", "stellar"]));
  });

  it("uses only funded native balances as swap sources", () => {
    const catalog = getSwapTokens(tokens);
    const sources = getSwapSources(
      [
        { symbol: "ETH", chain: "Base", amount: "0.1", metadata: null },
        { symbol: "USDC", chain: "Base", amount: 20, metadata: null },
        { symbol: "AERO", chain: "Base", amount: 3, metadata: null },
      ],
      catalog,
    );

    expect(sources).toHaveLength(6);
    expect(sources[0]).toMatchObject({
      symbol: "ETH",
      chainKey: "base",
      balance: 0.1,
    });
    expect(isNativeSwapToken(sources[0])).toBe(true);
    expect(sources.slice(1).every((source) => source.balance === 0)).toBe(true);
  });

  it("uses the live on-chain native balance without double counting profile data", () => {
    const catalog = getSwapTokens(tokens);
    const sources = getSwapSources(
      [{ symbol: "ETH", chain: "Base", amount: "0.1", metadata: null }],
      catalog,
      [{ chainKey: "base", amount: 0.4 }],
    );

    expect(sources[0].balance).toBe(0.4);
  });

  it("offers only same-network USDC and USDT destinations", () => {
    const catalog = getSwapTokens(tokens);
    const source = getSwapSources([], catalog, [
      { chainKey: "base", amount: 0.25 },
    ])[0];
    const destinations = getSwapDestinations(source, catalog);

    expect(destinations.map((token) => token.symbol)).toEqual(["USDC", "USDT"]);
    expect(getDefaultSwapDestination(source, destinations)?.symbol).toBe(
      "USDC",
    );
  });
});
