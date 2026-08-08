import { describe, expect, it } from "vitest"
import {
  findTransferVerificationRequiredError,
  getAvailableVerificationMethods,
  getOtpChannelForMethod,
  getVerificationTypeForMethod,
  isTransferVerificationChallenge,
  resolveVerificationMethod,
  resolveVerificationType,
} from "./transfers"

describe("transfer verification", () => {
  it("prefers a delivered OTP when OTP and TOTP are both available", () => {
    expect(resolveVerificationType(["totp", "email_otp"])).toBe("otp")
  })

  it("uses TOTP when it is the only available method", () => {
    expect(resolveVerificationType(["totp"])).toBe("totp")
  })

  it("preserves the exact OTP channel used by the bundler", () => {
    expect(resolveVerificationMethod(["totp", "email_otp"])).toBe("email_otp")
    expect(resolveVerificationMethod(["sms_otp"])).toBe("sms_otp")
  })

  it("exposes only supported verification choices without duplicates", () => {
    expect(
      getAvailableVerificationMethods([
        "email_otp",
        "totp",
        "otp",
        "email_otp",
        "passkey",
      ]),
    ).toEqual(["email_otp", "totp"])
  })

  it("maps a selected method to its verifier and delivery channel", () => {
    expect(getVerificationTypeForMethod("totp")).toBe("totp")
    expect(getVerificationTypeForMethod("sms_otp")).toBe("otp")
    expect(getOtpChannelForMethod("email_otp")).toBe("email")
    expect(getOtpChannelForMethod("sms_otp")).toBe("sms")
    expect(getOtpChannelForMethod("totp")).toBeNull()
  })

  it("does not turn a generic bundler failure into another OTP prompt", () => {
    expect(
      isTransferVerificationChallenge(403, {
        error: { code: -32000, message: "execution reverted" },
      }),
    ).toBe(false)
  })

  it("recognizes an explicit verification challenge", () => {
    expect(
      isTransferVerificationChallenge(403, {
        error: {
          code: -32000,
          message: "VERIFICATION_REQUIRED",
          availableMethods: ["email_otp"],
        },
      }),
    ).toBe(true)
  })

  it("safely ignores structured non-verification details", () => {
    expect(
      findTransferVerificationRequiredError({
        status: 403,
        details: { reason: "insufficient balance" },
        cause: null,
      }),
    ).toBeNull()
  })

  it("preserves nested challenge methods and action", () => {
    const result = findTransferVerificationRequiredError({
      response: {
        status: 403,
        data: {
          error: {
            message: "VERIFICATION_REQUIRED",
            availableMethods: ["email_otp", "totp"],
            action: "transfer",
          },
        },
      },
    })

    expect(result?.verificationType).toBe("otp")
    expect(result?.availableMethods).toEqual(["email_otp", "totp"])
    expect(result?.action).toBe("transfer")
  })
})
