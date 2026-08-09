import { apiFetch, handleResponse, type ApiResponse } from "./index"

export const webPushService = {
  getPublicKey: async (): Promise<ApiResponse<{ publicKey: string }>> => {
    const res = await apiFetch("/api/devices/web-push/key", { method: "GET" })
    return handleResponse(res)
  },

  register: async (
    subscription: PushSubscriptionJSON,
    deviceName?: string,
  ): Promise<ApiResponse<{ id: string }>> => {
    const res = await apiFetch("/api/devices/web-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, deviceName }),
    })
    return handleResponse(res)
  },

  unregister: async (endpoint: string): Promise<ApiResponse<unknown>> => {
    const res = await apiFetch("/api/devices/web-push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    })
    return handleResponse(res)
  },
}
