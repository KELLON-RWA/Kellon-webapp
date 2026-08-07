import { describe, expect, it } from "vitest"
import {
  getChainById,
  getEVMChains,
  getSupportedChainsForToken,
  MAINNET_CHAINS,
} from "./chains"

describe("chain configuration", () => {
  it("offers configured Solana mainnet USDC and USDT", () => {
    const usdcChains = getSupportedChainsForToken("USDC")
    const usdtChains = getSupportedChainsForToken("USDT")

    expect(usdcChains).toContainEqual(MAINNET_CHAINS.solana)
    expect(usdtChains).toContainEqual(MAINNET_CHAINS.solana)
    expect(MAINNET_CHAINS.solana.usdcAddress).toBe(
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    )
  })

  it("resolves Solana by its non-EVM chain id", () => {
    expect(getChainById("mainnet-beta")).toEqual(MAINNET_CHAINS.solana)
  })

  it("keeps non-EVM chains out of EVM-only consumers", () => {
    expect(getEVMChains().every((chain) => chain.type === "evm")).toBe(true)
    expect(getEVMChains()).not.toContainEqual(MAINNET_CHAINS.solana)
  })

  it("defines a stable display position for Solana", () => {
    expect(Object.keys(MAINNET_CHAINS)).toContain("solana")
  })
})
