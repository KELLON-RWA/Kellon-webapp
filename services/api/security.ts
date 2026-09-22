import { apiFetch, handleResponse, type ApiResponse } from "."
import type { VerificationMethod } from "./transfers"

export type OtpChannel = "email" | "sms"

export interface SecuritySettings {
  biometricsEnabled: boolean
  totpEnabled: boolean
  emailOtpEnabled: boolean
  smsOtpEnabled: boolean
}

export interface OtpRequestResult {
  success?: boolean
  channel?: OtpChannel
  maskedDestination?: string
  expiresInSeconds?: number
  message?: string
}

export interface TotpSetupResult {
  qrCodeUrl?: string
  secret: string
  isReenroll?: boolean
}

export function normalizeSecuritySettings(
  settings: Partial<SecuritySettings> & { otpEnabled?: boolean },
): SecuritySettings {
  return {
    biometricsEnabled: Boolean(settings.biometricsEnabled),
    totpEnabled: Boolean(settings.totpEnabled),
    emailOtpEnabled: Boolean(settings.emailOtpEnabled ?? settings.otpEnabled),
    smsOtpEnabled: Boolean(settings.smsOtpEnabled),
  }
}

export function getEnabledTransactionVerificationMethods(
  settings: SecuritySettings,
): VerificationMethod[] {
  const methods: VerificationMethod[] = []
  if (settings.emailOtpEnabled) methods.push("email_otp")
  if (settings.smsOtpEnabled) methods.push("sms_otp")
  if (settings.totpEnabled) methods.push("totp")
  return methods
}

async function securityRequest<T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const response = await apiFetch(`/api/security${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(response)
}

export const securityService = {
  getSettings: async (): Promise<SecuritySettings> => {
    const response = await securityRequest<
      Partial<SecuritySettings> & {
        otpEnabled?: boolean
      }
    >("/settings")
    return normalizeSecuritySettings(response.data)
  },
  requestOtp: (channel: OtpChannel, context = "enable_otp") =>
    securityRequest<OtpRequestResult>("/otp/request", {
      context,
      channel,
    }),
  enableOtp: (channel: OtpChannel, code: string) =>
    securityRequest<{ success: boolean }>("/otp/enable", { channel, code }),
  disableOtp: (channel: OtpChannel, code: string) =>
    securityRequest<{ success: boolean }>("/otp/disable", { channel, code }),
  setupTotp: (reset = false) =>
    securityRequest<TotpSetupResult>("/totp/setup", { reset }),
  enableTotp: (code: string) =>
    securityRequest<{ success: boolean }>("/totp/enable", { code }),
  disableTotp: (code: string) =>
    securityRequest<{ success: boolean }>("/totp/disable", { code }),
  toggleBiometrics: (enabled: boolean) =>
    securityRequest<{ success: boolean }>("/biometrics/toggle", { enabled }),
}
