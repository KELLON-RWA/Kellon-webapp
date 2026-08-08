import { describe, expect, it } from "vitest"
import {
  getEnabledTransactionVerificationMethods,
  normalizeSecuritySettings,
} from "./security"

describe("security settings", () => {
  it("normalizes the current per-method backend settings", () => {
    expect(
      normalizeSecuritySettings({
        biometricsEnabled: true,
        totpEnabled: true,
        emailOtpEnabled: false,
        smsOtpEnabled: true,
      }),
    ).toEqual({
      biometricsEnabled: true,
      totpEnabled: true,
      emailOtpEnabled: false,
      smsOtpEnabled: true,
    })
  })

  it("supports the legacy otpEnabled email setting", () => {
    expect(normalizeSecuritySettings({ otpEnabled: true })).toEqual({
      biometricsEnabled: false,
      totpEnabled: false,
      emailOtpEnabled: true,
      smsOtpEnabled: false,
    })
  })

  it("returns the enabled methods users can choose for a transaction", () => {
    expect(
      getEnabledTransactionVerificationMethods({
        biometricsEnabled: true,
        emailOtpEnabled: true,
        smsOtpEnabled: false,
        totpEnabled: true,
      }),
    ).toEqual(["email_otp", "totp"])
  })
})
