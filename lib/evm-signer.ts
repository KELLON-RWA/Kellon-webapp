import type { ChainAccount } from "@/types/db"

export const SIGNER_MISMATCH_MESSAGE =
  "Wallet setup mismatch: this device is not a signer for your account. Please contact support."

export class SignerMismatchError extends Error {
  constructor() {
    super(SIGNER_MISMATCH_MESSAGE)
    this.name = "SignerMismatchError"
  }
}

type SignerCandidate = { address: string; walletClientType?: string }

const NON_EVM = new Set(["solana", "stellar"])
const ALIASES: Record<string, string> = { bsc: "bnb", matic: "polygon" }

const chainKey = (chain?: string | null) => {
  const key = String(chain || "").toLowerCase()
  return ALIASES[key] || key
}

const evmAccounts = (accounts?: ChainAccount[] | null) =>
  (accounts ?? []).filter((a) => a?.publicKey && !NON_EVM.has(chainKey(a.chain)))

/**
 * The embedded wallet the backend records as the EVM signer. A user can hold more than one
 * embedded wallet, and any other one derives a Safe that is not theirs, so there is no fallback.
 */
export function resolveEvmSigner<W extends SignerCandidate>(
  wallets: W[],
  accounts?: ChainAccount[] | null,
): W | null {
  const signer = evmAccounts(accounts)[0]?.publicKey.toLowerCase()
  if (!signer) return null
  return (
    wallets.find(
      (w) => w.walletClientType === "privy" && w.address.toLowerCase() === signer,
    ) ?? null
  )
}

/** The Safe the backend holds for this chain, when it has recorded one. */
export function expectedSafeFor(
  accounts: ChainAccount[] | null | undefined,
  chain: string,
): string | undefined {
  const key = chainKey(chain)
  return (
    evmAccounts(accounts).find((a) => chainKey(a.chain) === key)
      ?.smartAccountAddress || undefined
  )
}
