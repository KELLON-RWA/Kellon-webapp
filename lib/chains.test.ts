import { describe, expect, it } from "vitest";
import {
  getChainById,
  getEVMChains,
  getExplorerAddressUrl,
  getExplorerTransactionUrl,
  getSupportedChainsForToken,
  MAINNET_CHAINS,
} from "./chains";

describe("chain configuration", () => {
  it("offers configured Solana mainnet USDC and USDT", () => {
    const usdcChains = getSupportedChainsForToken("USDC");
    const usdtChains = getSupportedChainsForToken("USDT");

    expect(usdcChains).toContainEqual(MAINNET_CHAINS.solana);
    expect(usdtChains).toContainEqual(MAINNET_CHAINS.solana);
    expect(MAINNET_CHAINS.solana.usdcAddress).toBe(
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    );
  });

  it("resolves Solana by its non-EVM chain id", () => {
    expect(getChainById("mainnet-beta")).toEqual(MAINNET_CHAINS.solana);
  });

  it("keeps non-EVM chains out of EVM-only consumers", () => {
    expect(getEVMChains().every((chain) => chain.type === "evm")).toBe(true);
    expect(getEVMChains()).not.toContainEqual(MAINNET_CHAINS.solana);
  });

  it("defines a stable display position for Solana", () => {
    expect(Object.keys(MAINNET_CHAINS)).toContain("solana");
  });

  it("builds an explorer account link for each chain type", () => {
    expect(getExplorerAddressUrl("Base", "0xabc")).toBe(
      "https://basescan.org/address/0xabc",
    );
    expect(getExplorerAddressUrl("Solana", "wallet-key")).toBe(
      "https://solscan.io/account/wallet-key",
    );
  });

  it("builds an explorer transaction link for each chain type", () => {
    expect(getExplorerTransactionUrl("Base", "0xabc")).toBe(
      "https://basescan.org/tx/0xabc",
    );
    expect(getExplorerTransactionUrl("Stellar Network", "stellar-hash")).toBe(
      "https://stellar.expert/explorer/public/tx/stellar-hash",
    );
  });
});
