import type { AssetType } from "@/types/db"
import { ApiResponse, apiFetch, handleResponse } from "."

export interface InternalTransferPayload {
  amount: number | string
  symbol: string
  assetType: AssetType
  chain: string
  recipientEmail?: string
  recipientTag?: string
  metadata?: Record<string, string | number | boolean | null>
  verificationCode?: string
  verificationType?: VerificationType | "otp"
  verificationCodes?: Record<string, string>
}

export interface InternalTransferResponse {
  transactionId?: string
  status?: string
  recipient: {
    type: "existing" | "pending"
    id?: string
    email?: string | null
    tag?: string | null
  }
}

export interface TransferRecipient {
  found: boolean
  id?: string
  name?: string | null
  addresses?: {
    stellar?: string | null
    solana?: string | null
    evm?: string | null
    smartAccount?: string | null
    smartAccounts?: Record<string, string | null> | null
  } | null
}

export interface SponsorUserOperationPayload {
  userOperation: Record<string, unknown>
  chain: string
}

export interface SubmitUserOperationPayload
  extends SponsorUserOperationPayload {
  signature: string
  verificationCode?: string
  verificationType?: string
  verificationCodes?: Record<string, string>
}

export interface SubmitUserOperationResponse {
  userOpHash: string
}

type TransferErrorBody = {
  message?: string
  code?: string
  verificationType?: VerificationType | "otp"
  availableMethods?: string[]
  action?: string
  error?:
    | string
    | {
        message?: string
        code?: string
        verificationType?: VerificationType | "otp"
        availableMethods?: string[]
        action?: string
      }
}

export type VerificationType = "email_otp" | "sms_otp" | "totp"
export type VerificationMethod = VerificationType | "otp"

export class TransferVerificationRequiredError extends Error {
  verificationType: VerificationType
  availableMethods?: string[]
  action?: string

  constructor(
    message: string,
    verificationType: VerificationType = "email_otp",
    availableMethods?: string[],
    action?: string,
  ) {
    super(message)
    this.name = "TransferVerificationRequiredError"
    this.verificationType = verificationType
    this.availableMethods = availableMethods
    this.action = action
  }
}

const SUPPORTED_VERIFICATION_METHODS = new Set<VerificationMethod>([
  "email_otp",
  "sms_otp",
  "totp",
  "otp",
])

export function getAvailableVerificationMethods(
  availableMethods?: string[],
  fallback: VerificationMethod = "email_otp",
): VerificationMethod[] {
  const methods = (availableMethods || [])
    .map((method) => method.toLowerCase())
    .filter((method): method is VerificationMethod =>
      SUPPORTED_VERIFICATION_METHODS.has(method as VerificationMethod),
    )

  const uniqueMethods = [...new Set(methods)]
  const withoutDuplicateLegacyOtp = uniqueMethods.includes("email_otp")
    ? uniqueMethods.filter((method) => method !== "otp")
    : uniqueMethods

  return withoutDuplicateLegacyOtp.length
    ? withoutDuplicateLegacyOtp
    : [fallback]
}

export function getVerificationTypeForMethod(
  method: VerificationMethod,
): VerificationType {
  if (method === "totp") return "totp"
  if (method === "sms_otp") return "sms_otp"
  return "email_otp"
}

export function getOtpChannelForMethod(
  method: VerificationMethod,
): "email" | "sms" | null {
  if (method === "sms_otp") return "sms"
  if (method === "email_otp" || method === "otp") return "email"
  return null
}

/**
 * Picks which code the user is actually going to type.
 *
 * The backend auto-sends an OTP whenever an OTP channel is enabled, so if one is
 * available that emailed/texted code is what the user has in hand — even when TOTP is
 * *also* enabled. Choosing "totp" there sends the emailed code to a verifier that
 * rejects every non-TOTP input. Only fall back to "totp" when no OTP channel exists.
 */
export function resolveVerificationType(
  availableMethods?: string[],
): VerificationType {
  if (!availableMethods?.length) return "email_otp"
  if (availableMethods.includes("email_otp")) return "email_otp"
  if (availableMethods.includes("sms_otp")) return "sms_otp"
  if (availableMethods.includes("totp")) return "totp"
  return "email_otp"
}

/** Preserves the exact verification channel required by the bundler. */
export function resolveVerificationMethod(
  availableMethods?: string[],
  fallback: VerificationMethod = "email_otp",
): VerificationMethod {
  if (!availableMethods?.length) return fallback
  const methods = availableMethods.map((method) => method.toLowerCase())
  if (methods.includes("email_otp")) return "email_otp"
  if (methods.includes("otp")) return "otp"
  if (methods.includes("sms_otp")) return "sms_otp"
  if (methods.includes("totp")) return "totp"
  return fallback
}

function containsVerificationMarker(value: unknown): boolean {
  if (typeof value === "string") {
    const normalized = value.toUpperCase()
    return (
      normalized.includes("VERIFICATION_REQUIRED") ||
      normalized.includes("VERIFICATION REQUIRED")
    )
  }
  if (!value || typeof value !== "object") return false
  try {
    return containsVerificationMarker(JSON.stringify(value))
  } catch {
    return false
  }
}

/** A generic JSON-RPC -32000 failure is not sufficient evidence of MFA. */
export function isTransferVerificationChallenge(
  status: number | undefined,
  error: unknown,
  availableMethods?: string[],
): boolean {
  if (status !== 403) return false
  return containsVerificationMarker(error) || Boolean(availableMethods?.length)
}

// Walk the viem cause chain to find the original MFA error instance.
export function findTransferVerificationRequiredError(
  error: unknown,
): TransferVerificationRequiredError | null {
  // Provider and viem wrappers expose different recursive error shapes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = error
  const seen = new Set<unknown>()
  let fallback: TransferVerificationRequiredError | null = null

  while (current && typeof current === "object" && !seen.has(current)) {
    if (current instanceof TransferVerificationRequiredError) return current
    if (
      current.name === "TransferVerificationRequiredError" &&
      current.verificationType
    ) {
      return current as TransferVerificationRequiredError
    }

    const status = current.status || current.response?.status
    const availableMethods =
      current.availableMethods ||
      current.error?.availableMethods ||
      current.response?.data?.availableMethods ||
      current.response?.data?.error?.availableMethods

    const isMfa =
      current instanceof TransferVerificationRequiredError ||
      containsVerificationMarker(current.message) ||
      containsVerificationMarker(current.details) ||
      isTransferVerificationChallenge(
        status,
        current.error || current.response?.data,
        availableMethods,
      )

    if (isMfa) {
      const action =
        current.action ||
        current.error?.action ||
        current.response?.data?.action ||
        current.response?.data?.error?.action

      const mfaType = resolveVerificationType(availableMethods)

      if (availableMethods) {
        return new TransferVerificationRequiredError(
          "Verification required",
          mfaType,
          availableMethods,
          action,
        )
      }

      if (!fallback) {
        fallback = new TransferVerificationRequiredError(
          "Verification required",
          mfaType,
          availableMethods,
          action,
        )
      }
    }

    seen.add(current)
    current = current.cause
  }
  return fallback
}

export function isTransferVerificationRequiredError(
  error: unknown,
): error is TransferVerificationRequiredError {
  return findTransferVerificationRequiredError(error) !== null
}

function getPlatformHeader(): string {
  return typeof window !== "undefined" ? "web" : "server"
}

/**
 * Response handler that preserves the MFA challenge instead of flattening it.
 *
 * `handleResponse` reduces every non-2xx to `new Error(message)`, dropping `code`,
 * `availableMethods` and `action` — so any flow using it can only render the challenge
 * as a toast, never as a code prompt. Every MFA-gated route must use this one.
 */
export async function handleTransferResponse<T>(
  res: Response,
): Promise<ApiResponse<T>> {
  const json = await res.json().catch(() => null)

  if (!res.ok) {
    const body = (json || {}) as TransferErrorBody
    const nestedError =
      typeof body.error === "object" && body.error ? body.error : null
    const code = nestedError?.code || body.code
    const message =
      body.message ||
      nestedError?.message ||
      (typeof body.error === "string" ? body.error : undefined) ||
      "Unable to process transfer"
    const availableMethods =
      body.availableMethods || nestedError?.availableMethods
    const requestedVerificationType =
      nestedError?.verificationType || body.verificationType
    const verificationType = requestedVerificationType
      ? getVerificationTypeForMethod(requestedVerificationType)
      : resolveVerificationType(availableMethods)
    const action = nestedError?.action || body.action

    if (res.status === 403 && code === "VERIFICATION_REQUIRED") {
      throw new TransferVerificationRequiredError(
        message,
        verificationType,
        availableMethods,
        action,
      )
    }

    throw new Error(message)
  }

  return {
    success: true,
    data: json?.data !== undefined ? json.data : json,
  }
}

export interface TransferStellarPayload {
  amount: number | string
  symbol: string
  toAddress?: string
  recipientEmail?: string
  recipientTag?: string
  recipientUsername?: string
  verificationCode?: string
  verificationType?: "email_otp" | "sms_otp" | "totp" | "webauthn" | string
}

export interface TransferSolanaPayload {
  amount: number | string
  symbol: string
  toAddress?: string
  recipientEmail?: string
  recipientTag?: string
  recipientUsername?: string
  verificationCode?: string
  verificationType?: "email_otp" | "sms_otp" | "totp" | "webauthn" | string
}

export interface PrepareSolanaSponsoredPayload {
  amount: number | string
  symbol: string
  toAddress?: string
  recipientEmail?: string
  recipientTag?: string
  recipientUsername?: string
}

export interface PrepareSolanaSponsoredResponse {
  success: boolean
  serializedTx: string
  destinationAddress: string
}

export interface SubmitSolanaSponsoredPayload {
  amount: number | string
  symbol: string
  toAddress: string
  signedTxBase64: string
  verificationCode?: string
  verificationType?: "email_otp" | "sms_otp" | "totp" | "webauthn" | string
}

export interface TransferEVMPayload {
  amount: number | string
  symbol: string
  chain: string
  toAddress?: string
  recipientEmail?: string
  recipientTag?: string
  recipientUsername?: string
  verificationCode?: string
  verificationType?: "email_otp" | "sms_otp" | "totp" | "webauthn" | string
}

export interface TransferCryptoPayload {
  chain: string
  toAddress: string
  amount: number | string
  verificationCode?: string
  verificationType?: "email_otp" | "sms_otp" | "totp" | "webauthn" | string
}

export const transferService = {
  verifyRecipient: async (
    identifier: string,
  ): Promise<ApiResponse<TransferRecipient>> => {
    const normalizedIdentifier = identifier.trim()
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedIdentifier)
    const queryKey = isEmail
      ? "email"
      : normalizedIdentifier.startsWith("@")
        ? "tag"
        : "username"
    const queryValue =
      queryKey === "email"
        ? normalizedIdentifier.toLowerCase()
        : normalizedIdentifier.replace(/^@/, "")
    const res = await apiFetch(
      `/api/workflows/lookup?${queryKey}=${encodeURIComponent(queryValue)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      { signed: false },
    )

    return handleResponse(res)
  },

  /**
   * @deprecated Use transferStellar, transferSolana, or transferEVM instead.
   */
  createInternalTransfer: async (
    body: InternalTransferPayload,
  ): Promise<ApiResponse<InternalTransferResponse>> => {
    const res = await apiFetch("/api/transfers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    })

    return handleTransferResponse(res)
  },

  transferStellar: async (
    body: TransferStellarPayload,
  ): Promise<ApiResponse<{ hash: string; message: string }>> => {
    const res = await apiFetch("/api/transfers/stellar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    })

    return handleTransferResponse(res)
  },

  transferSolana: async (
    body: TransferSolanaPayload,
  ): Promise<ApiResponse<{ hash: string; message: string }>> => {
    const res = await apiFetch("/api/transfers/solana", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    })

    return handleTransferResponse(res)
  },

  prepareSolanaSponsored: async (
    body: PrepareSolanaSponsoredPayload,
  ): Promise<ApiResponse<PrepareSolanaSponsoredResponse>> => {
    const res = await apiFetch("/api/transfers/solana/prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    })

    return handleTransferResponse(res)
  },

  submitSolanaSponsored: async (
    body: SubmitSolanaSponsoredPayload,
  ): Promise<ApiResponse<{ hash: string; message: string }>> => {
    const res = await apiFetch("/api/transfers/solana/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    })

    return handleTransferResponse(res)
  },

  transferEVM: async (
    body: TransferEVMPayload,
  ): Promise<ApiResponse<{ hash: string; message: string }>> => {
    const res = await apiFetch("/api/transfers/evm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    })

    return handleTransferResponse(res)
  },

  transferCrypto: async (
    body: TransferCryptoPayload,
  ): Promise<ApiResponse<{ hash: string }>> => {
    const res = await apiFetch("/api/transfers/crypto", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    })

    return handleTransferResponse(res)
  },

  sponsorUserOperation: async (
    body: SponsorUserOperationPayload,
  ): Promise<ApiResponse<unknown>> => {
    const res = await apiFetch(
      "/api/transfers/sponsor",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-platform": getPlatformHeader(),
        },
        body: JSON.stringify(body),
      },
      { signed: false },
    )

    return handleTransferResponse(res)
  },

  submitUserOperation: async (
    body: SubmitUserOperationPayload,
  ): Promise<ApiResponse<SubmitUserOperationResponse>> => {
    const res = await apiFetch("/api/transfers/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify(body),
    })

    return handleTransferResponse(res)
  },

  requestOTP: async (
    context: string,
    channel: "email" | "sms" = "email",
  ): Promise<
    ApiResponse<{
      success: boolean
      message: string
      maskedDestination?: string
    }>
  > => {
    const res = await apiFetch("/api/security/otp/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": getPlatformHeader(),
      },
      body: JSON.stringify({ action: context, context, channel }),
    })

    return handleTransferResponse(res)
  },
}
