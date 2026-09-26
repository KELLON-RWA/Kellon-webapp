import { describe, expect, it } from "vitest"
import { expectedSafeFor, resolveEvmSigner } from "./evm-signer.ts"
import type { ChainAccount } from "@/types/db"

const account = (chain: string, publicKey: string, smartAccountAddress?: string) =>
  ({ id: chain, userId: "u", chain, publicKey, smartAccountAddress }) as ChainAccount

const current = { address: "0xd8DD000000000000000000000000000000000001", walletClientType: "privy" }
const retired = { address: "0x22a1000000000000000000000000000000000002", walletClientType: "privy" }
const extension = { address: current.address, walletClientType: "metamask" }
const accounts = [
  account("stellar", "GABC"),
  account("base", current.address.toLowerCase(), "0xd116d4274183Bd5FcEECCe9F452Ff4FfE9054766"),
]

describe("EVM signer resolution", () => {
  it("picks the backend's signer whatever order Privy lists wallets in", () => {
    expect(resolveEvmSigner([retired, current], accounts)).toBe(current)
    expect(resolveEvmSigner([current, retired], accounts)).toBe(current)
  })

  it("never falls back to another wallet", () => {
    expect(resolveEvmSigner([retired], accounts)).toBeNull()
    expect(resolveEvmSigner([extension], accounts)).toBeNull()
    expect(resolveEvmSigner([current, retired], [])).toBeNull()
    expect(resolveEvmSigner([current], undefined)).toBeNull()
  })

  it("finds the expected Safe per chain and accepts the bsc alias", () => {
    expect(expectedSafeFor(accounts, "BASE")).toBe(
      "0xd116d4274183Bd5FcEECCe9F452Ff4FfE9054766",
    )
    expect(expectedSafeFor(accounts, "polygon")).toBeUndefined()
    expect(
      expectedSafeFor([account("bnb", current.address, "0xSafe")], "bsc"),
    ).toBe("0xSafe")
  })
})
