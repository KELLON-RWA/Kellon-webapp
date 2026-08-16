import {
  apiFetch,
  getAuthToken,
  handleResponse,
  type ApiResponse,
} from ".";
import type { BridgeStatus } from "./yield";

export type BridgeProvider = "lifi" | "allbridge";
export type BridgeMessenger = "1" | "2" | "4";

export interface BridgeRateOption {
  provider: BridgeProvider;
  supported: boolean;
  estimatedFee?: string;
  estimatedOutput?: string;
  estimatedTime?: number;
  executionDuration?: number;
  messenger?: BridgeMessenger;
  messengerName?: string;
  minAmount?: string;
  reason?: string;
  message?: string;
}

export interface BridgeRecommendation {
  provider: BridgeProvider;
  messenger?: BridgeMessenger;
  messengerName?: string;
}

export type BridgeMinimumThresholds = Record<string, string | number>;

export interface CompareBridgeRatesRequest {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
}

export interface CompareBridgeRatesResult {
  options: BridgeRateOption[];
  recommended?: BridgeRecommendation;
  minThresholds: BridgeMinimumThresholds;
}

export interface FundingSource {
  chain: string;
  symbol: string;
  amount: string;
  decimals?: number;
  hasWallet?: boolean;
}

export interface FundingPlan {
  totalRequested: string;
  sources: FundingSource[];
  shortfall: string;
  insufficientBalances: boolean;
  targetChain?: string;
}

export interface CalculateFundingPlanRequest {
  symbol: "USDC" | "USDT";
  amount: string;
  selectedChains: string[];
  targetChain: string;
}

export interface BuiltBridgeTransaction {
  to?: string;
  data?: string;
  value?: string | number;
  chainId?: string | number;
  serializedTx?: string;
}

export interface ExecutedFundingStep {
  sourceChain: string;
  bridgeProvider: BridgeProvider | "manual";
  approveTx?: BuiltBridgeTransaction;
  bridgeTx: BuiltBridgeTransaction;
}

export interface ExecuteFundingPlanResult {
  steps: ExecutedFundingStep[];
  transactions: BuiltBridgeTransaction[];
  alreadyOnTarget: string;
}

export type UnifiedBridgeBalances = Record<string, unknown>;

async function bridgeRequest<T>(
  endpoint: string,
  init: RequestInit,
  options: { authenticated?: "required" | "optional"; signed?: boolean } = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  if (options.authenticated && !options.signed) {
    const token = getAuthToken();
    if (!token && options.authenticated === "required") {
      throw new Error("Secure session missing. Please log in again.");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await apiFetch(
    endpoint,
    { ...init, headers },
    { signed: options.signed === true },
  );
  return handleResponse<T>(response);
}

export const bridgeService = {
  getUnifiedBalances: async (
    symbol: CalculateFundingPlanRequest["symbol"] = "USDC",
  ): Promise<UnifiedBridgeBalances> => {
    const response = await bridgeRequest<UnifiedBridgeBalances>(
      `/api/funding/unified-balances?symbol=${encodeURIComponent(symbol)}`,
      { method: "GET", cache: "no-store" },
      { authenticated: "required", signed: true },
    );
    return response.data;
  },

  getMinThresholds: async (): Promise<BridgeMinimumThresholds> => {
    const response = await bridgeRequest<BridgeMinimumThresholds>(
      "/api/funding/min-thresholds",
      { method: "GET", cache: "no-store" },
    );
    return response.data;
  },

  compareRates: async (
    request: CompareBridgeRatesRequest,
  ): Promise<CompareBridgeRatesResult> => {
    const response = await bridgeRequest<CompareBridgeRatesResult>(
      "/api/funding/compare-rates",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
    );
    return response.data;
  },

  calculatePlan: async (
    request: CalculateFundingPlanRequest,
  ): Promise<FundingPlan> => {
    const response = await bridgeRequest<FundingPlan>(
      "/api/funding/calculate-plan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      },
      { authenticated: "required", signed: true },
    );
    return response.data;
  },

  executePlan: async (
    plan: FundingPlan,
    targetChain: string,
    messenger?: BridgeMessenger,
  ): Promise<ExecuteFundingPlanResult> => {
    const response = await bridgeRequest<ExecuteFundingPlanResult>(
      "/api/funding/execute",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, targetChain, messenger }),
      },
      { authenticated: "required", signed: true },
    );
    return response.data;
  },

  getStatus: async (params: {
    provider: BridgeProvider;
    txHash: string;
    chainId?: number;
    fromChain?: string;
    toChain?: string;
    amount?: string;
    symbol?: string;
  }): Promise<BridgeStatus> => {
    const search = new URLSearchParams({
      provider: params.provider,
      txHash: params.txHash,
    });
    if (params.chainId) search.set("chainId", String(params.chainId));
    if (params.fromChain) search.set("fromChain", params.fromChain);
    if (params.toChain) search.set("toChain", params.toChain);
    if (params.amount) search.set("amount", params.amount);
    if (params.symbol) search.set("symbol", params.symbol);

    const response = await bridgeRequest<BridgeStatus>(
      `/api/funding/bridge-status?${search.toString()}`,
      { method: "GET", cache: "no-store" },
      { authenticated: "optional" },
    );
    return response.data;
  },
};
