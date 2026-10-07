import { Guardian } from "@/types/db";
import { apiFetch, ApiResponse, handleResponse } from ".";

// Assuming types exist in your db schema, otherwise define them locally

export interface RecoveryRequest {
  id: string;
  targetUserId?: string;
  userId?: string;
  newOwnerAddress: string;
  chain?: string;
  approvals?: string[];
  approvalsCount?: number;
  threshold: number;
  status: "PENDING" | "EXECUTED" | "EXPIRED" | string;
}

export interface RecoveryExecutionResult {
  txHash?: string;
  status: "success" | "pending" | "failed";
  newOwner: string;
  chainId: string;
}

/**
 * GUARDIAN MANAGEMENT
 */
export const addGuardian = async (
  guardianId: string,
): Promise<ApiResponse<Guardian>> => {
  const res = await apiFetch("/api/recovery/guardians", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guardianId }),
  });
  return handleResponse(res);
};

export const getMyGuardians = async (): Promise<ApiResponse<Guardian[]>> => {
  const res = await apiFetch("/api/recovery/guardians", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(res);
};

export const getGuardiansOf = async (): Promise<ApiResponse<Guardian[]>> => {
  const res = await apiFetch("/api/recovery/guardians/of", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(res);
};

export const acceptGuardianInvite = async (
  userId: string,
): Promise<ApiResponse<void>> => {
  const res = await apiFetch(`/api/recovery/guardians/${userId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(res);
};

export const removeGuardian = async (
  guardianId: string,
): Promise<ApiResponse<void>> => {
  const res = await apiFetch(`/api/recovery/guardians/${guardianId}`, {
    method: "DELETE",
  });
  return handleResponse(res);
};

/**
 * RECOVERY FLOW
 */
export const initiateRecovery = async (data: {
  newOwnerAddress: string;
  threshold: number;
  chain: string;
}): Promise<ApiResponse<RecoveryRequest>> => {
  const res = await apiFetch("/api/recovery/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const getMyRecoveryRequests = async (): Promise<
  ApiResponse<RecoveryRequest[]>
> => {
  const res = await apiFetch("/api/recovery/requests", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(res);
};

export const getPendingApprovals = async (): Promise<
  ApiResponse<RecoveryRequest[]>
> => {
  const res = await apiFetch("/api/recovery/approvals/pending", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(res);
};

export const approveRecovery = async (
  requestId: string,
): Promise<ApiResponse<void>> => {
  const res = await apiFetch(`/api/recovery/${requestId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(res);
};

export const executeRecovery = async (
  requestId: string,
): Promise<ApiResponse<void>> => {
  const res = await apiFetch(`/api/recovery/${requestId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(res);
};

/**
 * SIMPLE / QUICK RECOVERY
 */
export const executeSimpleRecover = async (data: {
  newOwnerAddress: string;
  chain: string;
}): Promise<ApiResponse<RecoveryExecutionResult>> => {
  const res = await apiFetch("/api/recovery/simple-recover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<RecoveryExecutionResult>(res);
};
