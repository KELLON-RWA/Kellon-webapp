import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 30;

const DEXSCREENER_BASE_URL = "https://api.dexscreener.com/latest/dex";
const DEX_CHAIN_IDS: Record<string, string> = {
  bnb: "bsc",
  bsc: "bsc",
  base: "base",
  celo: "celo",
  polygon: "polygon",
  solana: "solana",
};

function isIdentifier(value: string) {
  return /^[A-Za-z0-9]{16,128}$/.test(value);
}

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  fdv?: number;
  marketCap?: number;
  baseToken?: { address?: string; symbol?: string };
  pairAddress?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chain = DEX_CHAIN_IDS[(searchParams.get("chain") || "").toLowerCase()];
  const tokenAddress = searchParams.get("token")?.trim() || "";
  const pairAddress = searchParams.get("pair")?.trim() || "";

  if (!chain || (!isIdentifier(tokenAddress) && !isIdentifier(pairAddress))) {
    return NextResponse.json(
      { message: "Valid DEX pool metadata is required" },
      { status: 400 },
    );
  }

  const endpoint = isIdentifier(pairAddress)
    ? `/pairs/${chain}/${encodeURIComponent(pairAddress)}`
    : `/tokens/${encodeURIComponent(tokenAddress)}`;

  try {
    const response = await fetch(`${DEXSCREENER_BASE_URL}${endpoint}`, {
      next: { revalidate: 30 },
    });
    if (!response.ok) throw new Error("DexScreener request failed");

    const payload = (await response.json()) as { pairs?: DexPair[] | null };
    const pair = (payload.pairs || [])
      .filter((candidate) => candidate.chainId === chain)
      .sort(
        (left, right) =>
          (right.liquidity?.usd || 0) - (left.liquidity?.usd || 0),
      )[0];

    return NextResponse.json({
      pair: pair
        ? {
            chain: pair.chainId,
            dex: pair.dexId,
            url: pair.url,
            priceUsd: pair.priceUsd,
            liquidityUsd: pair.liquidity?.usd,
            volume24hUsd: pair.volume?.h24,
            change24hPercentage: pair.priceChange?.h24,
            fdv: pair.fdv,
            marketCap: pair.marketCap,
            tokenAddress: pair.baseToken?.address,
            pairAddress: pair.pairAddress,
          }
        : null,
      source: "DexScreener",
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to load DexScreener pool data" },
      { status: 502 },
    );
  }
}
