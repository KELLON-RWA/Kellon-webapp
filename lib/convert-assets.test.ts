import { describe, expect, it } from "vitest";
import {
  getAllConvertAssets,
  getConvertDestinations,
  getConvertMode,
  getConvertSources,
  getDefaultConvertDestination,
} from "./convert-assets";

describe("convert assets", () => {
  it("provides convert assets for all supported Kellon chains", () => {
    const assets = getAllConvertAssets();
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.some((a) => a.chainKey === "base" && a.symbol === "USDC")).toBe(true);
    expect(assets.some((a) => a.chainKey === "base" && a.symbol === "USDT")).toBe(true);
    expect(assets.some((a) => a.chainKey === "stellar" && a.symbol === "USDC")).toBe(true);
  });

  it("extracts funded stablecoin balances as convert sources", () => {
    const sources = getConvertSources([
      { symbol: "USDC", chain: "Base", amount: 150 },
      { symbol: "USDT", chain: "Polygon", amount: "75.5" },
      { symbol: "ETH", chain: "Base", amount: 2 }, // non-stablecoin ignored
    ]);

    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({
      symbol: "USDC",
      chainKey: "base",
      balance: 150,
    });
    expect(sources[1]).toMatchObject({
      symbol: "USDT",
      chainKey: "polygon",
      balance: 75.5,
    });
  });

  it("offers both same-network swap and cross-network bridge destinations for EVM stablecoins", () => {
    const assets = getAllConvertAssets();
    const baseUsdc = assets.find(
      (a) => a.chainKey === "base" && a.symbol === "USDC",
    );
    expect(baseUsdc).toBeDefined();

    const destinations = getConvertDestinations(baseUsdc || null, "all");

    // Must have same-network USDT swap option
    const swapDest = destinations.find(
      (d) => d.chainKey === "base" && d.symbol === "USDT",
    );
    expect(swapDest).toBeDefined();
    expect(swapDest?.mode).toBe("swap");

    // Must have cross-network USDC bridge options
    const bridgeDests = destinations.filter((d) => d.mode === "bridge");
    expect(bridgeDests.length).toBeGreaterThan(0);
    expect(bridgeDests.every((d) => d.symbol === "USDC" && d.chainKey !== "base")).toBe(true);
  });

  it("filters destinations by mode when requested", () => {
    const assets = getAllConvertAssets();
    const baseUsdc = assets.find(
      (a) => a.chainKey === "base" && a.symbol === "USDC",
    );

    const swapOnly = getConvertDestinations(baseUsdc || null, "swap");
    expect(swapOnly.every((d) => d.mode === "swap")).toBe(true);
    expect(swapOnly.some((d) => d.key === "USDT:base")).toBe(true);
    expect(swapOnly.some((d) => d.key === "USDT:bnb")).toBe(true);
    expect(swapOnly.some((d) => d.key === "USDT:polygon")).toBe(true);

    const bridgeOnly = getConvertDestinations(baseUsdc || null, "bridge");
    expect(bridgeOnly.every((d) => d.mode === "bridge")).toBe(true);
    expect(bridgeOnly.some((d) => d.key === "USDC:polygon")).toBe(true);
    expect(bridgeOnly.some((d) => d.key === "USDT:base")).toBe(false);
  });

  it("identifies convert mode dynamically from selected pair including cross-chain different-token swaps", () => {
    const assets = getAllConvertAssets();
    const baseUsdc = assets.find((a) => a.chainKey === "base" && a.symbol === "USDC")!;
    const baseUsdt = assets.find((a) => a.chainKey === "base" && a.symbol === "USDT")!;
    const polygonUsdc = assets.find((a) => a.chainKey === "polygon" && a.symbol === "USDC")!;
    const bnbUsdt = assets.find((a) => a.chainKey === "bnb" && a.symbol === "USDT")!;

    expect(getConvertMode(baseUsdc, baseUsdt)).toBe("swap");
    expect(getConvertMode(baseUsdc, polygonUsdc)).toBe("bridge");
    expect(getConvertMode(baseUsdc, bnbUsdt)).toBe("swap");

    const destinations = getConvertDestinations(baseUsdc);
    expect(destinations.some((d) => d.chainKey === "bnb" && d.symbol === "USDT")).toBe(true);
  });

  it("resolves default destination respecting preferred mode", () => {
    const assets = getAllConvertAssets();
    const baseUsdc = assets.find((a) => a.chainKey === "base" && a.symbol === "USDC")!;
    const destinations = getConvertDestinations(baseUsdc, "all");

    const defaultSwap = getDefaultConvertDestination(baseUsdc, destinations, "swap");
    expect(defaultSwap?.mode).toBe("swap");
    expect(defaultSwap?.key).toBe("USDT:base");

    const defaultBridge = getDefaultConvertDestination(baseUsdc, destinations, "bridge");
    expect(defaultBridge?.mode).toBe("bridge");
    expect(defaultBridge?.symbol).toBe("USDC");
    expect(defaultBridge?.chainKey).not.toBe("base");
  });

  it("ensures Base USDT is selectable and present in all destinations when sending Base USDC", () => {
    const assets = getAllConvertAssets();
    const baseUsdc = assets.find((a) => a.chainKey === "base" && a.symbol === "USDC")!;
    const destinations = getConvertDestinations(baseUsdc, "all");

    // Must include Base USDT for same-chain swap
    const baseUsdt = destinations.find((d) => d.chainKey === "base" && d.symbol === "USDT");
    expect(baseUsdt).toBeDefined();
    expect(baseUsdt?.mode).toBe("swap");

    // Must include other USDT destinations (e.g. BNB, Polygon)
    const usdtCandidates = destinations.filter((d) => d.symbol === "USDT");
    expect(usdtCandidates.length).toBeGreaterThanOrEqual(2);
  });
});
