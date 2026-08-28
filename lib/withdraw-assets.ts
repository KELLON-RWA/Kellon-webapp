import { getSupportedChainsForToken } from "./chains"
import type { Asset } from "@/types/db"

export interface WithdrawableAsset {
  symbol: string
  name: string
  balance: number
  network: { id: string; name: string; key: string }
  usdValue: number
}

export interface WithdrawableAssetGroup {
  symbol: string
  name: string
  assets: WithdrawableAsset[]
  balance: number
  usdValue: number
  isMultiChain: boolean
}

type BalanceAsset = Pick<Asset, "symbol" | "chain" | "amount">

function normalizeChainName(value: string): string {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "")
  if (
    ["bsc", "bnbsmartchain", "binance", "binancesmartchain"].includes(
      normalized,
    )
  ) {
    return "bnb"
  }
  return normalized
}

function parseBalance(amount: Asset["amount"]): number {
  const parsed = typeof amount === "string" ? Number(amount) : amount
  return Number.isFinite(parsed) ? parsed : 0
}

/** Keeps balances isolated by token and chain instead of assigning a total to one network. */
export function getWithdrawableAssets(
  assets: Array<BalanceAsset | null | undefined>,
): WithdrawableAsset[] {
  const assetMap = new Map<string, WithdrawableAsset>()

  assets.forEach((item) => {
    if (!item?.symbol || !item.chain) return

    const amount = parseBalance(item.amount)
    if (amount <= 0) return

    const symbol = item.symbol.toUpperCase()
    if (symbol !== "USDC" && symbol !== "USDT") return

    const normalizedAssetChain = normalizeChainName(item.chain)
    const matchedChain = getSupportedChainsForToken(symbol).find(
      (chain) =>
        normalizeChainName(chain.name) === normalizedAssetChain ||
        String(chain.id).toLowerCase() === item.chain?.toLowerCase(),
    )

    const network = {
      id: String(matchedChain?.id ?? normalizedAssetChain),
      name: matchedChain?.name ?? item.chain,
      key: matchedChain
        ? normalizeChainName(matchedChain.name)
        : normalizedAssetChain,
    }
    const key = `${symbol}:${network.id}`
    const current = assetMap.get(key)

    if (current) {
      current.balance += amount
      current.usdValue += amount
      return
    }

    assetMap.set(key, {
      symbol,
      name: symbol === "USDC" ? "USD Coin" : "Tether USD",
      balance: amount,
      network,
      usdValue: amount,
    })
  })

  return Array.from(assetMap.values()).sort((left, right) => {
    if (left.symbol !== right.symbol)
      return left.symbol.localeCompare(right.symbol)
    return right.balance - left.balance
  })
}

/** Groups repeated token balances while preserving single-network selections. */
export function groupWithdrawableAssets(
  assets: WithdrawableAsset[],
): WithdrawableAssetGroup[] {
  const groups = new Map<string, WithdrawableAssetGroup>()

  assets.forEach((asset) => {
    const current = groups.get(asset.symbol)
    if (current) {
      current.assets.push(asset)
      current.balance += asset.balance
      current.usdValue += asset.usdValue
      current.isMultiChain = true
      return
    }

    groups.set(asset.symbol, {
      symbol: asset.symbol,
      name: asset.name,
      assets: [asset],
      balance: asset.balance,
      usdValue: asset.usdValue,
      isMultiChain: false,
    })
  })

  return Array.from(groups.values())
}
