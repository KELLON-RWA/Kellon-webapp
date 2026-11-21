import { User } from "@/types/db";
import { requireSecureSessionLogin } from "@/lib/secure-session";

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

    const thrown = new Error(
      validationMessage ||
        error.message ||
        nestedMessage ||
        "Something went wrong",
    ) as Error & {
      status?: number;
      code?: string;
      action?: string;
      availableMethods?: string[];
      body?: unknown;
    };
    thrown.status = res.status;
    thrown.body = error;
    if (typeof (error as Record<string, unknown>).code === "string") {
      thrown.code = (error as Record<string, unknown>).code as string;
    }
    if (typeof (error as Record<string, unknown>).action === "string") {
      thrown.action = (error as Record<string, unknown>).action as string;
    }
    if (Array.isArray((error as Record<string, unknown>).availableMethods)) {
      thrown.availableMethods = (error as Record<string, unknown>)
        .availableMethods as string[];
    }
    throw thrown;
  }

  const json = await res.json().catch(() => null);

  // If the response has a top-level 'data' property, unwrap it
  const unwrappedData = json?.data !== undefined ? json.data : json;

  return { success: true, data: unwrappedData };
}

/**
 * Resolves the backend API base URL, with the production API as a safe fallback.
 */
const getBaseUrl = () => {
  const apiUrl =
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.kellon.xyz";

  return apiUrl;
};

export const BASE_URL = getBaseUrl();

// --- Secure In-Memory & Non-Extractable Credentials Storage ---
let inMemoryCredentials: ApiCredentials | null = null;
let inMemoryHmacKey: CryptoKey | null = null;

const VAULT_STORAGE_KEY = "kellon_sec_vault";
const VAULT_WINDOW_NAME_PREFIX = "kellon_vkey:";

const LEGACY_STORAGE_KEYS = [
  "kellon_api_secret",
  "kellon_device_token",
  "kellon_generated_device_id",
  "kellon_auth_token",
];

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function getWindowVaultKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (window.name && window.name.startsWith(VAULT_WINDOW_NAME_PREFIX)) {
      return window.name.slice(VAULT_WINDOW_NAME_PREFIX.length);
    }
  } catch {}
  return null;
}

function setWindowVaultKey(key: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (key) {
      window.name = `${VAULT_WINDOW_NAME_PREFIX}${key}`;
    } else if (window.name && window.name.startsWith(VAULT_WINDOW_NAME_PREFIX)) {
      window.name = "";
    }
  } catch {}
}

async function encryptVaultPayload(data: string, hexKey: string): Promise<string> {
  const enc = new TextEncoder();
  const keyBytes = hexToBytes(hexKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    enc.encode(data),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToHex(combined);
}

async function decryptVaultPayload(encryptedHex: string, hexKey: string): Promise<string | null> {
  try {
    const combined = hexToBytes(encryptedHex);
    if (combined.length < 13) return null;
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const keyBytes = hexToBytes(hexKey);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes as unknown as BufferSource,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext as unknown as BufferSource,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

async function saveToSecureVault(credentials: ApiCredentials): Promise<void> {
  if (typeof window === "undefined" || !crypto.subtle) return;
  try {
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const hexKey = bytesToHex(keyBytes);
    const serialized = JSON.stringify(credentials);
    const encrypted = await encryptVaultPayload(serialized, hexKey);
    sessionStorage.setItem(VAULT_STORAGE_KEY, encrypted);
    setWindowVaultKey(hexKey);
  } catch {
    // Graceful fallback to memory-only
  }
}

let vaultRestorePromise: Promise<void> | null = null;

async function restoreFromSecureVault(): Promise<void> {
  if (typeof window === "undefined" || !crypto.subtle || inMemoryCredentials) return;
  const hexKey = getWindowVaultKey();
  const encrypted = sessionStorage.getItem(VAULT_STORAGE_KEY);
  if (!hexKey || !encrypted) return;

  try {
    const serialized = await decryptVaultPayload(encrypted, hexKey);
    if (serialized) {
      const parsed = JSON.parse(serialized) as ApiCredentials;
      if (parsed.apiSecret && parsed.token && parsed.deviceToken) {
        inMemoryCredentials = parsed;
      }
    }
  } catch {
    // If decryption fails, credentials remain empty and trigger clean login
  }
}

export function purgeLegacyPersistentCredentials(): void {
  if (typeof window === "undefined") return;

  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
  }
}

purgeLegacyPersistentCredentials();

if (typeof window !== "undefined") {
  vaultRestorePromise = restoreFromSecureVault();
}

export function persistApiCredentials(credentials: ApiCredentials): void {
  inMemoryCredentials = {
    token: credentials.token,
    apiSecret: credentials.apiSecret,
    deviceToken: credentials.deviceToken,
  };
  inMemoryHmacKey = null;

  purgeLegacyPersistentCredentials();

  if (typeof window !== "undefined" && credentials.apiSecret) {
    void saveToSecureVault(credentials);
  }
}

export function clearApiCredentials(): void {
  inMemoryCredentials = null;
  inMemoryHmacKey = null;

  if (typeof window === "undefined") return;

  setWindowVaultKey(null);
  try {
    sessionStorage.removeItem(VAULT_STORAGE_KEY);
  } catch {}

  purgeLegacyPersistentCredentials();
}

export function getOrCreateDeviceId(): string {
  if (inMemoryCredentials?.deviceToken) {
    return inMemoryCredentials.deviceToken;
  }

  const deviceId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `web_${crypto.randomUUID()}`
      : `web_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return deviceId;
}

/** Read fresh at every connect — a captured token pins a reconnect loop into 4401. */
export function getAuthToken(): string | undefined {
  return inMemoryCredentials?.token || undefined;
}

async function getApiCredentials(): Promise<Required<ApiCredentials>> {
  if (!inMemoryCredentials && vaultRestorePromise) {
    await vaultRestorePromise;
  }

  const token = inMemoryCredentials?.token;
  const apiSecret = inMemoryCredentials?.apiSecret;
  const deviceToken = inMemoryCredentials?.deviceToken;

  if (!token || !apiSecret || !deviceToken) {
    requireSecureSessionLogin();
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

async function getOrCreateHmacKey(secret: string): Promise<CryptoKey> {
  if (inMemoryHmacKey) return inMemoryHmacKey;
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Request signing is unavailable in this browser.");
  }

  const enc = new TextEncoder();
  inMemoryHmacKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return inMemoryHmacKey;
}

async function signWithHmac(message: string, secret: string): Promise<string> {
  const key = await getOrCreateHmacKey(secret);
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  return signWithHmac(message, secret);
}

export async function createWebauthnAttestation(): Promise<string> {
  const { apiSecret, deviceToken } = await getApiCredentials();

  const timestamp = Date.now().toString();
  const payload = `biometric_attestation:${timestamp}:${deviceToken}`;
  const signature = await signWithHmac(payload, apiSecret);

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
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return new URL(input);
  }

  const normalizedBase = BASE_URL.replace(/\/+$/, "");
  let path = input.startsWith("/") ? input : `/${input}`;

  if (normalizedBase.endsWith("/api/v1") && path.startsWith("/api/v1/")) {
    path = path.replace(/^\/api\/v1/, "");
  } else if (normalizedBase.endsWith("/api/v1") && path.startsWith("/api/")) {
    path = path.replace(/^\/api/, "");
  } else if (normalizedBase.endsWith("/api") && path.startsWith("/api/")) {
    path = path.replace(/^\/api/, "");
  }

  return new URL(`${normalizedBase}${path}`);
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

const SIGNED_ROUTE_SEGMENTS = [
  "transfers",
  "onramp",
  "offramp",
  "invoices",
  "gifts",
  "recovery",
  "security",
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

function shouldSignRequest(canonicalPath: string): boolean {
  const segments = canonicalPath.split("?")[0].split("/").filter(Boolean);
  return segments.some((segment) => SIGNED_ROUTE_SEGMENTS.includes(segment));
}

async function createSigningHeaders(
  method: string,
  fullUrl: string,
  rawBody: string,
): Promise<Record<string, string>> {
  const { token, apiSecret, deviceToken } = await getApiCredentials();
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
// Mirrors the fields the backend idempotency middleware leaves out of its body hash.
const IDEMPOTENCY_VOLATILE_FIELDS = new Set([
  "verificationCode",
  "verificationCodes",
  "verificationType",
  "otp",
  "code",
  "rate",
  "fiatAmount",
  "receivableAmount",
  "amountReceived",
  "amount_received",
  "nairaValue",
  "exchangeRate",
  "quotedAmount",
  "totalToPay",
]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/**
 * One key per (operation, endpoint, request intent). An identical retry of the same call
 * reuses its key so the backend replays the first outcome; any different call made during
 * the same operation gets its own key instead of colliding with the first one.
 */
export async function deriveIdempotencyKey(
  operationKey: string,
  method: string,
  path: string,
  rawBody: string,
): Promise<string> {
  let intent: unknown = rawBody;
  try {
    const parsed = rawBody ? JSON.parse(rawBody) : null;
    intent =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.fromEntries(
            Object.entries(parsed).filter(
              ([k]) => !IDEMPOTENCY_VOLATILE_FIELDS.has(k),
            ),
          )
        : parsed;
  } catch {
    // Non-JSON bodies are keyed on their raw text.
  }
  const material = `${operationKey}:${method.toUpperCase()}:${path.split("?")[0]}:${stableStringify(intent)}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
    headers.set(
      "Idempotency-Key",
      await deriveIdempotencyKey(
        activeOperationKey,
        method,
        canonicalPath,
        rawBody,
      ),
    );
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
