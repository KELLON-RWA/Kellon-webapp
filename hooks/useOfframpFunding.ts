"use client"

import { useCallback } from "react"
import { useWallets } from "@privy-io/react-auth"
import { useUser } from "@/hooks/use-user"
import { expectedSafeFor, resolveEvmSigner } from "@/lib/evm-signer"
import { encodeFunctionData, erc20Abi, formatUnits } from "viem"
import { toBaseUnits } from "@/lib/token-amount"
import {
  useSmartAccount,
  setStickyTransferMeta,
  setStickyVerificationCode,
  type StickyVerification,
} from "@/hooks/useSmartAccount"
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
  fundingStatus?: string
}

export interface PendingDeposit {
  address: string
  memo?: string
  expiresAt?: string
}

/** The deposit this order still needs, or null if it redirects or is already funded. */
export function getPendingDeposit(
  order: FundableOrder | null | undefined,
): PendingDeposit | null {
  if (!order || order.fundingTxHash || ["QUEUED", "RETRY_REQUIRED", "SUBMITTED", "SETTLED"].includes(order.fundingStatus ?? "")) return null

  const address = order.depositAddress || order.depositInstructions?.address
  if (!address) return null

  return { address, memo: order.depositInstructions?.memo, expiresAt: order.depositInstructions?.expiresAt }
}

const EVM_DECIMALS_BY_CHAIN_ID: Record<number, number> = {
  // BSC issues USDC/USDT at 18 decimals; every other supported EVM chain uses 6.
  56: 18,
  97: 18,
}

export function useOfframpFunding() {
  const { wallets, ready: walletsReady } = useWallets()
  const { getSmartAccountClient } = useSmartAccount()
  const { data: profile } = useUser()

  /** Sends the tokens gaslessly via the smart account; null when nothing is owed. */
  const fundOfframpOrder = useCallback(
    async (params: {
      order: FundableOrder
      chainKey: string
      symbol: string
      verification?: StickyVerification
    }): Promise<string | null> => {
      const { order, symbol, verification } = params
      const chainKey = params.chainKey.toLowerCase()

      const deposit = getPendingDeposit(order)
      if (!deposit) return null

      if (deposit.expiresAt && (!Number.isFinite(Date.parse(deposit.expiresAt)) || Date.parse(deposit.expiresAt) <= Date.now())) {
        throw new Error("This withdrawal deposit has expired. Request a new quote.")
      }
      const transferAmount = Number(order.requiredTokenAmount)
      if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        throw new Error("Provider did not supply an exact deposit amount. Request a new quote.")
      }
      const activeChains = getActiveChains()
      const chainConfig = activeChains[chainKey as keyof typeof activeChains]

      // Stellar/Solana signing isn't implemented here; fail loudly rather than silently.
      if (!chainConfig || !/^0x/.test(deposit.address)) {
        throw new Error(
          `Automatic funding isn't available for ${params.chainKey} withdrawals yet. ` +
            `Send ${transferAmount} ${symbol} to ${deposit.address}` +
            (deposit.memo ? ` (memo: ${deposit.memo})` : "") +
            ` to complete this order.`,
        )
      }

      if (deposit.memo) throw new Error("This deposit requires a memo and cannot be funded with an EVM token transfer.")

      if (!walletsReady) {
        throw new Error(
          "Wallet is still loading. Please try again in a moment.",
        )
      }

      const evmWallet = resolveEvmSigner(wallets, profile?.chainAccounts)
      if (!evmWallet) {
        throw new Error(
          "Your wallet is not available on this device. Please log out and log in again.",
        )
      }

      const smartAccountClient = await getSmartAccountClient(
        evmWallet,
        chainKey,
        expectedSafeFor(profile?.chainAccounts, chainKey),
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

      const requiredUnits = toBaseUnits(transferAmount, decimals)
      // The provider needs this exact amount; a shortfall must read as a balance problem,
      // not a bundler simulation revert.
      const reader = smartAccountClient.account as unknown as {
        client?: { readContract(args: Record<string, unknown>): Promise<unknown> }
        address: `0x${string}`
      }
      const balance = await reader.client
        ?.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [reader.address],
        })
        .catch(() => null)
      if (typeof balance === "bigint" && balance < requiredUnits) {
        throw new Error(
          `Insufficient ${tokenSymbol} in your wallet: ${formatUnits(balance, decimals)} available, ${formatUnits(requiredUnits, decimals)} needed.`,
        )
      }

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [deposit.address as `0x${string}`, requiredUnits],
      })

      setStickyTransferMeta({
        amount: transferAmount,
        symbol: tokenSymbol,
        toAddress: deposit.address,
      })
      setStickyVerificationCode(verification ?? null)
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
        setStickyVerificationCode(null)
        setStickyTransferMeta(null)
      }
    },
    [wallets, walletsReady, getSmartAccountClient, profile?.chainAccounts],
  )

  return { fundOfframpOrder }
}
