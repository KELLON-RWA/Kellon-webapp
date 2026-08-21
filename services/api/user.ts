import { ApiResponse, apiFetch, handleResponse } from "."
import { User } from "@/types/db"

export const updateProfile = async (data: {
  name: string
  tag: string
}): Promise<ApiResponse<User>> => {

  const res = await fetch("/api/users/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include",
  })

  return handleResponse(res)
}

export const syncMyAssets = async (): Promise<ApiResponse<User | null>> => {
  const res = await apiFetch(
    "/api/users/me/sync",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    },
    { signed: true },
  )

  return handleResponse<User | null>(res)
}
