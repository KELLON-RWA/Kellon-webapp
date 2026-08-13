import "server-only";

import { getActiveChains } from "@/lib/chains";

const LIFI_API_URL = "https://li.quest/v1";
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

type BridgeAction = {
  fromChainId?: unknown;
  toChainId?: unknown;
  fromAmount?: unknown;
  fromToken?: { address?: unknown };
  toToken?: { address?: unknown };
  fromAddress?: unknown;
  toAddress?: unknown;
};

function getAllowedTokens(chainId: number): Map<string, string> | null {
  const chain = Object.values(getActiveChains()).find(
    (candidate) => candidate.type === "evm" && Number(candidate.id) === chainId,
  );
  if (!chain) return null;

  return new Map(
    [
      [chain.usdcAddress, "USDC"],
      [chain.usdtAddress, "USDT"],
    ]
      .filter((entry): entry is [string, string] => Boolean(entry[0]))
      .map(([address, symbol]) => [address.toLowerCase(), symbol]),
  );
}

function isPositiveInteger(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return false;
  return BigInt(value) > 0n;
}

function isAllowedAddress(value: unknown): value is string {
  return typeof value === "string" && EVM_ADDRESS.test(value);
}

export function validateBridgeAction(action: BridgeAction): string | null {
  const fromChainId = Number(action.fromChainId);
  const toChainId = Number(action.toChainId);
  const fromTokens = getAllowedTokens(fromChainId);
  const toTokens = getAllowedTokens(toChainId);
  const fromTokenAddress =
    typeof action.fromToken?.address === "string"
      ? action.fromToken.address.toLowerCase()
      : "";
  const toTokenAddress =
    typeof action.toToken?.address === "string"
      ? action.toToken.address.toLowerCase()
      : "";

  if (!Number.isInteger(fromChainId) || !Number.isInteger(toChainId)) {
    return "Invalid bridge network";
  }
  if (fromChainId === toChainId || !fromTokens || !toTokens) {
    return "Unsupported bridge network pair";
  }
  if (!fromTokens.has(fromTokenAddress) || !toTokens.has(toTokenAddress)) {
    return "Unsupported bridge asset";
  }
  if (fromTokens.get(fromTokenAddress) !== toTokens.get(toTokenAddress)) {
    return "Bridge assets must match";
  }
  if (!isPositiveInteger(action.fromAmount)) return "Invalid bridge amount";
  if (
    !isAllowedAddress(action.fromAddress) ||
    !isAllowedAddress(action.toAddress)
  ) {
    return "Invalid bridge account";
  }
  return null;
}

export async function requestLifi(
  path: string,
  body: unknown,
): Promise<Response> {
  const apiKey = process.env.LIFI_API_ID;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-lifi-integrator": "Kellon",
  };
  if (apiKey) headers["x-lifi-api-key"] = apiKey;

  return fetch(`${LIFI_API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export async function forwardLifiResponse(
  response: Response,
): Promise<Response> {
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/json",
    },
  });
}
