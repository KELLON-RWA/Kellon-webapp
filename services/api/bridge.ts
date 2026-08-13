export interface BridgeToken {
  address: string;
  chainId: number;
  decimals: number;
  symbol: string;
}

export interface BridgeTransactionRequest {
  to?: string;
  data?: string;
  value?: string;
}

export interface BridgeStep {
  id: string;
  type: string;
  tool: string;
  toolDetails?: { name?: string };
  action: {
    fromChainId: number;
    toChainId: number;
    fromAmount: string;
    fromToken: BridgeToken;
    toToken: BridgeToken;
    fromAddress?: string;
    toAddress?: string;
  };
  estimate?: {
    approvalAddress?: string;
    executionDuration?: number;
  };
  transactionRequest?: BridgeTransactionRequest;
}

export interface BridgeRoute {
  id: string;
  fromChainId: number;
  toChainId: number;
  fromAmount: string;
  toAmount: string;
  fromToken: BridgeToken;
  toToken: BridgeToken;
  steps: BridgeStep[];
}

interface BridgeRoutesRequest {
  fromChainId: number;
  fromTokenAddress: string;
  fromAmount: string;
  fromAddress: string;
  toChainId: number;
  toTokenAddress: string;
  toAddress: string;
}

async function requestBridge<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error?.message ||
      data?.error ||
      "Bridge provider request failed";
    throw new Error(message);
  }

  return data as T;
}

export const bridgeService = {
  async getRoutes(params: BridgeRoutesRequest): Promise<BridgeRoute[]> {
    const response = await requestBridge<{ routes: BridgeRoute[] }>(
      "/api/bridge/routes",
      params,
    );
    return response.routes;
  },

  async getStepTransaction(step: BridgeStep): Promise<BridgeStep> {
    return requestBridge<BridgeStep>("/api/bridge/step", { step });
  },
};
