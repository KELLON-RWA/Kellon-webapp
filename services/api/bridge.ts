import {
  apiFetch,
  getAuthToken,
  type ApiResponse,
} from ".";
import { handleTransferResponse } from "./transfers";
import type { BridgeStatus } from "./yield";

export type BridgeProvider = "lifi" | "allbridge" | "cctp";
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
  targetToken?: string;
  provider?: BridgeProvider;
}

export interface CalculateFundingPlanRequest {
  symbol: "USDC" | "USDT";
  amount: string;
  selectedChains: string[];
  targetChain: string;
  targetToken?: "USDC" | "USDT";
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
  alreadyOnTarget: string | boolean;
  groupId?: string;
}

export interface ExecuteFundingPlanOptions {
  messenger?: BridgeMessenger;
  targetToken?: "USDC" | "USDT";
  provider?: BridgeProvider;
  verification?: BridgeVerificationPayload;
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
  return handleTransferResponse<T>(response);
}

export interface BridgeVerificationPayload {
  verificationCode: string;
  verificationType: string;
  verificationCodes: Array<{ type: string; code: string }>;
}

export interface TrackBridgeRequest {
  txHash: string;
  provider: BridgeProvider;
  fromChain: string;
  toChain: string;
  amount: string;
  symbol: string;
  groupId?: string;
}

/** CCTP only accepts positive values with at most six decimal places. */
export function normalizeBridgeAmount(value: string | number): string {
  const raw = String(value).trim();
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);

  if (match) {
    const integer = match[1];
    const fraction = (match[2] || "").slice(0, 6).replace(/0+$/, "");
    return fraction ? `${integer}.${fraction}` : integer;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return raw;

  // Avoid rounding a Max amount above the user balance.
  return (Math.floor(parsed * 1_000_000) / 1_000_000)
    .toFixed(6)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function normalizeFundingPlan(plan: FundingPlan): FundingPlan {
  return {
    ...plan,
    totalRequested: plan.totalRequested
      ? normalizeBridgeAmount(plan.totalRequested)
      : plan.totalRequested,
    shortfall: normalizeBridgeAmount(plan.shortfall),
    sources: plan.sources.map((source) => ({
      ...source,
      amount: normalizeBridgeAmount(source.amount),
    })),
  };
}

export const bridgeService = {
  getUnifiedBalances: async (
    symbol: CalculateFundingPlanRequest["symbol"] = "USDC",
  ): Promise<UnifiedBridgeBalances> => {
    const response = await bridgeRequest<UnifiedBridgeBalances>(
      `/api/bridge/unified-balances?symbol=${encodeURIComponent(symbol)}`,
      { method: "GET", cache: "no-store" },
      { authenticated: "required", signed: true },
    );
    return response.data;
  },

  getMinThresholds: async (): Promise<BridgeMinimumThresholds> => {
    const response = await bridgeRequest<BridgeMinimumThresholds>(
      "/api/bridge/min-thresholds",
      { method: "GET", cache: "no-store" },
    );
    return response.data;
  },

  compareRates: async (
    request: CompareBridgeRatesRequest,
  ): Promise<CompareBridgeRatesResult> => {
    const response = await bridgeRequest<CompareBridgeRatesResult>(
      "/api/bridge/compare-rates",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...request,
          amount: normalizeBridgeAmount(request.amount),
        }),
      },
    );
    return response.data;
  },

  calculatePlan: async (
    request: CalculateFundingPlanRequest,
  ): Promise<FundingPlan> => {
    const response = await bridgeRequest<FundingPlan>(
      "/api/bridge/calculate-plan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...request,
          amount: normalizeBridgeAmount(request.amount),
        }),
      },
      { authenticated: "required", signed: true },
    );
    return response.data;
  },

  executePlan: async (
    plan: FundingPlan,
    targetChain: string,
    options: ExecuteFundingPlanOptions = {},
  ): Promise<ExecuteFundingPlanResult> => {
    const response = await bridgeRequest<ExecuteFundingPlanResult>(
      "/api/bridge/execute",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: normalizeFundingPlan(plan),
          targetChain,
          messenger: options.messenger,
          targetToken: options.targetToken,
          provider: options.provider,
          ...options.verification,
        }),
      },
      { authenticated: "required", signed: true },
    );
    return response.data;
  },

  track: async (request: TrackBridgeRequest): Promise<ApiResponse<unknown>> =>
    bridgeRequest<unknown>(
      "/api/bridge/track",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...request,
          amount: normalizeBridgeAmount(request.amount),
        }),
      },
      { authenticated: "required", signed: true },
    ),

  getStatus: async (params: {
    provider: BridgeProvider;
    txHash: string;
    chainId?: number;
    fromChain?: string;
    toChain?: string;
    amount?: string;
    symbol?: string;
    groupId?: string;
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
    if (params.groupId) search.set("groupId", params.groupId);

    const response = await bridgeRequest<BridgeStatus>(
      `/api/bridge/status?${search.toString()}`,
      { method: "GET", cache: "no-store" },
      { authenticated: "optional" },
    );
    return response.data;
  },
};
