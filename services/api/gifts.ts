import { ApiResponse, apiFetch, handleResponse } from ".";

export interface SendGiftPayload {
  recipientTag?: string;
  recipientEmail?: string;
  amount: number | string;
  symbol: string;
  chain: string;
  message?: string;
  templateId?: string;
  title?: string;
}

export interface Gift {
  id: string;
  senderId?: string;
  recipientId?: string | null;
  recipientTag?: string | null;
  recipientEmail?: string | null;
  amount: number | string;
  symbol: string;
  chain?: string | null;
  message?: string | null;
  templateId?: string | null;
  title?: string | null;
  status?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  metadata?: Record<string, unknown> | null;
}

export const giftService = {
  sendGift: async (
    payload: SendGiftPayload,
  ): Promise<ApiResponse<Gift | unknown>> => {
    const res = await apiFetch("/api/gifts/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return handleResponse(res);
  },

  listSent: async (): Promise<ApiResponse<Gift[]>> => {
    const res = await apiFetch("/api/gifts/sent", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    return handleResponse(res);
  },

  listReceived: async (): Promise<ApiResponse<Gift[]>> => {
    const res = await apiFetch("/api/gifts/received", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    return handleResponse(res);
  },
};
