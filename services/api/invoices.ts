import type { AssetType, Invoice } from "@/types/db";
import { ApiResponse, apiFetch, handleResponse } from ".";

export interface CreateInvoicePayload {
  amount: number | string;
  symbol: string;
  chain?: string | null;
  assetType: AssetType;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  metadata?: Record<string, string | number | boolean | null>;
  expiresAt?: string;
}

export interface PayInvoicePayload {
  paidAmount: number | string;
  paymentReference?: string;
  payerEmail?: string;
  payerName?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export const invoiceService = {
  listInvoices: async (): Promise<ApiResponse<Invoice[]>> => {
    const res = await apiFetch("/api/invoices", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    return handleResponse(res);
  },

  getInvoice: async (id: string): Promise<ApiResponse<Invoice>> => {
    const res = await apiFetch(`/api/invoices/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    return handleResponse(res);
  },

  createInvoice: async (
    payload: CreateInvoicePayload,
  ): Promise<ApiResponse<Invoice>> => {
    const res = await apiFetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  cancelInvoice: async (id: string): Promise<ApiResponse<Invoice>> => {
    const res = await apiFetch(`/api/invoices/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    return handleResponse(res);
  },

  getInvoiceByCode: async (code: string): Promise<ApiResponse<Invoice>> => {
    const res = await apiFetch(`/api/invoices/code/${code}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    return handleResponse(res);
  },

  payInvoiceByCode: async (
    code: string,
    payload: PayInvoicePayload,
  ): Promise<ApiResponse<Invoice>> => {
    const res = await apiFetch(`/api/invoices/code/${code}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },
};
