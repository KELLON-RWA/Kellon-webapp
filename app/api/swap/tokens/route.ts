import { NextResponse } from "next/server";
import { getActiveChains } from "@/lib/chains";
import { lifiGet } from "@/lib/lifi-server";
import { isNativeSwapAddress, isStableSwapToken } from "@/lib/swap-policy";
import type { Token } from "@/services/api/swap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TokensResponse = { tokens: Record<string, Token[]> };

export async function GET() {
  try {
    const chainIds = Object.values(getActiveChains())
      .filter((chain) => chain.type === "evm" && typeof chain.id === "number")
      .map((chain) => Number(chain.id));
    const result = await lifiGet<TokensResponse>(
      `/tokens?chains=${chainIds.join(",")}`,
    );
    const tokens = chainIds.flatMap((chainId) =>
      (result.tokens[String(chainId)] || []).filter(
        (token) =>
          isNativeSwapAddress(token.address) ||
          isStableSwapToken(chainId, token.address, token.symbol),
      ),
    );
    return NextResponse.json({ tokens });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load swap tokens";
    return NextResponse.json({ message }, { status: 400 });
  }
}
