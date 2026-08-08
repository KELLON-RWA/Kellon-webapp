"use client"

import { useCallback } from "react"
import { useWallets } from "@privy-io/react-auth"
import { encodeFunctionData, erc20Abi, parseUnits } from "viem"
import { useSmartAccount, setStickyTransferMeta } from "@/hooks/useSmartAccount"
import { getActiveChains } from "@/lib/chains"

/**
 * The subset of an offramp order that determines how it settles.
 *
 * Providers split into two settlement models: redirect (the user finishes on the
 * provider's own page — Transak, MoonPay, Ramp, Quidax, Paychant) and deposit-address
 * (the order is only live once tokens reach an address the provider names — Paycrest,
 * Centiiv). This describes the second kind. Which provider produced it doesn't matter;
 * whether the tokens have moved does.
 */
export interface FundableOrder {
  depositAddress?: string
  depositInstructions?: {
    address?: string
    memo?: string
    expiresAt?: string
  } | null
  requiredTokenAmount?: number | string
  tokenAddress?: string
  /** Set when the backend already funded the order (Centiiv's auto-transfer). */
  fundingTxHash?: string
}

export interface PendingDeposit {
  address: string
  memo?: string
}

/** The deposit this order still needs, or null if it redirects or is already funded. */
export function getPendingDeposit(
  order: FundableOrder | null | undefined,
): PendingDeposit | null {
  if (!order || order.fundingTxHash) return null

  const address = order.depositAddress || order.depositInstructions?.address
  if (!address) return null

  return { address, memo: order.depositInstructions?.memo }
}

const EVM_DECIMALS_BY_CHAIN_ID: Record<number, number> = {
  // BSC issues USDC/USDT at 18 decimals; every other supported EVM chain uses 6.
  56: 18,
  97: 18,
}

export function useOfframpFunding() {
  const { wallets, ready: walletsReady } = useWallets()
  const { getSmartAccountClient } = useSmartAccount()

  /** Sends the tokens gaslessly via the smart account; null when nothing is owed. */
  const fundOfframpOrder = useCallback(
    async (params: {
      order: FundableOrder
      chainKey: string
      symbol: string
      /** Used when the provider didn't state an exact token amount. */
      fallbackAmount: number
    }): Promise<string | null> => {
      const { order, symbol, fallbackAmount } = params
      const chainKey = params.chainKey.toLowerCase()

      const deposit = getPendingDeposit(order)
      if (!deposit) return null

      const activeChains = getActiveChains()
      const chainConfig = activeChains[chainKey as keyof typeof activeChains]

      // Stellar/Solana signing isn't implemented here; fail loudly rather than silently.
      if (!chainConfig || !/^0x/.test(deposit.address)) {
        throw new Error(
          `Automatic funding isn't available for ${params.chainKey} withdrawals yet. ` +
            `Send ${fallbackAmount} ${symbol} to ${deposit.address}` +
            (deposit.memo ? ` (memo: ${deposit.memo})` : "") +
            ` to complete this order.`,
        )
      }

      if (!walletsReady) {
        throw new Error("Wallet is still loading. Please try again in a moment.")
      }

      const evmWallet = wallets.find(
        (w) => w.walletClientType === "privy" && w.address.startsWith("0x"),
      )
      if (!evmWallet) {
        throw new Error(
          "Embedded wallet not found. Please log out and log in again.",
        )
      }

      const smartAccountClient = await getSmartAccountClient(
        evmWallet,
        chainKey,
      )
      if (!smartAccountClient?.account) {
        throw new Error("Failed to initialize smart account for the transfer.")
      }

      const tokenSymbol = symbol.toUpperCase()
      const tokenAddress =
        order.tokenAddress ||
        (tokenSymbol === "USDC"
          ? chainConfig.usdcAddress
          : chainConfig.usdtAddress)

      if (!tokenAddress) {
        throw new Error(`Token ${tokenSymbol} is not supported on ${chainKey}.`)
      }

      const decimals = EVM_DECIMALS_BY_CHAIN_ID[chainConfig.id as number] ?? 6
      const transferAmount = Number(order.requiredTokenAmount ?? fallbackAmount)
      if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        throw new Error("Could not determine the amount to transfer.")
      }

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [deposit.address as `0x${string}`, parseUnits(String(transferAmount), decimals)],
      })

      setStickyTransferMeta({
        amount: transferAmount,
        symbol: tokenSymbol,
        toAddress: deposit.address,
      })

      try {
        return (await (
          smartAccountClient as unknown as {
            sendTransaction(args: Record<string, unknown>): Promise<string>
          }
        ).sendTransaction({
          account: smartAccountClient.account,
          chain: smartAccountClient.chain,
          to: tokenAddress as `0x${string}`,
          data,
          value: 0n,
        })) as string
      } finally {
        setStickyTransferMeta(null)
      }
    },
    [wallets, walletsReady, getSmartAccountClient],
  )

  return { fundOfframpOrder }
}
