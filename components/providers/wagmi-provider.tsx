"use client"

import { type FC, type PropsWithChildren } from "react"
import { createClient, http } from "viem"
import { mainnet } from "viem/chains"
import type { Config, CreateConnectorFn } from "wagmi"
import { WagmiProvider, createConfig as createWagmiConfig } from "wagmi"
import { injected } from "wagmi/connectors"

const connectors: CreateConnectorFn[] = [injected()]

export const wagmiConfig: Config = createWagmiConfig({
  chains: [mainnet],
  connectors,
  client({ chain }) {
    return createClient({
      chain,
      transport: http(),
    })
  },
})

export const CustomWagmiProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      {children}
    </WagmiProvider>
  )
}
