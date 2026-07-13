"use client"

import { useState, useCallback, useRef } from "react"
import {
  createPublicClient,
  http,
  custom,
  createWalletClient,
  type Address,
  type Chain,
  fallback,
} from "viem"
import { base, celo, polygon, bsc, baseSepolia, celoAlfajores, polygonAmoy, bscTestnet } from "viem/chains"
import { createSmartAccountClient, type SmartAccountClient } from "permissionless"
import { toSafeSmartAccount } from "permissionless/accounts"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { TransferVerificationRequiredError } from "@/services/api/transfers"
import type { ConnectedWallet } from "@privy-io/react-auth"

interface BundlerErrorResponse {
  message?: string
  error?: {
    message?: string
    code?: number
    data?: unknown
    availableMethods?: string[]
  }
}

interface JsonRpcResponse {
  error?: {
    code?: number
    message?: string
    data?: unknown
  }
  result?: unknown
}

const entryPoint07Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const

const IS_TESTNET = process.env.NEXT_PUBLIC_NETWORK_MODE === "testnet"

const CHAIN_MAP: Record<string, { chain: Chain; slug: string }> = IS_TESTNET
  ? {
      base: { chain: baseSepolia, slug: "base" },
      celo: { chain: celoAlfajores, slug: "celo" },
      polygon: { chain: polygonAmoy, slug: "polygon" },
      bnb: { chain: bscTestnet, slug: "binance" },
      bsc: { chain: bscTestnet, slug: "binance" },
    }
  : {
      base: { chain: base, slug: "base" },
      celo: { chain: celo, slug: "celo" },
      polygon: { chain: polygon, slug: "polygon" },
      bnb: { chain: bsc, slug: "binance" },
      bsc: { chain: bsc, slug: "binance" },
    }

const PUBLIC_RPC_URLS: Record<string, string[]> = {
  base: [
    "https://mainnet.base.org",
    "https://base.publicnode.com",
    "https://rpc.ankr.com/base",
  ],
  celo: ["https://forno.celo.org", "https://rpc.ankr.com/celo"],
  polygon: [
    "https://polygon.drpc.org",
    "https://rpc.ankr.com/polygon",
    "https://polygon-rpc.com",
  ],
  bnb: [
    "https://bsc-dataseed.binance.org",
    "https://bsc-dataseed1.defibit.io",
    "https://rpc.ankr.com/bsc",
  ],
  bsc: [
    "https://bsc-dataseed.binance.org",
    "https://bsc-dataseed1.defibit.io",
    "https://rpc.ankr.com/bsc",
  ],
}

const clientCache = new Map<string, SmartAccountClient>()
const cachedAddresses = new Map<string, string>()

let stickyVerificationCode: string | null = null

export function setStickyVerificationCode(code: string | null) {
  stickyVerificationCode = code
}

export function useSmartAccount() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cachedAddressRef = useRef<string | null>(null)

  const getSmartAccountClient = useCallback(
    async (
      privyWallet: ConnectedWallet,
      chainKey: string,
    ): Promise<SmartAccountClient | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const targetChainKey = chainKey.toLowerCase()
        const config = CHAIN_MAP[targetChainKey]
        if (!config) throw new Error(`Unsupported chain: ${targetChainKey}`)

        const { chain, slug } = config

        const cacheKey = `${privyWallet.address}_${targetChainKey}`
        const existing = clientCache.get(cacheKey)
        if (existing) {
          return existing
        }

        const provider = await privyWallet.getEthereumProvider()

        const transport = custom({
          async request({ method, params, id }: { method: string; params?: unknown[]; id?: number | string }) {
            const body: Record<string, unknown> = {
              jsonrpc: "2.0",
              method,
              params,
              id: id || Math.floor(Math.random() * 1000000),
            }

            if (method === "eth_sendUserOperation" && stickyVerificationCode) {
              body.verificationCodes = [stickyVerificationCode]
            }

            try {
              const token =
                sessionStorage.getItem("kellon_auth_token") ||
                localStorage.getItem("kellon_auth_token")

              const headers: Record<string, string> = {
                "Content-Type": "application/json",
              }
              if (token) {
                headers["Authorization"] = `Bearer ${token}`
              }

              const backendBaseUrl =
                process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:3000"
              const url = `${backendBaseUrl}/bundler/${slug}/rpc`

              const res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
              })

              if (!res.ok) {
                let errorData: BundlerErrorResponse | null = null
                try {
                  errorData = await res.json()
                } catch {}

                const isJsonRpcMfa =
                  res.status === 403 &&
                  (errorData?.error?.message === "VERIFICATION_REQUIRED" ||
                    errorData?.error?.code === -32000)

                if (isJsonRpcMfa) {
                  const mfaType = errorData?.error?.availableMethods?.includes("totp")
                    ? "totp"
                    : "otp"
                  throw new TransferVerificationRequiredError("Verification required", mfaType)
                }

                const msg =
                  errorData?.message ||
                  errorData?.error?.message ||
                  `HTTP error ${res.status}`
                const err = new Error(msg)
                if (errorData) {
                  ;(err as Error & { response?: { data: BundlerErrorResponse | null } }).response = { data: errorData }
                }
                ;(err as Error & { status?: number }).status = res.status
                throw err
              }

              const responseData = (await res.json()) as JsonRpcResponse

              if (responseData.error) {
                const err = new Error(responseData.error.message || "Bundler Error")
                ;(err as Error & { code?: number }).code = responseData.error.code
                ;(err as Error & { data?: unknown }).data = responseData.error.data
                throw err
              }

              return responseData.result
            } catch (e) {
              const err = e as Error & { response?: unknown; status?: number }
              console.error("[useSmartAccount] Bundler proxy error:", err)
              const rpcError = new Error(err.message || "Unknown RPC Error") as Error & { response?: unknown; status?: number }
              rpcError.response = err.response
              rpcError.status = err.status
              throw rpcError
            }
          },
        })

        const rpcUrls = PUBLIC_RPC_URLS[targetChainKey] || []
        const publicClient = createPublicClient({
          transport: fallback(
            rpcUrls.map((url) =>
              http(url, {
                timeout: 10000,
                retryCount: 2,
              }),
            ),
          ),
          chain,
        })

        const pimlicoClient = createPimlicoClient({
          transport,
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        })

        const ownerClient = createWalletClient({
          account: privyWallet.address as Address,
          chain,
          transport: custom(provider),
        })

        const safeAccount = await toSafeSmartAccount({
          client: publicClient,
          owners: [ownerClient],
          version: "1.4.1",
          entryPoint: {
            address: entryPoint07Address,
            version: "0.7",
          },
        })

        console.log(
          `[useSmartAccount] Initialized Safe Account: ${safeAccount.address} (Owner: ${privyWallet.address})`,
        )

        cachedAddresses.set(cacheKey, safeAccount.address)
        cachedAddressRef.current = safeAccount.address

        const smartAccountClient = createSmartAccountClient({
          account: safeAccount,
          chain,
          bundlerTransport: transport,
          paymaster: pimlicoClient,
          userOperation: {
            estimateFeesPerGas: async () => {
              const prices = await pimlicoClient.getUserOperationGasPrice()
              const maxFee = BigInt(prices.fast.maxFeePerGas)
              const maxPriority = BigInt(prices.fast.maxPriorityFeePerGas)
              return {
                maxFeePerGas: (maxFee * 115n) / 100n,
                maxPriorityFeePerGas: (maxPriority * 115n) / 100n,
              }
            },
          },
        })

        clientCache.set(cacheKey, smartAccountClient)
        return smartAccountClient
      } catch (err) {
        const errorObject = err as Error
        console.error("[useSmartAccount] Error creating client:", errorObject)
        setError(errorObject.message || "Failed to initialize Smart Account")
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const getCachedAddress = useCallback(
    (ownerAddress: string, chainKey: string): string | null => {
      const targetChainKey = chainKey.toLowerCase()
      const cacheKey = `${ownerAddress}_${targetChainKey}`
      return cachedAddresses.get(cacheKey) || null
    },
    [],
  )

  return {
    getSmartAccountClient,
    getCachedAddress,
    cachedAddress: cachedAddressRef.current,
    isLoading,
    error,
  }
}
