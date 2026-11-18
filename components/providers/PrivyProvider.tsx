"use client"

import { PrivyProvider } from "@privy-io/react-auth"
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit"

export default function MyPrivyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const getPrivyClientId = () => {
    return (
      process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ||
      "client-WY6VpEQUwtESj9Yhc6gmi1dKNfPFeJUbYSELrKmeb4CqM"
    )
  }

  const getPrivyAppId = () => {
    return (
      process.env.NEXT_PUBLIC_PRIVY_APP_ID ||
      "cml0yvf8n02sml10cnmrvjead"
    )
  }

  const solanaRpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    `https://solana-mainnet.rpc.privy.systems?privyAppId=${getPrivyAppId()}`
  const solanaWsUrl =
    process.env.NEXT_PUBLIC_SOLANA_WS_URL ||
    `wss://solana-mainnet.rpc.privy.systems?privyAppId=${getPrivyAppId()}`

  return (
    <PrivyProvider
      appId={getPrivyAppId()}
      clientId={getPrivyClientId()}
      config={{
        // The backend mints every wallet; a client-side mint races it and leaves a second signer.
        embeddedWallets: {
          ethereum: {
            createOnLogin: "off",
          },
        },
        solana: {
          rpcs: {
            "solana:mainnet": {
              rpc: createSolanaRpc(solanaRpcUrl),
              rpcSubscriptions: createSolanaRpcSubscriptions(solanaWsUrl),
              blockExplorerUrl: "https://solscan.io",
            },
          },
        },
        legal: {
          termsAndConditionsUrl: "https://kellon.xyz/terms-of-use",
          privacyPolicyUrl: "https://kellon.xyz/privacy-policy",
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
