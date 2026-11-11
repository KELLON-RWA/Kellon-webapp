import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IS_TESTNET = process.env.NEXT_PUBLIC_NETWORK_MODE === "testnet";

const MAINNET_ALCHEMY_HOSTS: Record<string, string> = {
  base: "base-mainnet.g.alchemy.com/v2",
  polygon: "polygon-mainnet.g.alchemy.com/v2",
  bnb: "bnb-mainnet.g.alchemy.com/v2",
  bsc: "bnb-mainnet.g.alchemy.com/v2",
  celo: "celo-mainnet.g.alchemy.com/v2",
  arbitrum: "arb-mainnet.g.alchemy.com/v2",
  ethereum: "eth-mainnet.g.alchemy.com/v2",
  eth: "eth-mainnet.g.alchemy.com/v2",
  optimism: "opt-mainnet.g.alchemy.com/v2",
};

const TESTNET_ALCHEMY_HOSTS: Record<string, string> = {
  base: "base-sepolia.g.alchemy.com/v2",
  polygon: "polygon-amoy.g.alchemy.com/v2",
  bnb: "bnb-testnet.g.alchemy.com/v2",
  bsc: "bnb-testnet.g.alchemy.com/v2",
  celo: "celo-alfajores.g.alchemy.com/v2",
  arbitrum: "arb-sepolia.g.alchemy.com/v2",
  ethereum: "eth-sepolia.g.alchemy.com/v2",
  eth: "eth-sepolia.g.alchemy.com/v2",
  optimism: "opt-sepolia.g.alchemy.com/v2",
};

const ALLOWED_RPC_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "net_version",
  "web3_clientVersion",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ chain: string }> },
) {
  try {
    const { chain: rawChain } = await context.params;
    const chainKey = rawChain.toLowerCase();

    const hostMap = IS_TESTNET ? TESTNET_ALCHEMY_HOSTS : MAINNET_ALCHEMY_HOSTS;
    const host = hostMap[chainKey];

    const apiKey =
      process.env.ALCHEMY_RPC_KEY || process.env.ALCHEMY_API_KEY;

    if (!host || !apiKey) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: `RPC proxy not configured for chain: ${chainKey}`,
          },
          id: null,
        },
        { status: 503 },
      );
    }

    const body = await request.json();

    // Validate allowed methods to prevent abuse
    const requests = Array.isArray(body) ? body : [body];
    for (const req of requests) {
      if (
        req &&
        typeof req.method === "string" &&
        !ALLOWED_RPC_METHODS.has(req.method)
      ) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: `Method ${req.method} is not allowed on this proxy`,
            },
            id: req.id ?? null,
          },
          { status: 400 },
        );
      }
    }

    const alchemyUrl = `https://${host}/${apiKey}`;
    const response = await fetch(alchemyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RPC proxy error";
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id: null,
      },
      { status: 500 },
    );
  }
}
