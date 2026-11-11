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
  it("keeps only configured stablecoins (USDC and USDT) on supported EVM chains", () => {
    const catalog = getSwapTokens(tokens);

    // Native tokens must not be in swap catalog
    const nativeTokens = catalog.filter(isNativeSwapToken);
    expect(nativeTokens).toHaveLength(0);

    // Random non-stable tokens and native gas tokens are omitted
    expect(catalog.some((token) => token.symbol === "AERO")).toBe(false);
    expect(catalog.some((token) => token.symbol === "POL")).toBe(false);
    expect(catalog.some((token) => token.symbol === "ETH")).toBe(false);

    // Only USDC and USDT symbols exist in catalog
    expect(catalog.every((token) => ["USDC", "USDT"].includes(token.symbol))).toBe(true);
    expect(catalog.some((token) => token.chainKey === "base" && token.symbol === "USDC")).toBe(true);
    expect(catalog.some((token) => token.chainKey === "base" && token.symbol === "USDT")).toBe(true);
  });

  it("uses funded stablecoin balances as swap sources and ignores native/unsupported assets", () => {
    const catalog = getSwapTokens(tokens);
    const sources = getSwapSources(
      [
        { symbol: "ETH", chain: "Base", amount: "0.1", metadata: null },
        { symbol: "USDC", chain: "Base", amount: 20, metadata: null },
        { symbol: "AERO", chain: "Base", amount: 3, metadata: null },
      ],
      catalog,
    );

    // ETH and AERO are excluded
    expect(sources.find((source) => source.symbol === "ETH")).toBeUndefined();
    expect(sources.find((source) => source.symbol === "AERO")).toBeUndefined();

    // USDC is included with proper balance
    const usdcSource = sources.find((source) => source.chainKey === "base" && source.symbol === "USDC");
    expect(usdcSource).toBeDefined();
    expect(usdcSource?.balance).toBe(20);
  });

  it("offers only opposite same-network stablecoin destinations", () => {
    const catalog = getSwapTokens(tokens);
    const baseUsdc = catalog.find(
      (token) => token.chainKey === "base" && token.symbol === "USDC",
    );
    expect(baseUsdc).toBeDefined();

    const destinations = getSwapDestinations(baseUsdc || null, catalog);

    // Destination should only be USDT on Base
    expect(destinations.map((token) => `${token.chainKey}:${token.symbol}`)).toEqual([
      "base:USDT",
    ]);
    expect(getDefaultSwapDestination(baseUsdc || null, destinations)?.symbol).toBe(
      "USDT",
    );
  });

  it("offers USDC when source is USDT on the same network", () => {
    const catalog = getSwapTokens(tokens);
    const baseUsdt = catalog.find(
      (token) => token.chainKey === "base" && token.symbol === "USDT",
    );
    expect(baseUsdt).toBeDefined();

    const destinations = getSwapDestinations(baseUsdt || null, catalog);
    expect(destinations.map((token) => `${token.chainKey}:${token.symbol}`)).toEqual([
      "base:USDC",
    ]);
    expect(
      getDefaultSwapDestination(baseUsdt || null, destinations)?.symbol,
    ).toBe("USDC");
  });
});
