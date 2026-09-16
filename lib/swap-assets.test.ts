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

  it("uses funded native and stablecoin balances as swap sources", () => {
    const catalog = getSwapTokens(tokens);
    const sources = getSwapSources(
      [
        { symbol: "ETH", chain: "Base", amount: "0.1", metadata: null },
        { symbol: "USDC", chain: "Base", amount: 20, metadata: null },
        { symbol: "AERO", chain: "Base", amount: 3, metadata: null },
      ],
      catalog,
    );

    expect(sources.find((source) => source.chainKey === "base" && source.symbol === "ETH")).toMatchObject({
      symbol: "ETH",
      chainKey: "base",
      balance: 0.1,
    });
    expect(sources.find((source) => source.chainKey === "base" && source.symbol === "USDC")?.balance).toBe(20);
  });

  it("uses the live on-chain native balance without double counting profile data", () => {
    const catalog = getSwapTokens(tokens);
    const sources = getSwapSources(
      [{ symbol: "ETH", chain: "Base", amount: "0.1", metadata: null }],
      catalog,
      [{ chainKey: "base", amount: 0.4 }],
    );

    expect(sources.find((source) => source.chainKey === "base" && source.symbol === "ETH")?.balance).toBe(0.4);
  });

  it("offers only same-network USDC and USDT destinations", () => {
    const catalog = getSwapTokens(tokens);
    const source = getSwapSources([], catalog, [
      { chainKey: "base", amount: 0.25 },
    ]).find((token) => token.chainKey === "base" && isNativeSwapToken(token));
    const destinations = getSwapDestinations(source || null, catalog);

    expect(destinations.map((token) => token.symbol)).toEqual(["USDC", "USDT"]);
    expect(getDefaultSwapDestination(source || null, destinations)?.symbol).toBe(
      "USDC",
    );
  });

  it("allows a stablecoin source to select only the other stablecoin", () => {
    const catalog = getSwapTokens(tokens);
    const source = catalog.find(
      (token) => token.chainKey === "base" && token.symbol === "USDC",
    );
    expect(getSwapDestinations(source || null, catalog).map((token) => token.symbol)).toEqual(["USDT"]);
  });
});
