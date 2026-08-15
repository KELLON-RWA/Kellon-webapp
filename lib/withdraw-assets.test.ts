import { describe, expect, it } from "vitest"
import {
  getWithdrawableAssets,
  groupWithdrawableAssets,
} from "./withdraw-assets"

describe("withdrawable assets", () => {
  it("keeps Base and BNB USDC balances separate", () => {
    const assets = getWithdrawableAssets([
      { symbol: "USDC", chain: "base", amount: "3.57" },
      { symbol: "USDC", chain: "bnb", amount: "0.97" },
    ])

    expect(assets).toHaveLength(2)
    expect(assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "USDC",
          balance: 3.57,
          usdValue: 3.57,
          network: expect.objectContaining({ name: "Base" }),
        }),
        expect.objectContaining({
          symbol: "USDC",
          balance: 0.97,
          usdValue: 0.97,
          network: expect.objectContaining({ name: "BNB" }),
        }),
      ]),
    )
  })

  it("combines duplicate records only within the same chain", () => {
    const assets = getWithdrawableAssets([
      { symbol: "USDC", chain: "base", amount: 1 },
      { symbol: "USDC", chain: "Base", amount: 2 },
    ])

    expect(assets).toHaveLength(1)
    expect(assets[0].balance).toBe(3)
  })

  it("groups only tokens held on multiple networks", () => {
    const assets = getWithdrawableAssets([
      { symbol: "USDC", chain: "base", amount: 2 },
      { symbol: "USDC", chain: "polygon", amount: 3 },
      { symbol: "USDT", chain: "bnb", amount: 4 },
    ])

    const groups = groupWithdrawableAssets(assets)
    const usdc = groups.find((group) => group.symbol === "USDC")
    const usdt = groups.find((group) => group.symbol === "USDT")

    expect(usdc).toMatchObject({
      balance: 5,
      usdValue: 5,
      isMultiChain: true,
    })
    expect(usdc?.assets).toHaveLength(2)
    expect(usdt).toMatchObject({
      balance: 4,
      usdValue: 4,
      isMultiChain: false,
    })
    expect(usdt?.assets).toHaveLength(1)
  })
})
