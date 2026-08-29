import { createPublicClient, formatUnits, http, isAddress } from "viem";
import type { ChainAccount } from "@/types/db";
import { normalizeBridgeChain } from "./bridge-assets";
import { getActiveChains } from "./chains";
import {
  isNativeSwapToken,
  type NativeSwapBalance,
  type SwapAssetOption,
} from "./swap-assets";

export async function getNativeSwapBalances(
  accounts: ChainAccount[],
  tokens: SwapAssetOption[],
): Promise<NativeSwapBalance[]> {
  const chains = getActiveChains();
  const nativeTokens = tokens.filter(isNativeSwapToken);

  return (
    await Promise.all(
      nativeTokens.map(async (token) => {
        const account = accounts.find(
          (candidate) =>
            normalizeBridgeChain(candidate.chain) === token.chainKey,
        );
        const address =
          token.chainType === "evm"
            ? account?.smartAccountAddress || account?.publicKey
            : account?.publicKey;
        const chain = chains[token.chainKey];
        const rpcUrl = chain?.rpcUrls.default.http[0];
        if (!address || !rpcUrl) {
          return { chainKey: token.chainKey, amount: 0 };
        }

        try {
          if (token.chainType === "solana") {
            const response = await fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getBalance",
                params: [address, { commitment: "confirmed" }],
              }),
            });
            if (!response.ok) throw new Error("Solana balance request failed");
            const payload = (await response.json()) as {
              result?: { value?: number };
            };
            return {
              chainKey: token.chainKey,
              amount: Number(payload.result?.value || 0) / 10 ** token.decimals,
            } satisfies NativeSwapBalance;
          }

          if (token.chainType === "stellar") {
            const response = await fetch(
              `${rpcUrl.replace(/\/$/, "")}/accounts/${encodeURIComponent(address)}`,
            );
            if (response.status === 404) {
              return { chainKey: token.chainKey, amount: 0 };
            }
            if (!response.ok) throw new Error("Stellar balance request failed");
            const payload = (await response.json()) as {
              balances?: Array<{ asset_type?: string; balance?: string }>;
            };
            const native = payload.balances?.find(
              (balance) => balance.asset_type === "native",
            );
            return {
              chainKey: token.chainKey,
              amount: Number(native?.balance || 0),
            } satisfies NativeSwapBalance;
          }

          if (!isAddress(address)) {
            return { chainKey: token.chainKey, amount: 0 };
          }
          const client = createPublicClient({ transport: http(rpcUrl) });
          const balance = await client.getBalance({ address });
          return {
            chainKey: token.chainKey,
            amount: Number(formatUnits(balance, token.decimals)),
          } satisfies NativeSwapBalance;
        } catch {
          return { chainKey: token.chainKey, amount: 0 };
        }
      }),
    )
  ).filter((balance): balance is NativeSwapBalance => Boolean(balance));
}
