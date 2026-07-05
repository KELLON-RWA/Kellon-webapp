import { BankDetail } from "@/types/db";
import { ApiResponse, apiFetch, handleResponse } from ".";

/**
 * Bank Account Management Service
 * Handles CRUD operations for user-linked bank accounts.
 * Note: These endpoints require 'include' credentials for session-based auth.
 */
export const bankService = {
  /**
   * GET /api/banks
   * Retrieves all bank accounts linked to the current user.
   */
  getBanks: async (): Promise<ApiResponse<BankDetail[]>> => {
    const res = await apiFetch("/api/banks", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    return handleResponse(res);
  },

  /**
   * POST /api/banks
   * Adds a new bank account to the user's profile.
   * Trigger this after successful Centiiv bank verification.
   */
  addBank: async (
    data: Partial<BankDetail>,
  ): Promise<ApiResponse<BankDetail>> => {
    const res = await apiFetch("/api/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  /**
   * PATCH /api/banks/:id
   * Updates details for a specific bank entry.
   */
  updateBank: async (
    id: string,
    data: Partial<BankDetail>,
  ): Promise<ApiResponse<BankDetail>> => {
    const res = await apiFetch(`/api/banks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  /**
   * DELETE /api/banks/:id
   * Removes a bank account from the user's profile.
   */
  deleteBank: async (id: string): Promise<ApiResponse<void>> => {
    const res = await apiFetch(`/api/banks/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    return handleResponse(res);
  },
};
