import type { AssetType } from "@/types/db";
import { ApiResponse, apiFetch, handleResponse } from ".";

export interface InternalTransferPayload {
  amount: number | string;
  symbol: string;
  assetType: AssetType;
  chain: string;
  recipientEmail?: string;
  recipientTag?: string;
  metadata?: Record<string, string | number | boolean | null>;
  verificationCode?: string;
  verificationType?: "otp" | "totp";
  verificationCodes?: Record<string, string>;
}

export interface InternalTransferResponse {
  transactionId?: string;
  status?: string;
  recipient: {
    type: "existing" | "pending";
    id?: string;
    email?: string | null;
    tag?: string | null;
  };
}

export interface TransferRecipient {
  found: boolean;
  id?: string;
  name?: string | null;
  addresses?: Record<string, string | null | undefined> | null;
}

export interface SponsorUserOperationPayload {
  userOperation: Record<string, unknown>;
  chain: string;
}

export interface SubmitUserOperationPayload
  extends SponsorUserOperationPayload {
  signature: string;
  verificationCode?: string;
  verificationType?: string;
  verificationCodes?: Record<string, string>;
}

export interface SubmitUserOperationResponse {
  userOpHash: string;
}

type TransferErrorBody = {
  message?: string;
  code?: string;
  verificationType?: "otp" | "totp";
  error?:
    | string
    | {
        message?: string;
        code?: string;
        verificationType?: "otp" | "totp";
      };
};

export class TransferVerificationRequiredError extends Error {
  verificationType: "otp" | "totp";

  constructor(message: string, verificationType: "otp" | "totp" = "otp") {
    super(message);
    this.name = "TransferVerificationRequiredError";
    this.verificationType = verificationType;
  }
}

export function isTransferVerificationRequiredError(
  error: unknown,
): error is TransferVerificationRequiredError {
  return error instanceof TransferVerificationRequiredError;
}

function getPlatformHeader(): string {
  return typeof window !== "undefined" ? "web" : "server";
}

async function handleTransferResponse<T>(
  res: Response,
): Promise<ApiResponse<T>> {
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const body = (json || {}) as TransferErrorBody;
    const nestedError =
      typeof body.error === "object" && body.error ? body.error : null;
    const code = nestedError?.code || body.code;
    const message =
      body.message ||
      nestedError?.message ||
      (typeof body.error === "string" ? body.error : undefined) ||
      "Unable to process transfer";
    const verificationType =
      nestedError?.verificationType || body.verificationType || "otp";

    if (res.status === 403 && code === "VERIFICATION_REQUIRED") {
      throw new TransferVerificationRequiredError(message, verificationType);
    }

    throw new Error(message);
  }

  return {
    success: true,
    data: json?.data !== undefined ? json.data : json,
  };
}

export const transferService = {
  verifyRecipient: async (
    identifier: string,
  ): Promise<ApiResponse<TransferRecipient>> => {
    const normalizedIdentifier = identifier.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedIdentifier);
    const queryKey = isEmail
      ? "email"
      : normalizedIdentifier.startsWith("@")
        ? "tag"
        : "username";
    const queryValue =
      queryKey === "email"
        ? normalizedIdentifier.toLowerCase()
        : normalizedIdentifier.replace(/^@/, "");
    const res = await apiFetch(
      `/api/workflows/lookup?${queryKey}=${encodeURIComponent(queryValue)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      { signed: false },
    );

    return handleResponse(res);
  },

  createInternalTransfer: async (
    body: InternalTransferPayload,
  ): Promise<ApiResponse<InternalTransferResponse>> => {
    const res = await apiFetch("/api/transfers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    });

    return handleTransferResponse(res);
  },

  sponsorUserOperation: async (
    body: SponsorUserOperationPayload,
  ): Promise<ApiResponse<unknown>> => {
    const res = await apiFetch(
      "/api/transfers/sponsor",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-platform": getPlatformHeader(),
        },
        body: JSON.stringify(body),
      },
      { signed: false },
    );

    return handleTransferResponse(res);
  },

  submitUserOperation: async (
    body: SubmitUserOperationPayload,
  ): Promise<ApiResponse<SubmitUserOperationResponse>> => {
    const res = await apiFetch("/api/transfers/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    });

    return handleTransferResponse(res);
  },
};
