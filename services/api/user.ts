import { ApiResponse, apiFetch, handleResponse } from ".";
import { handleTransferResponse, type VerificationMethod } from "./transfers";
import { User } from "@/types/db";

export interface ExportedWalletPrivateKey {
  chain: string;
  publicKey: string;
  privateKey: string;
}

export interface ExportWalletPrivateKeyOptions {
  verificationCode?: string;
  verificationType?: VerificationMethod;
}

export const updateProfile = async (data: {
  name: string;
  tag: string;
}): Promise<ApiResponse<User>> => {
  const res = await fetch("/api/users/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include",
  });

  return handleResponse(res);
};

export const syncMyAssets = async (): Promise<ApiResponse<User | null>> => {
  const res = await apiFetch(
    "/api/users/me/sync",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    },
    { signed: true },
  );

  return handleResponse<User | null>(res);
};

/**
 * Exports a chain-specific key after the backend's signed-request and MFA checks.
 * The caller must keep the returned private key in memory only.
 */
export const exportWalletPrivateKey = async (
  chain: string,
  options: ExportWalletPrivateKeyOptions = {},
): Promise<ApiResponse<ExportedWalletPrivateKey>> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.verificationCode) {
    headers["x-verification-code"] = options.verificationCode;
    headers["x-verification-type"] = options.verificationType || "email_otp";
  }

  const res = await apiFetch(
    `/api/users/me/wallets/${encodeURIComponent(chain)}/private-key`,
    {
      method: "POST",
      headers,
      cache: "no-store",
    },
    { signed: true },
  );

  return handleTransferResponse<ExportedWalletPrivateKey>(res);
};
