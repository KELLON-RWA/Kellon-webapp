import { describe, expect, it } from "vitest"
import {
  findTransferVerificationRequiredError,
  isTransferVerificationChallenge,
  resolveVerificationType,
} from "./transfers"

describe("transfer verification", () => {
  it("prefers a delivered OTP when OTP and TOTP are both available", () => {
    expect(resolveVerificationType(["totp", "email_otp"])).toBe("otp")
  })

  it("uses TOTP when it is the only available method", () => {
    expect(resolveVerificationType(["totp"])).toBe("totp")
  })

  it("does not treat a generic JSON-RPC -32000 response as MFA", () => {
    expect(
      isTransferVerificationChallenge(403, {
        error: { code: -32000, message: "execution reverted" },
      }),
    ).toBe(false)
  })

  it("recognizes an explicit backend verification challenge", () => {
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

  it("safely traverses structured viem details", () => {
    const result = findTransferVerificationRequiredError({
      status: 403,
      details: { reason: "insufficient balance" },
      cause: null,
    })

    expect(result).toBeNull()
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
