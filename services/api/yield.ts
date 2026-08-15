import type { YieldOpportunity, YieldPosition } from "@/types/db";
import { apiFetch, type ApiResponse } from ".";
import { TransferVerificationRequiredError } from "./transfers";

export type YieldActionType = "supply" | "withdraw";

export interface YieldTransaction {
  to?: string;
  data?: string;
  value?: string | number;
  chainId?: string | number;
  stepType?: "approve" | "bridge" | "supply" | "withdraw";
  provider?: string;
  messengerName?: string;
  txXdr?: string;
  xdr?: string;
}

export interface FundingSource {
  chain: string;
  symbol: string;
  amount: string | number;
}

export interface FundingPlan {
  sources: FundingSource[];
  totalAmount?: string | number;
  targetChain?: string;
}

export interface PreparedYieldAction {
  type?: "direct" | "cross-chain-sequential";
  transactions: YieldTransaction[];
  plan?: FundingPlan;
  metadata?: {
    protocol?: string;
    chain?: string;
    symbol?: string;
    amount?: string;
  };
}

export interface BridgeStatus {
  status?: string;
  substatus?: string;
}

type Verification = {
  verificationCode?: string;
  verificationType?: string;
  verificationCodes?: Array<{ type: string; code: string }>;
};

type YieldErrorBody = {
  message?: string;
  code?: string;
  verificationType?: string;
  availableMethods?: string[];
  error?:
    | string
    | {
        message?: string;
        code?: string;
        verificationType?: string;
        availableMethods?: string[];
      };
};

async function handleYieldResponse<T>(
  response: Response,
): Promise<ApiResponse<T>> {
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const body = (json || {}) as YieldErrorBody;
    const nestedError =
      typeof body.error === "object" && body.error ? body.error : null;
    const code = nestedError?.code || body.code;
    const message =
      body.message ||
      nestedError?.message ||
      (typeof body.error === "string" ? body.error : undefined) ||
      "Unable to process Earn request";
    const verificationType =
      nestedError?.verificationType || body.verificationType;
    const availableMethods =
      body.availableMethods || nestedError?.availableMethods;

    if (
      response.status === 403 &&
      (code === "VERIFICATION_REQUIRED" || Boolean(availableMethods?.length))
    ) {
      throw new TransferVerificationRequiredError(
        message,
        verificationType === "totp" ? "totp" : "otp",
        availableMethods,
      );
    }

    throw new Error(message);
  }

  return {
    success: true,
    data: json?.data !== undefined ? json.data : json,
    message: json?.message,
  };
}

async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  const response = await apiFetch(endpoint, { method: "GET" });
  return handleYieldResponse<T>(response);
}

async function post<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const response = await apiFetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-platform": typeof window !== "undefined" ? "web" : "server",
    },
    body: JSON.stringify(body),
  });
  return handleYieldResponse<T>(response);
}

export const yieldService = {
  getOpportunities: () =>
    get<YieldOpportunity[]>("/api/yield/opportunities"),

  getPositions: () => get<YieldPosition[]>("/api/yield/positions"),

  prepareSupply: (
    opportunityId: string,
    amount: string,
    selectedChains: string[],
    verification?: Verification,
  ) =>
    post<PreparedYieldAction>("/api/yield/prepare-supply", {
      opportunityId,
      amount,
      selectedChains,
      ...verification,
    }),

  prepareWithdraw: (
    opportunityId: string,
    amount: string,
    verification?: Verification,
  ) =>
    post<PreparedYieldAction>("/api/yield/withdraw", {
      opportunityId,
      amount,
      ...verification,
    }),

  confirmPosition: (
    opportunityId: string,
    amount: string,
    txHash: string,
    type: YieldActionType,
  ) =>
    post<YieldPosition>("/api/yield/confirm-position", {
      opportunityId,
      amount,
      txHash,
      type,
    }),

  executeStellar: (
    opportunityId: string,
    amount: string,
    txXdr: string,
    type: YieldActionType,
  ) =>
    post<{ txHash: string; result: YieldPosition }>(
      "/api/yield/execute-stellar",
      { opportunityId, amount, txXdr, type },
    ),

  executeSolana: (
    opportunityId: string,
    amount: string,
    signedTx: string,
    type: YieldActionType,
  ) =>
    post<{ txHash: string; result: YieldPosition }>(
      "/api/yield/execute-solana",
      { opportunityId, amount, signedTx, type },
    ),

  getBridgeStatus: (provider: string, txHash: string, chainId?: number) => {
    const params = new URLSearchParams({ provider, txHash });
    if (chainId) params.set("chainId", String(chainId));
    return get<BridgeStatus>(`/api/yield/bridge-status?${params.toString()}`);
  },
};
