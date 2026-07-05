import { Guardian } from "@/types/db"
import { ApiResponse, handleResponse } from "."

// Assuming types exist in your db schema, otherwise define them locally

export interface RecoveryRequest {
  id: string
  targetUserId: string
  newOwnerAddress: string
  approvalsCount: number
  status: "PENDING" | "EXECUTED" | "EXPIRED"
}

export interface RecoveryExecutionResult {
  txHash?: string
  status: "success" | "pending" | "failed"
  newOwner: string
  chainId: string
}

/**
 * GUARDIAN MANAGEMENT
 */
export const addGuardian = async (guardianId: string): Promise<ApiResponse<Guardian>> => {
  const res = await fetch("/api/recovery/guardians", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ guardianId }),
  })
  return handleResponse(res)
}

export const getMyGuardians = async (): Promise<ApiResponse<Guardian[]>> => {
  const res = await fetch("/api/recovery/guardians", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })
  return handleResponse(res)
}

export const getGuardiansOf = async (): Promise<ApiResponse<Guardian[]>> => {
  const res = await fetch("/api/recovery/guardians/of", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })
  return handleResponse(res)
}

export const acceptGuardianInvite = async (userId: string): Promise<ApiResponse<void>> => {
  const res = await fetch(`/api/recovery/guardians/${userId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })
  return handleResponse(res)
}

/**
 * RECOVERY FLOW
 */
export const initiateRecovery = async (data: {
  newOwnerAddress: string
  threshold: number
  chain: string
}): Promise<ApiResponse<RecoveryRequest>> => {
  const res = await fetch("/api/recovery/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export const getMyRecoveryRequests = async (): Promise<ApiResponse<RecoveryRequest[]>> => {
  const res = await fetch("/api/recovery/requests", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })
  return handleResponse(res)
}

// Updated URL to match: /recovery/approvals/pending
export const getPendingApprovals = async (): Promise<ApiResponse<RecoveryRequest[]>> => {
  const res = await fetch("/api/recovery/approvals/pending", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })
  return handleResponse(res)
}

export const approveRecovery = async (requestId: string): Promise<ApiResponse<void>> => {
  const res = await fetch(`/api/recovery/${requestId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })
  return handleResponse(res)
}

export const executeRecovery = async (requestId: string): Promise<ApiResponse<void>> => {
  const res = await fetch(`/api/recovery/${requestId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  })
  return handleResponse(res)
}

/**
 * SIMPLE / QUICK RECOVERY
 */
// Updated URL to match: /api/simple-recover (Assuming /api prefix)
export const executeSimpleRecover = async (data: {
  newOwnerAddress: string
  chain: string
}): Promise<ApiResponse<RecoveryExecutionResult>> => {
  const res = await fetch("/api/simple-recover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  })
  return handleResponse<RecoveryExecutionResult>(res)
}