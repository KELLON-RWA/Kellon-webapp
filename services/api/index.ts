import { User } from "@/types/db";

type ApiError = {
  message?: string;
  error?:
    | string
    | {
        message?: string;
        details?: {
          errors?: Array<{
            field?: string;
            message?: string;
          }>;
        };
      };
  details?: {
    errors?: Array<{
      field?: string;
      message?: string;
    }>;
  };
};

type ApiCredentials = {
  apiSecret?: string;
  deviceToken?: string;
  token?: string;
};

type ApiFetchOptions = {
  signed?: boolean;
};

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface LoginResponseData {
  token?: string;
  deviceToken?: string;
  device?: string;
  deviceId?: string;
  apiSecret?: string;
  user?: User; // if user data is also returned
  // include any other fields your backend returns
}
/**
 * Standardized handler for fetch responses.
 * Parses JSON on success or extracts error messages on failure.
 * @param res - Fetch Response object
 * @returns Parsed JSON body or null if empty
 * @throws Error with message from backend or default fallback
 */

export async function handleResponse<T>(
  res: Response,
): Promise<ApiResponse<T>> {
  if (!res.ok) {
    let error: ApiError = {};
    try {
      error = await res.json();
    } catch {}
    const nestedMessage =
      typeof error.error === "object" ? error.error.message : error.error;
    const validationDetails =
      (typeof error.error === "object" ? error.error.details : undefined) ||
      error.details;
    const validationMessage = validationDetails?.errors
      ?.map(({ field, message }) => [field, message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(", ");

    throw new Error(
      validationMessage ||
        error.message ||
        nestedMessage ||
        "Something went wrong",
    );
  }

  const json = await res.json().catch(() => null);

  // If the response has a top-level 'data' property, unwrap it
  const unwrappedData = json?.data !== undefined ? json.data : json;

  return { success: true, data: unwrappedData };
}

/**
 * Validates and retrieves the backend API base URL.
 * @throws Error if the environment variable is missing.
 */
const getBaseUrl = () => {
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;

  if (!apiUrl || apiUrl.length === 0) {
    throw new Error(
      "Missing environment variable NEXT_PUBLIC_BACKEND_API_URL!!",
    );
  }

  return apiUrl;
};

export const BASE_URL = getBaseUrl();

const API_SECRET_STORAGE_KEY = "kellon_api_secret";
const DEVICE_TOKEN_STORAGE_KEY = "kellon_device_token";
const GENERATED_DEVICE_ID_STORAGE_KEY = "kellon_generated_device_id";
const AUTH_TOKEN_STORAGE_KEY = "kellon_auth_token";

// Logical route segments, deliberately without the deployed "/api/v1" prefix: matching
// on the full deployed path means a BASE_URL that omits (or renames) that segment
// silently stops signing every route, which surfaces as a blanket 401 "Missing signing
// headers" rather than as a config error.
const SIGNED_ROUTE_SEGMENTS = [
  "transfers",
  "onramp",
  "offramp",
  "invoices",
  "gifts",
  "banks",
  "kyc",
  "cards",
  "yield",
  "biometric",
  "bridge",
  "funding",
  "workflows",
  "workflow",
  "stocks",
  "fiat",
  "users",
];

function getStoredValue(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;

  return sessionStorage.getItem(key) || localStorage.getItem(key) || undefined;
}

function setStoredValue(key: string, value: string): void {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(key, value);
  localStorage.setItem(key, value);
}

export function persistApiCredentials(credentials: ApiCredentials): void {
  if (credentials.token) {
    setStoredValue(AUTH_TOKEN_STORAGE_KEY, credentials.token);
  }

  if (credentials.apiSecret) {
    setStoredValue(API_SECRET_STORAGE_KEY, credentials.apiSecret);
  }

  if (credentials.deviceToken) {
    setStoredValue(DEVICE_TOKEN_STORAGE_KEY, credentials.deviceToken);
  }
}

export function clearApiCredentials(): void {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(API_SECRET_STORAGE_KEY);
  sessionStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(API_SECRET_STORAGE_KEY);
  localStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function getOrCreateDeviceId(): string {
  const existingDeviceId = getStoredValue(GENERATED_DEVICE_ID_STORAGE_KEY);

  if (existingDeviceId) return existingDeviceId;

  const deviceId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `web_${crypto.randomUUID()}`
      : `web_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  setStoredValue(GENERATED_DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}

/** Read fresh at every connect — a captured token pins a reconnect loop into 4401. */
export function getAuthToken(): string | undefined {
  return getStoredValue(AUTH_TOKEN_STORAGE_KEY);
}

function getApiCredentials(): Required<ApiCredentials> {
  const token = getStoredValue(AUTH_TOKEN_STORAGE_KEY);
  const apiSecret = getStoredValue(API_SECRET_STORAGE_KEY);
  const deviceToken = getStoredValue(DEVICE_TOKEN_STORAGE_KEY);

  if (!token || !apiSecret || !deviceToken) {
    throw new Error("Secure session missing. Please log in again.");
  }

  return { token, apiSecret, deviceToken };
}

function createNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Request signing is unavailable in this browser.");
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createWebauthnAttestation(): Promise<string> {
  const apiSecret = getStoredValue(API_SECRET_STORAGE_KEY);
  const deviceId = getStoredValue(DEVICE_TOKEN_STORAGE_KEY);

  if (!apiSecret || !deviceId) {
    throw new Error("Secure device credentials are missing. Please log in again.");
  }

  const timestamp = Date.now().toString();
  const payload = `biometric_attestation:${timestamp}:${deviceId}`;
  const signature = await hmacSha256Hex(apiSecret, payload);

  return `${timestamp}:${signature}`;
}

function normalizeRequestBody(body: RequestInit["body"]): {
  body: RequestInit["body"];
  rawBody: string;
} {
  if (body === undefined || body === null) {
    return { body: undefined, rawBody: "" };
  }

  if (typeof body === "string") {
    return { body, rawBody: body };
  }

  return { body, rawBody: "" };
}

function getBackendUrl(input: string): URL {
  const baseOrigin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const requestUrl = new URL(input, baseOrigin);

  if (
    requestUrl.origin === baseOrigin &&
    requestUrl.pathname.startsWith("/api/")
  ) {
    const backendBase = new URL(
      BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`,
    );
    const backendPath = requestUrl.pathname.replace(/^\/api\/?/, "");
    return new URL(`${backendPath}${requestUrl.search}`, backendBase);
  }

  return requestUrl;
}

function buildCanonicalPath(url: string): string {
  const parsedUrl = new URL(url);
  let path = parsedUrl.pathname;

  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  const query = [...parsedUrl.searchParams.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");

  return query ? `${path}?${query}` : path;
}

function shouldSignRequest(canonicalPath: string): boolean {
  const segments = canonicalPath.split("?")[0].split("/").filter(Boolean);
  return segments.some((segment) => SIGNED_ROUTE_SEGMENTS.includes(segment));
}

async function createSigningHeaders(
  method: string,
  fullUrl: string,
  rawBody: string,
): Promise<Record<string, string>> {
  const { token, apiSecret, deviceToken } = getApiCredentials();
  const timestamp = Date.now().toString();
  const nonce = createNonce();
  const canonicalPath = buildCanonicalPath(fullUrl);
  const normalizedMethod = method.toUpperCase();
  const body = ["GET", "DELETE"].includes(normalizedMethod) ? "" : rawBody;
  const payload = `${timestamp}:${nonce}:${deviceToken}:${normalizedMethod}:${canonicalPath}:${body}`;
  const signature = await hmacSha256Hex(apiSecret, payload);

  return {
    Authorization: `Bearer ${token}`,
    "x-request-timestamp": timestamp,
    "x-request-nonce": nonce,
    "x-device-id": deviceToken,
    "x-request-signature": signature,
  };
}

let activeOperationKey: string | null = null;

/**
 * Marks the start of one user-intent operation (a withdrawal, a send) so every HTTP
 * attempt it makes carries the same `Idempotency-Key`.
 *
 * Scoped to the intent rather than the request because the interesting retry is the MFA
 * round trip: attempt 1 gets 403 VERIFICATION_REQUIRED, attempt 2 replays the same body
 * plus a code. The backend's idempotency middleware already excludes verification fields
 * from its body hash precisely so those two attempts match — but only if the client sends
 * one stable key across both.
 *
 * Pass `resume: true` when re-entering a handler to satisfy a challenge; a fresh
 * user-initiated attempt always mints a new key, so a key left behind by an abandoned
 * operation can never be reused by the next, unrelated one.
 */
export function beginOperation(resume = false): string {
  if (!resume) activeOperationKey = null;
  if (!activeOperationKey) {
    activeOperationKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  return activeOperationKey;
}

/** Ends the current operation. Call on success or terminal failure — never between a challenge and its retry. */
export function endOperation(): void {
  activeOperationKey = null;
}

/** True while an operation key is live, so a retry can resume it instead of minting a new one. */
export function hasActiveOperation(): boolean {
  return activeOperationKey !== null;
}

export async function apiFetch(
  input: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {},
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const { body, rawBody } = normalizeRequestBody(init.body);
  const backendUrl = getBackendUrl(input);
  const canonicalPath = buildCanonicalPath(backendUrl.toString());
  const mustSign =
    options.signed === true ||
    (options.signed !== false && shouldSignRequest(canonicalPath));
  const headers = new Headers(init.headers);

  if (body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (
    activeOperationKey &&
    ["POST", "PUT", "PATCH"].includes(method) &&
    !headers.has("Idempotency-Key")
  ) {
    headers.set("Idempotency-Key", activeOperationKey);
  }

  if (mustSign) {
    const signingHeaders = await createSigningHeaders(
      method,
      backendUrl.toString(),
      rawBody,
    );

    Object.entries(signingHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  const credentials = init.credentials || (mustSign ? "omit" : "include");

  const requestUrl = mustSign ? backendUrl.toString() : input;

  return fetch(requestUrl, {
    ...init,
    method,
    headers,
    credentials,
    body: ["GET", "DELETE"].includes(method) ? undefined : body,
  });
}
