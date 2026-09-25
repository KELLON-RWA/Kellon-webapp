"use client"

import { PrivyProvider } from "@privy-io/react-auth"

export default function MyPrivyProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const getPrivyClientId = () => {
    const privyClientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID

    if (!privyClientId || privyClientId.length === 0)
      throw new Error("Missing NEXT_PUBLIC_PRIVY_CLIENT_ID")

    return privyClientId
  }

  const getPrivyAppId = () => {
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
    if (!privyAppId || privyAppId.length === 0)
      throw new Error("Missing NEXT_PUBLIC_PRIVY_APP_ID")

    return privyAppId
  }

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
      }}
    >
      {children}
    </PrivyProvider>
  )
}
