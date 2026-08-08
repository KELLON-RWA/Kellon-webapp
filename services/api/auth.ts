import Cookies from "js-cookie";
import {
  ApiResponse,
  BASE_URL,
  clearApiCredentials,
  getOrCreateDeviceId,
  handleResponse,
  LoginResponseData,
  persistApiCredentials,
} from ".";
import { User } from "@/types/db";

/**
 * 🔐 Login with Privy
 * Sends the Privy identity token and device metadata to the backend
 * to establish a session.
 * * @param token - The Privy identity token (JWT)
 */
export async function loginWithPrivy(
  token: string,
): Promise<ApiResponse<LoginResponseData>> {
  clearApiCredentials();
  const device = getOrCreateDeviceId();
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      device,
      deviceInfo: {
        platform: "web",
      },
    }),
    credentials: "include",
  });

  const user = await handleResponse<LoginResponseData>(res); // ✅ generic added

  const authToken = user?.data?.token;
  const apiSecret = user?.data?.apiSecret;
  const deviceToken = user?.data?.deviceToken || user?.data?.deviceId || device;

  if (authToken && apiSecret) {
    persistApiCredentials({
      token: authToken,
      apiSecret,
      deviceToken,
    });

    Cookies.set("deviceToken", deviceToken, {
      expires: 365,
      path: "/",
      sameSite: "strict",
      secure: true,
    });
  }

  return user;
}

/**
 * 🚪 Logout User
 * Notifies the backend to invalidate the session and clear cookies.
 */
export async function logout(device: string) {
  const res = await fetch(`/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // This is the missing piece
    },
    credentials: "include",
    body: JSON.stringify({ device }),
  });

  try {
    return await handleResponse(res);
  } finally {
    clearApiCredentials();
    Cookies.remove("deviceToken", { path: "/" });
  }
}
/**
 * 🔎 Get Current Session
 * Server-side utility to check authentication status by forwarding
 * the session token to the backend.
 * * @note This function must be called within a Next.js Server Component or Action.
 * @returns User object if authenticated, otherwise null.
 */
export async function getSession(
  sessionToken?: string,
): Promise<ApiResponse<User> | null> {
  const isBrowser = typeof window !== "undefined";

  // Server components must forward the cookie explicitly. Browser callers use
  // the same-origin proxy so the session cookie is attached automatically.
  if (!isBrowser && !sessionToken) return null;

  try {
    const res = await fetch(
      isBrowser ? "/api/users/me" : `${BASE_URL}/users/me`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(!isBrowser && sessionToken
            ? { Cookie: `session_token=${sessionToken}` }
            : {}),
        },
        credentials: "include",
        cache: "no-store",
      },
    );

    return await handleResponse(res);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // console.error("Session fetch failed:", error)
    return null;
  }
}
